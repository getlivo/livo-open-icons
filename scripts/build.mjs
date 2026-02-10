import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ICONS_DIR = path.join(ROOT, "icons");
const DIST_DIR = path.join(ROOT, "dist");
const DIST_ICONS_DIR = path.join(DIST_DIR, "icons");
const MANIFEST_PATH = path.join(DIST_DIR, "manifest.json");

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

async function main() {
  await ensureDir(DIST_ICONS_DIR);

  const all = await walk(ICONS_DIR);
  const svgs = all.filter((f) => f.toLowerCase().endsWith(".svg"));

  const version =
    process.env.RELEASE_TAG ||
    process.env.npm_package_version ||
    "0.0.0";

  const icons = [];

  for (const absSrc of svgs) {
    const relFromIcons = path.relative(ICONS_DIR, absSrc).replaceAll("\\", "/"); // cross-platform
    const absDist = path.join(DIST_ICONS_DIR, relFromIcons);

    await ensureDir(path.dirname(absDist));

    const buf = await fs.readFile(absSrc);

    // Copy to dist
    await fs.writeFile(absDist, buf);

    const name = path.basename(relFromIcons, ".svg"); // keep filename as name
    icons.push({
      name,
      path: `icons/${relFromIcons}`,
      sha256: sha256(buf),
      bytes: buf.byteLength,
    });
  }

  icons.sort((a, b) => a.name.localeCompare(b.name));

  const manifest = {
    version,
    generatedAt: new Date().toISOString(),
    icons,
  };

  await ensureDir(DIST_DIR);
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  console.log(`Built ${icons.length} icons`);
  console.log(`Wrote ${path.relative(ROOT, MANIFEST_PATH)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
