import "server-only";
import { spawn } from "node:child_process";
import { db } from "./db";
import { APP_VERSION } from "./version";

/**
 * Checks GitHub for a newer release, and hands installing it to the launcher.
 * The launcher (installer/launcher.mjs) owns the actual update, since it has to
 * stop this server to swap the app folder.
 */

const MANIFEST_URL = "https://github.com/SDPSTUDIOS/recall/releases/latest/download/manifest.json";
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const RELEASES_URL = "https://github.com/SDPSTUDIOS/recall/releases/latest";

export interface UpdateStatus {
  current: string;
  latest: string | null;
  available: boolean;
  /** Installed with the installer, so the launcher can update in place. Otherwise it's a clone. */
  canInstall: boolean;
  releaseUrl: string;
}

/** Numeric x.y.z comparison; anything unparseable counts as 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.-]/).slice(0, 3).map((n) => parseInt(n, 10) || 0);
  const pb = b.split(/[.-]/).slice(0, 3).map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

let cache: { at: number; latest: string | null } | null = null;

async function latestVersion(force: boolean): Promise<string | null> {
  if (!force && cache && Date.now() - cache.at < CHECK_EVERY_MS) return cache.latest;
  let latest: string | null = null;
  try {
    const res = await fetch(MANIFEST_URL, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    // A release still building has no manifest yet (404): treat as no news.
    if (res.ok) latest = ((await res.json()) as { version?: string }).version ?? null;
  } catch {
    // Offline or GitHub unreachable: try again on the next check.
  }
  cache = { at: Date.now(), latest };
  return latest;
}

export async function getUpdateStatus(force = false): Promise<UpdateStatus> {
  const latest = await latestVersion(force);
  return {
    current: APP_VERSION,
    latest,
    available: !!latest && compareVersions(latest, APP_VERSION) > 0,
    canInstall: !!process.env.RECALL_LAUNCHER,
    releaseUrl: RELEASES_URL,
  };
}

/** Question sets generating right now, which a restart would cut off. */
export function generatingCount(): number {
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM quizzes WHERE status = 'generating' AND started_at > ?")
    .get(Date.now() - 20 * 60 * 1000) as { n: number };
  return row.n;
}

/**
 * Starts the launcher in the background to stop this server, update and restart.
 * It outlives this process; the page polls /api/health until the new version answers.
 */
export function startUpdate() {
  const launcher = process.env.RECALL_LAUNCHER;
  if (!launcher) throw new Error("Not installed with the Recall installer.");
  const child = spawn(process.execPath, [launcher, "restart"], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}
