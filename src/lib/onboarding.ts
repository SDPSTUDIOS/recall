import fs from "node:fs";
import path from "node:path";

/**
 * Whether the first-run welcome has been completed, kept as a marker file next
 * to the database so it is per install rather than per browser. Deliberately
 * free of db.ts so the proxy can check it without opening SQLite.
 */
const MARKER = path.join(process.cwd(), "data", "onboarded.json");

let done = false;

export function isOnboarded(): boolean {
  // Once true it stays true, so later requests skip the filesystem.
  if (!done) done = fs.existsSync(MARKER);
  return done;
}

export function markOnboarded() {
  fs.mkdirSync(path.dirname(MARKER), { recursive: true });
  fs.writeFileSync(MARKER, JSON.stringify({ completedAt: new Date().toISOString() }) + "\n");
  done = true;
}
