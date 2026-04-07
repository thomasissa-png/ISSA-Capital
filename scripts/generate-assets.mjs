import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Génération des binaires d'assets à partir des SVG sources.
 * Voir docs/design/assets-handoff.md pour le contexte complet.
 *
 * Produit dans public/ :
 *  - favicon.ico (multi-tailles 16/32/48)
 *  - apple-touch-icon.png (180x180)
 *  - android-chrome-192x192.png
 *  - android-chrome-512x512.png
 *  - og-image.png (1200x630)
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

async function convertSvgToPng(svgFile, pngFile, width, height) {
  const svgBuffer = readFileSync(join(publicDir, svgFile));
  await sharp(svgBuffer)
    .resize(width, height)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(join(publicDir, pngFile));
  console.log(`Generated: ${pngFile} (${width}x${height})`);
}

async function generateFaviconIco() {
  const svgBuffer = readFileSync(join(publicDir, 'favicon-source.svg'));
  const sizes = [16, 32, 48];
  const pngBuffers = await Promise.all(
    sizes.map((size) => sharp(svgBuffer).resize(size, size).png().toBuffer()),
  );
  const ico = await pngToIco(pngBuffers);
  writeFileSync(join(publicDir, 'favicon.ico'), ico);
  console.log('Generated: favicon.ico (16/32/48)');
}

async function main() {
  await convertSvgToPng('apple-touch-icon.svg', 'apple-touch-icon.png', 180, 180);
  await convertSvgToPng('android-chrome-192x192.svg', 'android-chrome-192x192.png', 192, 192);
  await convertSvgToPng('android-chrome-512x512.svg', 'android-chrome-512x512.png', 512, 512);
  await convertSvgToPng('og-image-source.svg', 'og-image.png', 1200, 630);
  await generateFaviconIco();
  console.log('Assets générés avec succès.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
