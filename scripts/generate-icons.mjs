// Regenerates the PNG app icons from public/icon.svg: `npm run icons`.
// Run it again whenever the logo changes, and commit the output.
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const svg = await readFile(new URL("../public/icon.svg", import.meta.url));

// Maskable icons get cropped to a circle/squircle by Android, so the mark has
// to sit inside the central 80% "safe zone" on a full-bleed background.
const maskableSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1f2a44"/>
  <path d="M146 340 H366" stroke="#f4efe6" stroke-width="24" stroke-linecap="round"/>
  <path d="M164 304 C220 304 228 182 271 182 C314 182 320 260 350 260" fill="none" stroke="#e8593b" stroke-width="32" stroke-linecap="round"/>
</svg>`);

const outputs = [
  { src: svg, size: 192, file: "public/icons/icon-192.png" },
  { src: svg, size: 512, file: "public/icons/icon-512.png" },
  { src: maskableSvg, size: 512, file: "public/icons/maskable-512.png" },
  // iOS ignores transparency and rounds corners itself, so use the full-bleed version.
  { src: maskableSvg, size: 180, file: "public/icons/apple-touch-icon.png" },
];

for (const { src, size, file } of outputs) {
  await sharp(src, { density: 300 }).resize(size, size).png().toFile(fileURLToPath(new URL(`../${file}`, import.meta.url)));
  console.log(`wrote ${file}`);
}
