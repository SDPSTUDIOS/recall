import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { unzipSync, type UnzipFileInfo } from "fflate";
import { isNoise } from "./github";

/** Largest zip accepted for upload. */
export const MAX_ZIP_BYTES = 100 * 1024 * 1024;
/** Limits on what gets unpacked, so a zip bomb can't fill the disk or memory. */
const MAX_FILES = 20_000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 300 * 1024 * 1024;

export class ZipError extends Error {}

/**
 * A safe relative path for a zip entry, or null for folders and anything that
 * could escape the extraction folder (absolute paths, drive letters, "..").
 */
function safePath(name: string): string | null {
  const p = name.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!p || p.endsWith("/") || p.startsWith("/") || /^[a-zA-Z]:/.test(p)) return null;
  const parts = p.split("/");
  if (parts.some((s) => s === "" || s === "." || s === ".." || /[\0<>:"|?*]/.test(s))) return null;
  return p;
}

export interface ZipPlan {
  /** Zip entry name → path to write it to, relative to the project folder. */
  entries: Map<string, string>;
  /** Files in the zip, before anything was left out. */
  total: number;
}

/**
 * Reads the zip's directory (without unpacking anything) and decides what to
 * extract: source files only, minus dependencies, build output, binaries and
 * oversized files. GitHub's "Download ZIP" wraps everything in one folder
 * (e.g. "project-main/"), so a single shared top folder is dropped.
 */
export function planZip(data: Uint8Array): ZipPlan {
  const infos: UnzipFileInfo[] = [];
  try {
    unzipSync(data, {
      filter: (f) => {
        infos.push(f);
        return false;
      },
    });
  } catch {
    throw new ZipError("That file isn't a valid zip archive.");
  }

  const files = infos.filter((f) => safePath(f.name) !== null);
  if (infos.length > 0 && files.length === 0) throw new ZipError("The zip has no files in it.");

  const paths = files.map((f) => safePath(f.name)!);
  // Look for the wrapper folder among real files only: macOS adds a __MACOSX/ folder beside it.
  const kept = paths.filter((p) => !isNoise(p));
  const tops = new Set(kept.map((p) => p.split("/")[0]));
  const strip = tops.size === 1 && kept.every((p) => p.includes("/")) ? `${[...tops][0]}/` : "";

  const entries = new Map<string, string>();
  let bytes = 0;
  for (const [i, f] of files.entries()) {
    const rel = paths[i].startsWith(strip) ? paths[i].slice(strip.length) : paths[i];
    // fflate only unpacks stored (0) and deflated (8) entries.
    if (!rel || isNoise(rel) || f.originalSize > MAX_FILE_BYTES || (f.compression !== 0 && f.compression !== 8)) continue;
    bytes += f.originalSize;
    if (entries.size >= MAX_FILES || bytes > MAX_TOTAL_BYTES) {
      throw new ZipError(
        `The project is too big to examine (over ${MAX_FILES.toLocaleString()} files or ${MAX_TOTAL_BYTES / 1024 / 1024} MB of source). Zip just the source code, without dependencies or build output.`,
      );
    }
    entries.set(f.name, rel);
  }
  if (entries.size === 0) {
    throw new ZipError("The zip has no source files to examine (only dependencies, build output or binary files).");
  }
  return { entries, total: files.length };
}

/** Unpacks the planned files into `dir`. Returns the relative paths written, sorted. */
export async function extractZip(data: Uint8Array, dir: string): Promise<{ files: string[]; total: number }> {
  const plan = planZip(data);
  let unpacked: Record<string, Uint8Array>;
  try {
    unpacked = unzipSync(data, { filter: (f) => plan.entries.has(f.name) });
  } catch {
    throw new ZipError("The zip couldn't be unpacked. It may be damaged; try creating it again.");
  }

  await fs.rm(dir, { recursive: true, force: true });
  const root = path.resolve(dir);
  const written: string[] = [];
  for (const [name, content] of Object.entries(unpacked)) {
    const rel = plan.entries.get(name);
    if (!rel) continue;
    const target = path.resolve(root, rel);
    // safePath already rules this out; check again on the real path before writing.
    if (!target.startsWith(root + path.sep)) continue;
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
    written.push(rel);
  }
  return { files: written.sort(), total: plan.total };
}
