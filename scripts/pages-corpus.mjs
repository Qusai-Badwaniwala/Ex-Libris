#!/usr/bin/env node
import { createHash } from 'node:crypto';
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SOURCE_DIR = join(ROOT, 'public', 'corpus');
const PARTS_DIR = join(ROOT, 'deployment', 'corpus');
const OUTPUT_DIR = join(ROOT, 'dist', 'corpus');
const partName = (index) => `part-${String(index).padStart(3, '0')}.bin`;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function readManifest(path) {
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  if (
    manifest?.schema !== 1 ||
    manifest?.distribution !== 'production' ||
    !Array.isArray(manifest?.chunks) ||
    manifest.chunks.length === 0
  ) {
    throw new Error('The Pages catalogue manifest is not a production schema-1 manifest.');
  }
  return manifest;
}

function split() {
  const manifestPath = join(SOURCE_DIR, 'manifest.json');
  const sourcePath = join(SOURCE_DIR, 'corpus.sqlite');
  const manifest = readManifest(manifestPath);
  if (!existsSync(sourcePath) || statSync(sourcePath).size !== manifest.bytes) {
    throw new Error('The local production catalogue does not match its declared size.');
  }

  mkdirSync(PARTS_DIR, { recursive: true });
  for (const name of readdirSync(PARTS_DIR)) {
    if (/^part-\d{3}\.bin$/.test(name)) unlinkSync(join(PARTS_DIR, name));
  }

  const source = openSync(sourcePath, 'r');
  try {
    manifest.chunks.forEach((chunk, index) => {
      const bytes = Buffer.alloc(chunk.bytes);
      let read = 0;
      while (read < bytes.length) {
        const count = readSync(source, bytes, read, bytes.length - read, chunk.offset + read);
        if (count === 0) throw new Error(`Catalogue part ${index} ended early.`);
        read += count;
      }
      if (sha256(bytes) !== chunk.sha256) {
        throw new Error(`Catalogue part ${index} failed its checksum.`);
      }
      writeFileSync(join(PARTS_DIR, partName(index)), bytes);
    });
  } finally {
    closeSync(source);
  }
  writeFileSync(join(PARTS_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Prepared ${manifest.chunks.length} checked catalogue parts for GitHub Pages.`);
}

function assemble() {
  const manifestPath = join(PARTS_DIR, 'manifest.json');
  const manifest = readManifest(manifestPath);
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputPath = join(OUTPUT_DIR, manifest.file);
  const output = openSync(outputPath, 'w');
  const whole = createHash('sha256');
  let written = 0;
  try {
    manifest.chunks.forEach((chunk, index) => {
      const bytes = readFileSync(join(PARTS_DIR, partName(index)));
      if (bytes.length !== chunk.bytes || sha256(bytes) !== chunk.sha256) {
        throw new Error(`Committed catalogue part ${index} does not match the manifest.`);
      }
      writeSync(output, bytes);
      whole.update(bytes);
      written += bytes.length;
    });
  } finally {
    closeSync(output);
  }

  if (written !== manifest.bytes || whole.digest('hex') !== manifest.sha256) {
    throw new Error('The assembled Pages catalogue failed its whole-file check.');
  }
  copyFileSync(manifestPath, join(OUTPUT_DIR, 'manifest.json'));

  const indexPath = join(ROOT, 'dist', 'index.html');
  copyFileSync(indexPath, join(ROOT, 'dist', '404.html'));
  writeFileSync(join(ROOT, 'dist', '.nojekyll'), '');
  console.log(`Assembled and verified ${written} catalogue bytes for GitHub Pages.`);
}

const command = process.argv[2];
if (command === 'split') split();
else if (command === 'assemble') assemble();
else {
  const script = process.argv[1] ? process.argv[1].split(/[\\/]/).at(-1) : 'pages-corpus.mjs';
  throw new Error(`Usage: node ${script} <split|assemble>`);
}
