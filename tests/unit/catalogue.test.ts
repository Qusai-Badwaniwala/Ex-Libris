import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CORPUS_CHUNK_BYTES, checksumFile } from '../../pipeline/checksum.ts';
import { corpusPath, parseManifest } from '../../src/catalogue/manifest';
import { parseMangaDexManga } from '../../src/catalogue/mangadex';
import { toFtsPrefixQuery } from '../../src/catalogue/query';
import { catalogueSearchBindings } from '../../src/catalogue/search-sql';
import type { CorpusManifest } from '../../src/catalogue/types';

const manifest = (overrides: Partial<CorpusManifest> = {}): CorpusManifest => ({
  schema: 1,
  version: '20260904',
  builtAt: '2026-09-04T00:00:00.000Z',
  file: 'corpus.sqlite',
  bytes: 5,
  sha256: 'a'.repeat(64),
  chunkSize: 4,
  chunks: [
    { offset: 0, bytes: 4, sha256: 'b'.repeat(64) },
    { offset: 4, bytes: 1, sha256: 'c'.repeat(64) },
  ],
  distribution: 'production',
  sources: { openlibrary: 1 },
  counts: { works: 1, series: 0, universes: 0, withSeries: 0, withCover: 0 },
  ...overrides,
});

describe('catalogue manifests', () => {
  it('accepts a contiguous checksum map and derives a safe OPFS path', () => {
    expect(parseManifest(manifest()).version).toBe('20260904');
    expect(corpusPath('2026.09-core')).toBe('catalogue/corpus-2026.09-core.sqlite');
  });

  it('rejects gaps, traversal, and a size that the chunks do not cover', () => {
    expect(() =>
      parseManifest(manifest({ chunks: [{ offset: 1, bytes: 4, sha256: 'b'.repeat(64) }] })),
    ).toThrow(/checksum map/i);
    expect(() => parseManifest(manifest({ file: '../private.sqlite' }))).toThrow(/file name/i);
    expect(() => corpusPath('../../outside')).toThrow(/version/i);
  });

  it('rejects impossible counts and a missing source ledger', () => {
    expect(() =>
      parseManifest(
        manifest({
          counts: { works: 1, series: 0, universes: 0, withSeries: 2, withCover: 0 },
        }),
      ),
    ).toThrow(/work count/i);
    expect(() => parseManifest(manifest({ sources: {} }))).toThrow(/source ledger/i);
  });
});

describe('catalogue query input', () => {
  it('quotes title words and strips FTS operators', () => {
    expect(toFtsPrefixQuery('Re:Zero - Starting Life')).toBe(
      '"re"* AND "zero"* AND "starting"* AND "life"*',
    );
    expect(toFtsPrefixQuery('" OR corpus_work_fts:*')).toBe(
      '"or"* AND "corpus"* AND "work"* AND "fts"*',
    );
  });

  it('normalises full-width text and bounds pasted input', () => {
    expect(toFtsPrefixQuery('Ｓｏｌｏ Ｌｅｖｅｌｉｎｇ')).toBe('"solo"* AND "leveling"*');
    expect(toFtsPrefixQuery('one two three four five six seven eight').split(' AND ')).toHaveLength(
      6,
    );
  });

  it('ranks an exact normalized title before broader prefixes', () => {
    expect(catalogueSearchBindings('Dune', 100)).toEqual(['"dune"*', 'dune', 'dune%', 30]);
  });
});

describe('pipeline checksum map', () => {
  it('hashes incrementally into bounded, contiguous chunks', () => {
    const dir = mkdtempSync(join(tmpdir(), 'exl-corpus-'));
    const path = join(dir, 'corpus.sqlite');
    try {
      const bytes = Buffer.alloc(CORPUS_CHUNK_BYTES + 3, 7);
      writeFileSync(path, bytes);
      const result = checksumFile(path);
      expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(result.chunks.map((chunk) => [chunk.offset, chunk.bytes])).toEqual([
        [0, CORPUS_CHUNK_BYTES],
        [CORPUS_CHUNK_BYTES, 3],
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('live MangaDex metadata', () => {
  it('labels an adaptation as a comic and keeps missing counts missing', () => {
    const match = parseMangaDexManga({
      id: 'md-1',
      attributes: {
        title: { en: 'Reverend Insanity' },
        originalLanguage: 'zh',
        lastChapter: '',
        lastVolume: null,
        status: 'cancelled',
        year: 2024,
      },
      relationships: [{ type: 'author', attributes: { name: 'Gu Zhen Ren' } }],
    });
    expect(match).toMatchObject({
      corpusId: 'mangadex:md-1',
      formatHint: 'manhwa',
      publicationStatus: 'abandoned',
      authors: ['Gu Zhen Ren'],
    });
    expect(match?.chapterCount).toBeUndefined();
  });
});
