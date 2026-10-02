#!/usr/bin/env node
/**
 * Rasterises the owner's quill artwork into the PNGs the manifest names.
 *
 * Uses the Chromium that Playwright already installs rather than adding an
 * image library for a job that runs by hand a handful of times a year.
 *
 *   npm run icons
 *
 * The supplied original stays untouched outside public/. Ordinary icons crop
 * only the outer black margin; the maskable icon leaves room for Android's
 * centre-safe crop. The paper shape and lettering are part of the artwork.
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const outDir = join(ROOT, 'public/icons');
const source = readFileSync(join(ROOT, 'assets/brand/ex-libris-quill-source.png'));
const sourceSize = source.readUInt32BE(16);
if (sourceSize !== source.readUInt32BE(20)) {
  throw new Error('The owner-supplied icon master must be square.');
}
mkdirSync(outDir, { recursive: true });

const TARGETS = [
  { file: 'icon-192.png', size: 192, scale: 1.14 },
  { file: 'icon-512.png', size: 512, scale: 1.14 },
  // Centre the feather and pen within the maskable safe circle without shrinking the paper.
  { file: 'icon-maskable-512.png', size: 512, scale: 1, offsetX: -0.03, offsetY: 0.033 },
];

const browser = await chromium.launch();
try {
  for (const { file, size, scale, offsetX = 0, offsetY = 0 } of TARGETS) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    const image = source.toString('base64');
    const renderedSize = size * scale;
    const left = size * (0.5 + offsetX);
    const top = size * (0.5 + offsetY);
    await page.setContent(
      `<!doctype html><style>
         html,body{margin:0;width:${size}px;height:${size}px;overflow:hidden;background:#050505}
         img{position:absolute;left:${left}px;top:${top}px;transform:translate(-50%,-50%);
             display:block;width:${renderedSize}px;height:${renderedSize}px;max-width:none}
       </style><img src="data:image/png;base64,${image}" alt="">`,
    );
    const shot = await page.screenshot({ omitBackground: false });
    writeFileSync(join(outDir, file), shot);
    console.log(`  wrote public/icons/${file}  ${size}x${size}`);
    await page.close();
  }
} finally {
  await browser.close();
}
