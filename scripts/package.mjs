/**
 * Turns `next build` output (output: "standalone") into a release bundle for the
 * platform it runs on:
 *
 *   dist/recall-<version>-<platform>-<arch>.tar.gz   the app, ready to run with `node server.js`
 *   dist/recall-<version>-<platform>-<arch>.json     version, Node version, sha256 (for manifest.json)
 *
 * better-sqlite3 is a native module, so each platform needs its own build, and the
 * bundle must run on the same Node major it was built with. The release workflow
 * runs this once per OS.
 */
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = pkg.version;
const target = `${process.platform}-${process.arch}`;
const name = `recall-${version}-${target}`;

const standalone = path.join(root, ".next", "standalone");
const dist = path.join(root, "dist");
const stage = path.join(dist, name);

if (!fs.existsSync(path.join(standalone, "server.js"))) {
  console.error('No standalone build found. Run `npm run build` first (needs output: "standalone").');
  process.exit(1);
}

fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });

// dereference: Turbopack links .next/node_modules/<pkg>-<hash> to node_modules/<pkg>,
// and Windows can't extract symlinks without admin rights, so copy the real files.
// data/ is local state and must never ship. Next's file tracer follows the data paths in
// db.ts into ./data, so a build on a machine that has used the app copies it into
// standalone/. CI builds from a fresh checkout without one; this filter covers local builds.
fs.cpSync(standalone, stage, {
  recursive: true,
  dereference: true,
  filter: (src) => path.relative(standalone, src).split(path.sep)[0] !== "data",
});
fs.cpSync(path.join(root, ".next", "static"), path.join(stage, ".next", "static"), { recursive: true });
if (fs.existsSync(path.join(root, "public"))) {
  fs.cpSync(path.join(root, "public"), path.join(stage, "public"), { recursive: true });
}
// The launcher and its helpers, which the installer copies out of the bundle.
if (fs.existsSync(path.join(root, "installer"))) {
  fs.cpSync(path.join(root, "installer"), path.join(stage, "installer"), { recursive: true });
}

const info = { version, node: process.version, platform: process.platform, arch: process.arch };
fs.writeFileSync(path.join(stage, "release.json"), JSON.stringify(info, null, 2) + "\n");

// Last line of defence for the two things that would break or leak on a student's machine.
(function check(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Bundle contains a symlink: ${path.relative(stage, full)}`);
    if (entry.isDirectory()) check(full);
  }
})(stage);
if (fs.existsSync(path.join(stage, "data"))) throw new Error("Bundle contains a data/ folder");

// Relative paths only: Git for Windows' GNU tar reads "C:" in a path as a remote host.
const file = `${name}.tar.gz`;
execFileSync("tar", ["-czf", path.join("..", file), "."], { cwd: stage, stdio: "inherit" });

const archive = path.join(dist, file);
const sha256 = crypto.createHash("sha256").update(fs.readFileSync(archive)).digest("hex");
const size = fs.statSync(archive).size;
fs.writeFileSync(
  path.join(dist, `${name}.json`),
  JSON.stringify({ ...info, target, file, sha256, size }, null, 2) + "\n",
);
fs.rmSync(stage, { recursive: true, force: true });

console.log(`Packaged ${file} (${(size / 1024 / 1024).toFixed(1)} MB, node ${process.version})`);
