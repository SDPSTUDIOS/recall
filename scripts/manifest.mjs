/**
 * Combines the per-platform .json files written by package.mjs into manifest.json,
 * the one file the installer and launcher fetch to find the latest version:
 *
 *   https://github.com/SDPSTUDIOS/recall/releases/latest/download/manifest.json
 *
 * Usage: node scripts/manifest.mjs <dir with bundles> <tag>
 */
import fs from "node:fs";
import path from "node:path";

const [dir, tag] = process.argv.slice(2);
if (!dir || !tag) {
  console.error("Usage: node scripts/manifest.mjs <dir> <tag>");
  process.exit(1);
}

const version = tag.replace(/^v/, "");
const assets = {};
for (const f of fs.readdirSync(dir).filter((f) => /^recall-.*\.json$/.test(f))) {
  const a = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  if (a.version !== version) throw new Error(`${f} is version ${a.version}, expected ${version}`);
  assets[a.target] = {
    url: `https://github.com/SDPSTUDIOS/recall/releases/download/${tag}/${a.file}`,
    sha256: a.sha256,
    size: a.size,
    node: a.node,
  };
}
if (!Object.keys(assets).length) throw new Error(`No bundles found in ${dir}`);

const manifest = { version, tag, publishedAt: new Date().toISOString(), assets };
fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`manifest.json: ${version} for ${Object.keys(assets).join(", ")}`);
