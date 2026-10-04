import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runBuild } from './build.ts';
import { cachePath, writeAtomic } from './lib.ts';
import { sortTitleOf } from '../src/db/keys.ts';
import type { CorpusWork } from './types.ts';
import { parseManifest } from '../src/catalogue/manifest.ts';

/** Authored test metadata. No acquisition, API cache, cover or real source claim. */
const works: Array<Omit<CorpusWork, 'source'> & { source: 'synthetic-test' }> = [];
for (let index = 0; index < 3_722; index++) {
  const number = String(index).padStart(4, '0');
  const title = index === 0 ? 'Solstice in a Lantern' : `The Dragon Archive ${number}`;
  // Distinct alternate-title tokens produce a nontrivial FTS index and cross
  // the real four-MiB transfer boundary without padding or a fake SQL engine.
  const synonyms = Array.from({ length: 12 }, (_, alternate) => {
    const token = createHash('sha256')
      .update(`ex-libris-fixture:${index}:${alternate}`)
      .digest('hex')
      .slice(0, 32);
    return `Archive echo ${number} ${alternate} ${token}`;
  }).join('\n');
  works.push({
    id: `synthetic:${number}`,
    title,
    title_normalized: sortTitleOf(title),
    synonyms,
    authors: index === 0 ? 'Rowan Quill' : `Test Author ${index % 120}`,
    format_hint:
      index === 0 ? 'manhwa' : index % 3 === 0 ? 'novel' : index % 3 === 1 ? 'book' : 'manhwa',
    series_id: null,
    series_position: null,
    universe_id: null,
    cover_id: null,
    cover_source: null,
    publication_status: 'complete',
    chapter_count: index === 0 ? 96 : null,
    volume_count: null,
    year: 2020 + (index % 6),
    popularity: index === 0 ? 100 : index % 100,
    external_ids: '{}',
    source: 'synthetic-test',
  });
}

writeAtomic(
  cachePath('synthetic-fixture', 'works.jsonl'),
  works.map((work) => JSON.stringify(work)).join('\n') + '\n',
);
writeAtomic(cachePath('synthetic-fixture', 'series.jsonl'), '');
writeAtomic(cachePath('synthetic-fixture', 'universes.jsonl'), '');
const report = await runBuild({
  inputStage: 'synthetic-fixture',
  outputDir: cachePath('fixture-corpus'),
  builtAt: '2026-10-04T00:00:00.000Z',
});
if (!report.ok) throw new Error(report.notes.join('\n'));
const manifest = parseManifest(
  JSON.parse(readFileSync(cachePath('fixture-corpus', 'manifest.json'), 'utf8')),
);
if (
  manifest.distribution !== 'engineering-fixture' ||
  manifest.counts.works !== 3_722 ||
  manifest.chunks.length < 2
) {
  throw new Error('The synthetic fixture lost its distribution, count or multi-chunk coverage.');
}
console.log(
  `Authored catalogue fixture: ${manifest.counts.works} works, ${manifest.bytes} bytes, ${manifest.chunks.length} chunks, SHA-256 ${manifest.sha256}.`,
);
