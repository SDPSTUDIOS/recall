/**
 * Recall launcher: what the desktop shortcut runs. It lives at <RECALL_HOME>/launcher.mjs
 * and runs on the private Node runtime the installer downloaded.
 *
 *   node launcher.mjs start      update if there's a new release, start the server, open the browser
 *   node launcher.mjs restart    stop the running server, then start (used by the in-app "Update now")
 *   node launcher.mjs stop       stop the server
 *   node launcher.mjs install    first install (run by install.sh / install.ps1), then start
 *   node launcher.mjs uninstall  remove Recall but keep data/ (add --purge to delete it too)
 *
 * <RECALL_HOME> (~/.recall, or %LOCALAPPDATA%\Recall on Windows):
 *   app/          the current release bundle (replaced on update)
 *   app.old/      the previous one, restored if a new version fails to start
 *   node/<ver>/   Node runtimes; node.path names the one in use
 *   data/         database and uploads. Updates never touch it.
 *   logs/         server.log and launcher.log
 *
 * Plain Node with no dependencies: it has to run before any app is installed.
 */
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const REPO = "SDPSTUDIOS/recall";
const DEFAULT_PORT = 3737;
const IS_WIN = process.platform === "win32";
const IS_MAC = process.platform === "darwin";

const HOME = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(HOME, "app");
const APP_OLD = path.join(HOME, "app.old");
const APP_NEW = path.join(HOME, "app.new");
const DATA = path.join(HOME, "data");
const LOGS = path.join(HOME, "logs");
const NODE_DIR = path.join(HOME, "node");
const NODE_POINTER = path.join(HOME, "node.path");
const CONFIG = path.join(HOME, "config.json");
const PID_FILE = path.join(HOME, "server.pid");
const LOCK_FILE = path.join(HOME, "launcher.lock");
const DOWNLOADS = path.join(HOME, "downloads");

const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith("-")) ?? "start";
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

// ---------------------------------------------------------------------------
// Logging and small helpers

fs.mkdirSync(LOGS, { recursive: true });
const logStream = fs.createWriteStream(path.join(LOGS, "launcher.log"), { flags: "a" });
function log(...parts) {
  const line = parts.map(String).join(" ");
  logStream.write(`${new Date().toISOString()} ${line}\n`);
  if (process.stdout.isTTY || command === "install") console.log(line);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

function compareVersions(a, b) {
  const pa = String(a).split(/[.-]/).slice(0, 3).map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(/[.-]/).slice(0, 3).map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

function isAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}

/** Windows may briefly lock files (antivirus, indexer), so renames and deletes retry. */
async function retry(fn, attempts = 10) {
  for (let i = 1; ; i++) {
    try {
      return fn();
    } catch (e) {
      if (i >= attempts || !["EPERM", "EBUSY", "EACCES", "ENOTEMPTY"].includes(e.code)) throw e;
      await sleep(300 * i);
    }
  }
}

const remove = (p) => retry(() => fs.rmSync(p, { recursive: true, force: true }));

/** Windows' own bsdtar, which also extracts .zip. Git for Windows puts a GNU tar earlier on PATH. */
function tarBin() {
  if (!IS_WIN) return "tar";
  const sys = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
  return fs.existsSync(sys) ? sys : "tar";
}

function extract(archive, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const r = spawnSync(tarBin(), ["-xf", archive, "-C", dest], { stdio: "pipe", windowsHide: true });
  if (r.status !== 0) throw new Error(`Couldn't extract ${path.basename(archive)}: ${r.stderr}`);
}

function config() {
  return readJson(CONFIG, {});
}

function target() {
  // Windows on ARM runs the x64 build under emulation.
  const arch = IS_WIN && process.arch === "arm64" ? "x64" : process.arch;
  return `${process.platform}-${arch}`;
}

function installedRelease(dir = APP) {
  return readJson(path.join(dir, "release.json"));
}

// ---------------------------------------------------------------------------
// Downloads

async function fetchJson(url, timeoutMs) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

/** Streams a download to disk, reporting progress, and returns its sha256. */
async function download(url, file, onProgress) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15 * 60 * 1000) });
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status}): ${url}`);
  const total = Number(res.headers.get("content-length")) || 0;
  const hash = crypto.createHash("sha256");
  let done = 0;
  const body = Readable.fromWeb(res.body);
  body.on("data", (chunk) => {
    hash.update(chunk);
    done += chunk.length;
    if (total) onProgress?.(done / total);
  });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await pipeline(body, fs.createWriteStream(file));
  return hash.digest("hex");
}

function manifestUrl(tag) {
  // For testing the launcher against a local copy of a release.
  if (process.env.RECALL_MANIFEST_URL) return process.env.RECALL_MANIFEST_URL;
  return tag
    ? `https://github.com/${REPO}/releases/download/${tag}/manifest.json`
    : `https://github.com/${REPO}/releases/latest/download/manifest.json`;
}

// ---------------------------------------------------------------------------
// Node runtimes

function nodeExe(dir) {
  return IS_WIN ? path.join(dir, "node.exe") : path.join(dir, "bin", "node");
}

/** Makes sure the Node a release was built with is installed, and returns its executable. */
async function ensureNode(version, onProgress) {
  const dir = path.join(NODE_DIR, version);
  if (fs.existsSync(nodeExe(dir))) return nodeExe(dir);

  const arch = target().split("-")[1];
  const os_ = IS_WIN ? "win" : process.platform;
  const name = `node-${version}-${os_}-${arch}`;
  const file = `${name}.${IS_WIN ? "zip" : "tar.gz"}`;
  const base = `https://nodejs.org/dist/${version}`;

  log(`Downloading Node ${version}`);
  const sums = await (await fetch(`${base}/SHASUMS256.txt`, { signal: AbortSignal.timeout(30_000) })).text();
  const expected = sums.split("\n").find((l) => l.endsWith(`  ${file}`))?.split(" ")[0];
  if (!expected) throw new Error(`No checksum for ${file}`);

  const archive = path.join(DOWNLOADS, file);
  const actual = await download(`${base}/${file}`, archive, onProgress);
  if (actual !== expected) throw new Error(`Checksum mismatch for ${file}`);

  const tmp = path.join(NODE_DIR, `.${version}.tmp`);
  await remove(tmp);
  extract(archive, tmp);
  await remove(dir);
  await retry(() => fs.renameSync(path.join(tmp, name), dir));
  await remove(tmp);
  await remove(archive);
  return nodeExe(dir);
}

function currentNode() {
  try {
    const p = fs.readFileSync(NODE_POINTER, "utf8").trim();
    if (fs.existsSync(p)) return p;
  } catch {
    /* fall through */
  }
  return process.execPath;
}

/** Deletes Node runtimes that neither app/ nor app.old/ was built with. */
async function pruneNodes() {
  const keep = new Set([installedRelease(APP)?.node, installedRelease(APP_OLD)?.node].filter(Boolean));
  for (const v of fs.existsSync(NODE_DIR) ? fs.readdirSync(NODE_DIR) : []) {
    const dir = path.resolve(NODE_DIR, v) + path.sep;
    const inUse = [currentNode(), process.execPath].some((p) => path.resolve(p).startsWith(dir));
    if (!keep.has(v) && !inUse && !v.startsWith(".")) await remove(path.join(NODE_DIR, v)).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Updating

/**
 * Downloads a release into app.new/ and swaps it in, keeping the old one as app.old/.
 * Returns true if anything changed. Throws on failure, leaving app/ as it was.
 */
async function installRelease(manifest, onProgress) {
  const asset = manifest.assets?.[target()];
  if (!asset) throw new Error(`Release ${manifest.version} has no build for ${target()}`);

  const node = await ensureNode(asset.node, (p) => onProgress?.("Downloading", p * 0.4));

  log(`Downloading Recall ${manifest.version}`);
  const archive = path.join(DOWNLOADS, path.basename(new URL(asset.url).pathname));
  const sha = await download(asset.url, archive, (p) => onProgress?.("Downloading", 0.4 + p * 0.6));
  if (sha !== asset.sha256) throw new Error("Downloaded file is corrupt (checksum mismatch)");

  onProgress?.("Installing", 1);
  await remove(APP_NEW);
  extract(archive, APP_NEW);
  await remove(archive);
  if (installedRelease(APP_NEW)?.version !== manifest.version) {
    throw new Error("Downloaded bundle has the wrong version");
  }

  await remove(APP_OLD);
  if (fs.existsSync(APP)) await retry(() => fs.renameSync(APP, APP_OLD));
  await retry(() => fs.renameSync(APP_NEW, APP));
  fs.writeFileSync(NODE_POINTER, node);

  // The launcher updates itself from the new bundle. Running code is already loaded.
  const nextLauncher = path.join(APP, "installer", "launcher.mjs");
  if (fs.existsSync(nextLauncher)) fs.copyFileSync(nextLauncher, path.join(HOME, "launcher.mjs"));
  log(`Installed Recall ${manifest.version}`);
  return true;
}

/** Puts app.old/ back after a new version failed to start. */
async function rollback() {
  if (!fs.existsSync(APP_OLD)) return false;
  const old = installedRelease(APP_OLD);
  log(`Rolling back to ${old?.version}`);
  await remove(APP_NEW);
  if (fs.existsSync(APP)) await retry(() => fs.renameSync(APP, APP_NEW));
  await retry(() => fs.renameSync(APP_OLD, APP));
  await remove(APP_NEW);
  const node = old?.node && nodeExe(path.join(NODE_DIR, old.node));
  if (node && fs.existsSync(node)) fs.writeFileSync(NODE_POINTER, node);
  // The failed version replaced the launcher too: put back the one that matches.
  const oldLauncher = path.join(APP, "installer", "launcher.mjs");
  if (fs.existsSync(oldLauncher)) fs.copyFileSync(oldLauncher, path.join(HOME, "launcher.mjs"));
  // Don't offer the broken version again until a newer one is out.
  writeJson(CONFIG, { ...config(), skipVersion: config().lastTried });
  return true;
}

/** Checks for and installs an update. Never throws: an update must never stop Recall opening. */
async function maybeUpdate(onProgress) {
  if (flag("no-update") || process.env.RECALL_NO_UPDATE) return false;
  const current = installedRelease()?.version ?? "0.0.0";
  try {
    const manifest = await fetchJson(manifestUrl(), 5000);
    if (compareVersions(manifest.version, current) <= 0) return false;
    if (manifest.version === config().skipVersion) return false;
    log(`Update available: ${current} -> ${manifest.version}`);
    writeJson(CONFIG, { ...config(), lastTried: manifest.version });
    return await installRelease(manifest, onProgress);
  } catch (e) {
    log(`Update skipped: ${e.message}`);
    await remove(APP_NEW).catch(() => {});
    return false;
  }
}

// ---------------------------------------------------------------------------
// Server

function port() {
  return config().port ?? DEFAULT_PORT;
}

async function health(p = port(), timeoutMs = 1500) {
  try {
    const res = await fetch(`http://127.0.0.1:${p}/api/health`, { signal: AbortSignal.timeout(timeoutMs) });
    return await res.json();
  } catch {
    return null;
  }
}

function portFree(p) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.listen(p, "127.0.0.1", () => srv.close(() => resolve(true)));
  });
}

/**
 * Keeps the same port across runs: answers autosaved in the browser are tied to it.
 * Only moves if something else has taken it.
 */
async function choosePort() {
  const preferred = port();
  if (await portFree(preferred)) return preferred;
  for (let p = DEFAULT_PORT; p < DEFAULT_PORT + 20; p++) {
    if (p !== preferred && (await portFree(p))) {
      log(`Port ${preferred} is in use by another program; using ${p}`);
      writeJson(CONFIG, { ...config(), port: p });
      return p;
    }
  }
  throw new Error("No free port for Recall");
}

function serverPid() {
  const pid = Number(readJson(PID_FILE)?.pid);
  return isAlive(pid) ? pid : null;
}

function startServer(p) {
  const out = fs.openSync(path.join(LOGS, "server.log"), "a");
  const child = spawn(currentNode(), [path.join(APP, "server.js")], {
    cwd: APP,
    detached: true,
    windowsHide: true,
    stdio: ["ignore", out, out],
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(p),
      // Loopback only: Recall runs Claude on the student's account, so it mustn't be reachable from the network.
      HOSTNAME: "127.0.0.1",
      RECALL_DATA_DIR: DATA,
      RECALL_HOME: HOME,
      RECALL_LAUNCHER: path.join(HOME, "launcher.mjs"),
    },
  });
  child.unref();
  writeJson(PID_FILE, { pid: child.pid, port: p, startedAt: new Date().toISOString() });
  log(`Started server pid ${child.pid} on port ${p}`);
  return child.pid;
}

async function waitForServer(p, pid, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isAlive(pid)) return false;
    if ((await health(p))?.app === "recall") return true;
    await sleep(500);
  }
  return false;
}

async function stopServer() {
  const pid = serverPid();
  if (!pid) return;
  log(`Stopping server pid ${pid}`);
  try {
    process.kill(pid);
  } catch {
    /* already gone */
  }
  for (let i = 0; i < 40 && isAlive(pid); i++) await sleep(250);
  if (isAlive(pid)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* gone */
    }
  }
  fs.rmSync(PID_FILE, { force: true });
}

// ---------------------------------------------------------------------------
// Browser and splash page

function openBrowser(url) {
  // On restart the page that asked for the update is already open, and reloads itself.
  if (flag("no-open") || command === "restart") return;
  const [cmd, cmdArgs] = IS_WIN
    ? ["rundll32", ["url.dll,FileProtocolHandler", url]]
    : IS_MAC
      ? ["open", [url]]
      : ["xdg-open", [url]];
  spawn(cmd, cmdArgs, { detached: true, stdio: "ignore", windowsHide: true }).unref();
}

const SPLASH_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Starting Recall</title>
<style>
  :root { color-scheme: light dark; --bg:#f6f6f9; --fg:#18181b; --muted:#71717a; --brand:#7c3aed; --track:#e4e4e7; }
  @media (prefers-color-scheme: dark) { :root { --bg:#0b0b0f; --fg:#f4f4f5; --muted:#a1a1aa; --brand:#a78bfa; --track:#27272a; } }
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:var(--bg); color:var(--fg);
         font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif; }
  main { width:min(360px,calc(100vw - 32px)); text-align:center; }
  h1 { font-size:22px; margin:0 0 6px; }
  p { color:var(--muted); margin:0 0 20px; min-height:1.5em; }
  .bar { height:6px; border-radius:3px; background:var(--track); overflow:hidden; }
  .fill { height:100%; width:30%; background:var(--brand); border-radius:3px; transition:width .3s;
          animation:slide 1.2s ease-in-out infinite alternate; }
  .fill.known { animation:none; }
  @keyframes slide { from { margin-left:0 } to { margin-left:70% } }
  .err { color:#dc2626; }
</style></head>
<body><main>
  <h1>Recall</h1>
  <p id="msg">Starting…</p>
  <div class="bar"><div class="fill" id="fill"></div></div>
</main>
<script>
  const msg = document.getElementById("msg"), fill = document.getElementById("fill");
  async function poll() {
    try {
      const s = await (await fetch("/api/health", { cache: "no-store" })).json();
      if (s.app === "recall") { location.replace(location.pathname === "/" ? "/" : location.href); return; }
      msg.textContent = s.message || "Starting…";
      msg.className = s.error ? "err" : "";
      if (typeof s.progress === "number") { fill.classList.add("known"); fill.style.width = Math.round(s.progress * 100) + "%"; }
      else { fill.classList.remove("known"); fill.style.width = "30%"; }
      if (s.error) return;
    } catch {}
    setTimeout(poll, 600);
  }
  poll();
</script></body></html>`;

/**
 * A tiny page on Recall's port shown while updating and starting, so double-clicking
 * the shortcut gives instant feedback. It polls /api/health, which answers
 * "recall-launcher" until the real server takes over the port.
 */
function startSplash(p) {
  const state = { app: "recall-launcher", message: "Starting…", progress: null, error: false };
  const server = http.createServer((req, res) => {
    if (req.url?.startsWith("/api/health")) {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(state));
    } else if (req.url?.startsWith("/api/")) {
      res.writeHead(503).end();
    } else {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(SPLASH_HTML);
    }
  });
  const ready = new Promise((resolve) => {
    server.once("error", () => resolve(false));
    server.listen(p, "127.0.0.1", () => resolve(true));
  });
  return {
    ready,
    set(message, progress = null, error = false) {
      Object.assign(state, { message, progress, error });
    },
    close: () => new Promise((resolve) => server.close(() => resolve())),
    // Stays up after the launcher's work is done, so the error stays readable.
    keepOpenFor: (ms) => sleep(ms).then(() => server.close()),
  };
}

// ---------------------------------------------------------------------------
// Commands

/** Only one launcher at a time, so a double double-click doesn't start two servers. */
function lock() {
  try {
    fs.writeFileSync(LOCK_FILE, String(process.pid), { flag: "wx" });
  } catch {
    const holder = Number(fs.readFileSync(LOCK_FILE, "utf8"));
    if (isAlive(holder) && holder !== process.pid) return false;
    fs.writeFileSync(LOCK_FILE, String(process.pid));
  }
  process.on("exit", () => {
    try {
      if (fs.readFileSync(LOCK_FILE, "utf8") === String(process.pid)) fs.rmSync(LOCK_FILE);
    } catch {
      /* gone */
    }
  });
  return true;
}

async function start() {
  if (!lock()) {
    // Another launcher is starting Recall: its splash page is already on the port.
    openBrowser(`http://localhost:${port()}/`);
    return;
  }

  const running = await health(port(), 4000);
  if (running?.app === "recall") {
    // Already running, possibly mid-exam: just open it. The in-app banner offers updates.
    openBrowser(`http://localhost:${port()}/`);
    return;
  }
  if (serverPid()) await stopServer(); // a server that stopped answering

  const p = await choosePort();
  const splash = startSplash(p);
  await splash.ready;
  openBrowser(`http://localhost:${p}/`);

  const updated = await maybeUpdate((what, progress) =>
    splash.set(what === "Installing" ? "Installing the update…" : "Downloading an update…", progress),
  );
  if (!fs.existsSync(path.join(APP, "server.js"))) {
    splash.set("Recall isn't installed properly. Run the install command again.", null, true);
    log("No app installed");
    return splash.keepOpenFor(10 * 60 * 1000);
  }

  splash.set("Starting…");
  await splash.close();
  let pid = startServer(p);
  if (await waitForServer(p, pid)) return;

  log("Server failed to start; see logs/server.log");
  await stopServer();
  if (updated && (await rollback())) {
    pid = startServer(p);
    if (await waitForServer(p, pid)) return;
    await stopServer();
  }

  const fallback = startSplash(p);
  await fallback.ready;
  fallback.set(`Recall couldn't start. Details are in ${path.join(LOGS, "server.log")}`, null, true);
  return fallback.keepOpenFor(10 * 60 * 1000);
}

async function restart() {
  // Let the update request's response reach the browser before the server goes away.
  await sleep(1000);
  await stopServer();
  await start();
}

// --- Shortcuts -------------------------------------------------------------

/** Icons are copied next to the launcher (see createShortcuts), so they survive updates. */
function iconSource(ext) {
  const p = path.join(HOME, `icon.${ext}`);
  return fs.existsSync(p) ? p : null;
}

/** ~/Applications/Recall.app: a minimal app bundle whose executable runs the launcher. */
function macShortcut() {
  const appDir = path.join(os.homedir(), "Applications", "Recall.app");
  const contents = path.join(appDir, "Contents");
  fs.rmSync(appDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(contents, "MacOS"), { recursive: true });
  fs.mkdirSync(path.join(contents, "Resources"), { recursive: true });

  const exe = path.join(contents, "MacOS", "Recall");
  fs.writeFileSync(
    exe,
    `#!/bin/bash
# Runs the Recall launcher with Recall's private Node. Generated by the installer.
HOME_DIR=${JSON.stringify(HOME)}
NODE="$(cat "$HOME_DIR/node.path" 2>/dev/null)"
[ -x "$NODE" ] || NODE="$(ls -d "$HOME_DIR"/node/*/bin/node 2>/dev/null | tail -1)"
exec "$NODE" "$HOME_DIR/launcher.mjs" start
`,
  );
  fs.chmodSync(exe, 0o755);

  let icon = "";
  const png = iconSource("png");
  if (png) {
    // sips and iconutil ship with macOS.
    const set = path.join(os.tmpdir(), `recall-${process.pid}.iconset`);
    fs.mkdirSync(set, { recursive: true });
    for (const s of [16, 32, 64, 128, 256, 512]) {
      spawnSync("sips", ["-z", String(s), String(s), png, "--out", path.join(set, `icon_${s}x${s}.png`)], { stdio: "ignore" });
    }
    const r = spawnSync("iconutil", ["-c", "icns", set, "-o", path.join(contents, "Resources", "Recall.icns")], { stdio: "ignore" });
    fs.rmSync(set, { recursive: true, force: true });
    if (r.status === 0) icon = "<key>CFBundleIconFile</key><string>Recall</string>";
  }

  fs.writeFileSync(
    path.join(contents, "Info.plist"),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Recall</string>
  <key>CFBundleDisplayName</key><string>Recall</string>
  <key>CFBundleIdentifier</key><string>com.sdpstudios.recall</string>
  <key>CFBundleExecutable</key><string>Recall</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>${installedRelease()?.version ?? "0"}</string>
  <key>LSUIElement</key><true/>
  ${icon}
</dict></plist>
`,
  );

  // macOS may ask to allow access to the Desktop; if declined, the app is still in ~/Applications.
  const desktop = path.join(os.homedir(), "Desktop", "Recall.app");
  try {
    fs.rmSync(desktop, { recursive: true, force: true });
    fs.symlinkSync(appDir, desktop);
    return [appDir, desktop];
  } catch (e) {
    log(`Couldn't add a Desktop shortcut: ${e.message}`);
    return [appDir];
  }
}

function windowsShortcut() {
  // Reads node.path at launch, so the shortcuts keep working after Node is updated.
  const startScript = path.join(HOME, "start.ps1");
  fs.writeFileSync(
    startScript,
    `# Runs the Recall launcher with Recall's private Node. Generated by the installer.
$node = (Get-Content -LiteralPath "$PSScriptRoot\\node.path" -Raw).Trim()
& $node "$PSScriptRoot\\launcher.mjs" start
`,
  );

  const q = (s) => `'${s.replace(/'/g, "''")}'`;
  const icon = iconSource("ico");
  // GetFolderPath finds the real Desktop, which OneDrive often moves out of the home folder.
  const script = `
$ErrorActionPreference = 'Stop'
$shell = New-Object -ComObject WScript.Shell
foreach ($dir in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))) {
  $lnk = Join-Path $dir 'Recall.lnk'
  $s = $shell.CreateShortcut($lnk)
  $s.TargetPath = Join-Path $env:SystemRoot 'System32\\WindowsPowerShell\\v1.0\\powershell.exe'
  $s.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + ${q(startScript)} + '"'
  $s.WorkingDirectory = ${q(HOME)}
  $s.Description = 'Recall: practice exams from your lecture PDFs'
  ${icon ? `$s.IconLocation = ${q(icon)}` : ""}
  $s.Save()
  Write-Output $lnk
}`;
  const r = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (r.status !== 0) log(`Couldn't create shortcuts: ${r.stderr}`);
  return (r.stdout ?? "").split(/\r?\n/).filter(Boolean);
}

function linuxShortcut() {
  const exec = `sh -c '"$(cat ${HOME}/node.path)" ${HOME}/launcher.mjs start'`;
  const icon = iconSource("png");
  const entry = `[Desktop Entry]
Type=Application
Name=Recall
Comment=Practice exams from your lecture PDFs
Exec=${exec}
${icon ? `Icon=${icon}` : ""}
Terminal=false
Categories=Education;
`;
  const apps = path.join(os.homedir(), ".local", "share", "applications", "recall.desktop");
  fs.mkdirSync(path.dirname(apps), { recursive: true });
  fs.writeFileSync(apps, entry, { mode: 0o755 });
  const desktopDir = path.join(os.homedir(), "Desktop");
  const files = [apps];
  if (fs.existsSync(desktopDir)) {
    const d = path.join(desktopDir, "recall.desktop");
    fs.writeFileSync(d, entry, { mode: 0o755 });
    spawnSync("gio", ["set", d, "metadata::trusted", "true"], { stdio: "ignore" });
    files.push(d);
  }
  return files;
}

function createShortcuts() {
  // Icons are copied out of app/ so they survive updates replacing it.
  for (const ext of ["png", "ico"]) {
    const src = path.join(APP, "installer", `icon.${ext}`);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(HOME, `icon.${ext}`));
  }
  const made = IS_MAC ? macShortcut() : IS_WIN ? windowsShortcut() : linuxShortcut();
  writeJson(CONFIG, { ...config(), shortcuts: made });
  return made;
}

/** A one-line way to uninstall: `bash ~/.recall/uninstall.sh` or `& "$env:LOCALAPPDATA\\Recall\\uninstall.ps1"`. */
function writeUninstaller() {
  if (IS_WIN) {
    fs.writeFileSync(
      path.join(HOME, "uninstall.ps1"),
      `# Removes Recall. Your data folder is kept; add -Purge to delete it too.
param([switch]$Purge)
$node = (Get-Content -LiteralPath "$PSScriptRoot\\node.path" -Raw).Trim()
$extra = @(); if ($Purge) { $extra += '--purge' }
& $node "$PSScriptRoot\\launcher.mjs" uninstall @extra
`,
    );
  } else {
    fs.writeFileSync(
      path.join(HOME, "uninstall.sh"),
      `#!/bin/bash
# Removes Recall. Your data folder is kept; add --purge to delete it too.
HOME_DIR="$(cd "$(dirname "$0")" && pwd)"
"$(cat "$HOME_DIR/node.path")" "$HOME_DIR/launcher.mjs" uninstall "$@"
`,
      { mode: 0o755 },
    );
  }
}

async function install() {
  for (const dir of [DATA, NODE_DIR]) fs.mkdirSync(dir, { recursive: true });
  // The installer starts this launcher with a freshly downloaded Node: record it.
  if (!fs.existsSync(NODE_POINTER)) fs.writeFileSync(NODE_POINTER, process.execPath);

  const tag = option("tag");
  log(tag ? `Installing Recall ${tag}` : "Installing the latest Recall");
  const manifest = await fetchJson(manifestUrl(tag), 30_000);
  const current = installedRelease()?.version;
  if (current === manifest.version && !flag("force")) {
    log(`Recall ${current} is already installed`);
  } else {
    let shown = -1;
    await stopServer();
    await installRelease(manifest, (what, p) => {
      const pct = Math.floor(p * 10) * 10;
      if (pct !== shown && process.stdout.isTTY) {
        shown = pct;
        process.stdout.write(`\r  ${what}… ${pct}%   `);
      }
    });
    if (process.stdout.isTTY) process.stdout.write("\n");
    if (tag) writeJson(CONFIG, { ...config(), skipVersion: undefined, lastTried: undefined });
  }
  await pruneNodes();

  writeUninstaller();
  const shortcuts = createShortcuts();
  log(`Shortcuts: ${shortcuts.join(", ")}`);
  if (!flag("no-start")) {
    await stopServer();
    await start();
  }
}

async function uninstall() {
  await stopServer();
  for (const f of config().shortcuts ?? []) fs.rmSync(f, { recursive: true, force: true });
  const purge = flag("purge");
  for (const entry of fs.readdirSync(HOME)) {
    if (entry === "data" && !purge) continue;
    // Still in use by this process; removing the folder afterwards finishes the job.
    if (["logs", "launcher.mjs", "node", "node.path", "uninstall.sh", "uninstall.ps1"].includes(entry)) continue;
    await remove(path.join(HOME, entry)).catch((e) => log(`Couldn't remove ${entry}: ${e.message}`));
  }
  console.log(
    purge
      ? `Recall has been removed. You can delete ${HOME} to finish.`
      : `Recall has been removed. Your PDFs and results are still in ${DATA}; delete ${HOME} to remove them too.`,
  );
}

const commands = { start, restart, stop: stopServer, install, uninstall };
if (!commands[command]) {
  console.error(`Unknown command "${command}". Use: ${Object.keys(commands).join(", ")}`);
  process.exit(1);
}

try {
  await commands[command]();
} catch (e) {
  log(`Error: ${e.stack ?? e.message}`);
  if (process.stdout.isTTY || command === "install") console.error(`\n${e.message}`);
  process.exitCode = 1;
} finally {
  logStream.end();
}
