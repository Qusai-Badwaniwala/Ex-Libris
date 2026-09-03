#!/usr/bin/env node
/**
 * Structural checks that no unit test can reach.
 *
 * Three of these guard the design contract, which is the thing this build is
 * most likely to break silently. `design/` holds the package exactly as Claude
 * Design delivered it and is never edited; `src/` consumes copies. If a copy
 * drifts, the app stops matching the design and nothing else in the gate
 * notices — a colour is still a valid colour, a tag list is still a valid list.
 *
 * Rule: collecting nothing is a failure, not a pass. A check that quietly
 * succeeds because it scanned zero files is worse than no check.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const failures = [];
const notes = [];
const fail = (msg) => failures.push(msg);

const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/* ── 1 · the design contract is copied, never edited ───────────────────── */

const PAIRS = [
  ['design/tokens.css', 'src/styles/tokens.css'],
  ['design/ex-libris-taxonomy.json', 'src/data/taxonomy.json'],
];

for (const [source, copy] of PAIRS) {
  const a = read(source).replace(/\r\n/g, '\n');
  const b = read(copy).replace(/\r\n/g, '\n');
  if (a !== b) {
    fail(
      `${copy} has drifted from ${source}. The design package is the contract — ` +
        `copy it back, or take the change to the owner first.`,
    );
  } else {
    notes.push(`${copy} matches ${source}`);
  }
}

/* ── 2 · the genre index table agrees with the taxonomy ────────────────── */

const tokens = read('src/styles/tokens.css');
const taxonomy = JSON.parse(read('src/data/taxonomy.json'));

if (taxonomy.genres.length !== 12) {
  fail(
    `Expected exactly 12 genres, found ${taxonomy.genres.length}. The set is closed: ` +
      `twelve genres, twelve palette colours. A thirteenth needs a thirteenth colour.`,
  );
}

const tagCount = taxonomy.tagGroups.reduce((n, g) => n + g.tags.length, 0);
if (tagCount !== 242) {
  fail(`Expected 242 seeded tags, found ${tagCount}.`);
}

// tokens.css carries the index-to-genre table as a comment, and warns that
// reordering it silently recolours every work in the library. A work stores the
// index, so this is the one drift that cannot be spotted by looking at the app.
const tableRows = [...tokens.matchAll(/^\s{7}(\d{1,2})\s+(\w+)\s{2,}(.+?)\s*$/gm)];
if (tableRows.length !== 12) {
  fail(
    `Could not read the 12-row index-to-genre table out of tokens.css ` +
      `(found ${tableRows.length} rows). If the comment block moved, fix this check ` +
      `rather than deleting it — it is the only thing guarding the index.`,
  );
} else {
  for (const [, idxRaw, colourName, rawGenre] of tableRows) {
    const idx = Number(idxRaw);
    // Row 1 carries a trailing note ("← the accent hue, deliberately"). The
    // arrow is the annotation marker; everything after it is prose.
    const genreName = rawGenre.split('←')[0].trim();
    const g = taxonomy.genres.find((x) => x.colorIndex === idx);
    if (!g) {
      fail(`tokens.css names index ${idx} but the taxonomy has no genre at that index.`);
      continue;
    }
    if (g.name !== genreName) {
      fail(
        `Genre index ${idx}: tokens.css says "${genreName}", taxonomy says "${g.name}". ` +
          `These must not diverge — the index is what a work stores.`,
      );
    }
    if (g.colorName.toLowerCase() !== colourName.toLowerCase()) {
      fail(
        `Genre index ${idx}: tokens.css names the colour "${colourName}", ` +
          `taxonomy says "${g.colorName}".`,
      );
    }
  }
  notes.push('the 12-row genre index table in tokens.css matches taxonomy.json');
}

/* ── 3 · nothing in src hardcodes a value that lives in tokens.css ─────── */

const SKIP_FILES = new Set(['src/styles/tokens.css', 'src/data/taxonomy.json']);
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const DURATION = /\b\d+ms\b/g;
const ALLOW = /tokens-allow/;

function walk(dir, out = []) {
  for (const entry of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

const scanned = walk('src').filter(
  (f) => ['.ts', '.tsx', '.css'].includes(extname(f)) && !SKIP_FILES.has(f),
);

if (scanned.length === 0) {
  fail('Scanned zero source files. The check did not run — that is a failure, not a pass.');
}

/**
 * Comments explain why a value is what it is; they are not the value, and this
 * project requires them to name the colour or duration they are explaining. So
 * comments are stripped before scanning — block comments included, which is the
 * case the first version of this check got wrong: it stripped only single-line
 * ones and flagged a hex inside the paragraph explaining that very hex.
 * Newlines are preserved so reported line numbers still point at real lines.
 */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// The allow marker IS a comment, so it has to be looked for in the RAW line.
// Testing it against the stripped line meant every deliberate exemption was
// flagged anyway — the marker had been removed before it could be read. Found
// the first time an exemption was actually needed, which is the only time this
// ordering could have shown itself.
for (const file of scanned) {
  const raw = read(file).split('\n');
  stripComments(read(file))
    .split('\n')
    .forEach((line, i) => {
      if (ALLOW.test(raw[i] ?? '')) return;
      for (const m of line.matchAll(HEX)) {
        fail(`${file}:${i + 1} hardcodes the colour ${m[0]}. Use a token from tokens.css.`);
      }
      for (const m of line.matchAll(DURATION)) {
        fail(`${file}:${i + 1} hardcodes the duration ${m[0]}. Use --dur-* or --duration-*.`);
      }
    });
}

notes.push(`scanned ${scanned.length} source files for hardcoded colours and durations`);

/* ── 4 · nobody slices an ISO string to get a calendar day ─────────────── */

// Everything is stored as a UTC instant. `iso.slice(0, 10)` answers the UTC
// question, and this library is read at night in IST — so a book finished at
// 01:00 local is stamped with the previous UTC day, and on 1 January with the
// previous YEAR. Found by looking at the Phase 0 panel, not by any test.
// src/db/dates.ts is the only correct way to ask.
// Any slice to 4, 7 or 10 characters is a year, a year-month or a day. There is
// no other reason to cut a string at exactly those lengths in this codebase, so
// the check does not try to also prove the value is a date — an earlier version
// gated on an identifier containing "At", which never matched `firstTrackedAt`
// because \bAt\b has no word boundary inside it, and the check was dead on
// arrival. A false positive costs one `tokens-allow` comment; a missed one
// costs a wrong year on the Stats screen.
const ISO_SLICE = /\.slice\(\s*0\s*,\s*(?:4|7|10)\s*\)/;

for (const file of scanned) {
  if (file === 'src/db/dates.ts') continue;
  const rawIso = read(file).split('\n');
  stripComments(read(file))
    .split('\n')
    .forEach((line, i) => {
      if (ALLOW.test(rawIso[i] ?? '')) return;
      if (ISO_SLICE.test(line)) {
        fail(
          `${file}:${i + 1} slices a date string to get a day or a year. That reads the ` +
            `UTC calendar, not the reader's. Use localDay / localYear from src/db/dates.ts.`,
        );
      }
    });
}

notes.push('no source file derives a calendar day by slicing an ISO string');

/* ── report ────────────────────────────────────────────────────────────── */

for (const n of notes) console.log(`  ok  ${n}`);

if (failures.length) {
  console.error(`\n${failures.length} structural check(s) failed:\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error('');
  process.exit(1);
}

console.log(`\nAll structural checks passed.`);
