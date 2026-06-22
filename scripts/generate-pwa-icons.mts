import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const svgPath = path.join(root, "app", "apple-icon.svg");
const outDir = path.join(root, "public", "icons");

const sizes = [
  { name: "apple-touch-icon.png", size: 180 },
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "icon-maskable-512.png", size: 512, padding: 0.12 },
] as const;

async function main() {
  const svg = await readFile(svgPath);
  await mkdir(outDir, { recursive: true });

  for (const spec of sizes) {
    let pipeline = sharp(svg).resize(spec.size, spec.size);
    if ("padding" in spec && spec.padding) {
      const inner = Math.round(spec.size * (1 - spec.padding * 2));
      const inset = Math.round((spec.size - inner) / 2);
      pipeline = sharp(svg)
        .resize(inner, inner)
        .extend({
          top: inset,
          bottom: inset,
          left: inset,
          right: inset,
          background: "#0a0a0a",
        });
    }
    const png = await pipeline.png().toBuffer();
    await writeFile(path.join(outDir, spec.name), png);
    console.log(`Wrote public/icons/${spec.name}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});