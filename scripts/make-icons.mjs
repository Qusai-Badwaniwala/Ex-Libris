#!/usr/bin/env node
/**
 * Rasterises scripts/icon.svg into the three PNGs the manifest names.
 *
 * Uses the Chromium that Playwright already installs rather than adding an
 * image library for a job that runs by hand a handful of times a year.
 *
 *   npm run icons
 *
 * The maskable variant is inset to 80%, because Android crops a maskable icon
 * to whatever shape the launcher uses and the bookplate's corner diamonds sit
 * exactly where a circular mask cuts.
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const svg = readFileSync(join(ROOT, 'scripts/icon.svg'), 'utf8');
const outDir = join(ROOT, 'public/icons');
mkdirSync(outDir, { recursive: true });

const TARGETS = [
  { file: 'icon-192.png', size: 192, inset: 1 },
  { file: 'icon-512.png', size: 512, inset: 1 },
  { file: 'icon-maskable-512.png', size: 512, inset: 0.8 },
];

const browser = await chromium.launch();
try {
  for (const { file, size, inset } of TARGETS) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    const scaled = Math.round(size * inset);
    const pad = Math.round((size - scaled) / 2);
    await page.setContent(
      `<!doctype html><style>
         html,body{margin:0;width:${size}px;height:${size}px;background:#212631}
         svg{position:absolute;left:${pad}px;top:${pad}px;width:${scaled}px;height:${scaled}px}
       </style>${svg}`,
    );
    const shot = await page.screenshot({ omitBackground: false });
    writeFileSync(join(outDir, file), shot);
    console.log(`  wrote public/icons/${file}  ${size}x${size}${inset < 1 ? ' (maskable)' : ''}`);
    await page.close();
  }
} finally {
  await browser.close();
}
