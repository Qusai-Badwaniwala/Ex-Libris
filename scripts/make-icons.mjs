#!/usr/bin/env node
/**
 * Rasterises the approved logo masters into the three PNGs the manifest names.
 *
 * Uses the Chromium that Playwright already installs rather than adding an
 * image library for a job that runs by hand a handful of times a year.
 *
 *   npm run icons
 *
 * The separate maskable master keeps the complete mark inside Android's safe
 * zone. Both masters are full-bleed squares; the operating system owns the
 * launcher shape and no rounded-corner mockup is baked into the files.
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const outDir = join(ROOT, 'public/icons');
mkdirSync(outDir, { recursive: true });

const TARGETS = [
  { file: 'icon-192.png', source: 'icon-master.png', size: 192 },
  { file: 'icon-512.png', source: 'icon-master.png', size: 512 },
  { file: 'icon-maskable-512.png', source: 'icon-maskable-master.png', size: 512 },
];

const browser = await chromium.launch();
try {
  for (const { file, source, size } of TARGETS) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    const image = readFileSync(join(outDir, source)).toString('base64');
    await page.setContent(
      `<!doctype html><style>
         html,body{margin:0;width:${size}px;height:${size}px;overflow:hidden}
         img{display:block;width:${size}px;height:${size}px;object-fit:cover}
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
