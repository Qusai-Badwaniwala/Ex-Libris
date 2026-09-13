import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db/db';
import * as repo from '../../src/db/repo';
import type { Series, Work } from '../../src/db/schema';
import {
  CATALOGUE_RELATIONSHIP_SQL,
  CATALOGUE_SERIES_ENTRIES_SQL,
  rowsToRelationshipEvidence,
} from '../../src/catalogue/relationship-sql';
import { parseSeriesTitle } from '../../src/relationships/title-pattern';
import {
  matchLibrarySeries,
  resolveRelationships,
  titleSimilarity,
} from '../../src/relationships/resolver';
import { seriesCompletionFacts } from '../../src/relationships/completion';

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map((table) => table.clear()));
});

afterEach(() => db.close());

const work = (patch: Partial<Work> = {}): Work => ({
  id: crypto.randomUUID(),
  title: 'Golden Son',
  sortTitle: 'golden son',
  format: 'book',
  authorIds: [],
  status: 'reading',
  publicationStatus: 'complete',
  progressUnit: 'page',
  progressCurrent: 0,
  coverSource: 'none',
  tagIds: [],
  genres: [],
  isTranslated: false,
  dateAdded: new Date().toISOString(),
  externalIds: {},
  corpusId: 'openlibrary:OL-golden-son',
  isManualEntry: false,
  updatedAt: new Date().toISOString(),
  ...patch,
});

const series = (patch: Partial<Series> = {}): Series => ({
  id: 'series-red-rising',
  name: 'Red Rising',
  sortName: 'red rising',
  source: 'user',
  externalIds: {},
  updatedAt: new Date().toISOString(),
  ...patch,
});

function goldenSonCorpusEvidence() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE corpus_work (
      id TEXT PRIMARY KEY, title TEXT, authors TEXT, format_hint TEXT,
      series_id TEXT, series_position REAL, universe_id TEXT, cover_id TEXT,
      cover_source TEXT, publication_status TEXT, chapter_count INTEGER,
      volume_count INTEGER, year INTEGER, source TEXT
    );
    CREATE TABLE corpus_series (
      id TEXT PRIMARY KEY, name TEXT, universe_id TEXT, total_entries INTEGER, source TEXT
    );
    CREATE TABLE corpus_universe (
      id TEXT PRIMARY KEY, name TEXT, description TEXT, source TEXT
    );
    INSERT INTO corpus_series VALUES ('series:wikidata:Q-RR', 'Red Rising', NULL, 6, 'wikidata');
    INSERT INTO corpus_work VALUES
      ('openlibrary:OL-red-rising', 'Red Rising', 'Pierce Brown', 'book',
       'series:wikidata:Q-RR', 1, NULL, NULL, NULL, 'complete', NULL, NULL, 2014, 'wikidata'),
      ('openlibrary:OL-golden-son', 'Golden Son', 'Pierce Brown', 'book',
       'series:wikidata:Q-RR', 2, NULL, NULL, NULL, 'complete', NULL, NULL, 2015, 'wikidata'),
      ('openlibrary:OL-morning-star', 'Morning Star', 'Pierce Brown', 'book',
       'series:wikidata:Q-RR', 3, NULL, NULL, NULL, 'complete', NULL, NULL, 2016, 'wikidata');
  `);
  const root = sqlite.prepare(CATALOGUE_RELATIONSHIP_SQL);
  root.setReturnArrays(true);
  const rootRows = root.all('openlibrary:OL-golden-son') as unknown as unknown[][];
  const entries = sqlite.prepare(CATALOGUE_SERIES_ENTRIES_SQL);
  entries.setReturnArrays(true);
  const entryRows = entries.all('series:wikidata:Q-RR') as unknown as unknown[][];
  sqlite.close();
  return rowsToRelationshipEvidence(rootRows, entryRows)!;
}

describe('title-pattern evidence', () => {
  it('recognises explicit ordinals without treating bare title numbers as series evidence', () => {
    expect(parseSeriesTitle('Golden Son (Red Rising #2)')).toMatchObject({
      seriesName: 'Red Rising',
      position: 2,
      pattern: 'parenthetical',
    });
    expect(parseSeriesTitle('Earthsea, Book Two')).toMatchObject({
      seriesName: 'Earthsea',
      position: 2,
    });
    expect(parseSeriesTitle('Part IV of The Murderbot Diaries')).toMatchObject({
      seriesName: 'The Murderbot Diaries',
      position: 4,
    });
    expect(parseSeriesTitle('Catch-22')).toBeUndefined();
    expect(parseSeriesTitle('Station Eleven')).toBeUndefined();
  });

  it('requires a unique high-scoring library match', () => {
    const redRising = series();
    expect(titleSimilarity('Red Risng', 'Red Rising')).toBeGreaterThanOrEqual(0.9);
    expect(matchLibrarySeries('Red Risng', [redRising])?.series.id).toBe(redRising.id);
    expect(matchLibrarySeries('Red', [redRising])).toBeUndefined();
    expect(
      matchLibrarySeries('Red Rising', [
        redRising,
        series({ id: 'other', name: 'Red Rising Saga' }),
      ]),
    ).toMatchObject({ series: { id: redRising.id } });
  });
});

describe('relationship resolution and confirmation', () => {
  it('uses exact corpus evidence to suggest Golden Son as Red Rising #2', async () => {
    const goldenSon = work();
    await db.work.add(goldenSon);
    const evidence = goldenSonCorpusEvidence();
    const result = resolveRelationships({
      work: goldenSon,
      corpus: evidence,
      librarySeries: [],
      libraryWorks: [goldenSon],
    });

    expect(result.series).toMatchObject({
      source: 'corpus',
      confidence: 'high',
      name: 'Red Rising',
      position: 2,
      totalEntriesKnown: 6,
    });
    expect(result.series?.missingEntries.map((entry) => entry.title)).toEqual([
      'Red Rising',
      'Morning Star',
    ]);
    expect(result.series?.missingEarlierEntries.map((entry) => entry.title)).toEqual([
      'Red Rising',
    ]);
    // Resolution is an offer. It must not create or link anything by itself.
    expect(await db.series.count()).toBe(0);
    expect((await db.work.get(goldenSon.id))?.seriesId).toBeUndefined();
  });

  it('links only after explicit confirmation and rolls creation back if the work is absent', async () => {
    const goldenSon = work();
    const suggestion = resolveRelationships({
      work: goldenSon,
      corpus: goldenSonCorpusEvidence(),
      librarySeries: [],
      libraryWorks: [goldenSon],
    }).series!;

    await expect(repo.confirmSeriesSuggestion('missing-work', suggestion)).rejects.toThrow(
      /does not exist/,
    );
    expect(await db.series.count()).toBe(0);

    await db.work.add(goldenSon);
    const confirmed = await repo.confirmSeriesSuggestion(goldenSon.id, suggestion);
    expect(confirmed.series).toMatchObject({
      id: 'series:wikidata:Q-RR',
      name: 'Red Rising',
      totalEntriesKnown: 6,
      source: 'corpus',
      externalIds: { wikidata: 'Q-RR' },
    });
    expect(confirmed.work).toMatchObject({
      seriesId: 'series:wikidata:Q-RR',
      seriesPosition: 2,
    });
    const orders = await repo.listReadingOrders('series', confirmed.series.id);
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ name: 'Publication order', source: 'corpus' });
    const orderEntries = await repo.getReadingOrderEntries(orders[0]!.id);
    expect(orderEntries.map((entry) => [entry.label, entry.workId])).toEqual([
      ['Red Rising', undefined],
      ['Golden Son', goldenSon.id],
      ['Morning Star', undefined],
    ]);
  });

  it('adds missing series entries to Wishlist as one rollback-safe batch', async () => {
    const goldenSon = work();
    await db.work.add(goldenSon);
    const suggestion = resolveRelationships({
      work: goldenSon,
      corpus: goldenSonCorpusEvidence(),
      librarySeries: [],
      libraryWorks: [goldenSon],
    }).series!;
    const confirmed = await repo.confirmSeriesSuggestion(goldenSon.id, suggestion);
    const result = await repo.addSeriesEntriesToWishlist(
      confirmed.series.id,
      suggestion.catalogueEntries,
    );

    expect(result.added.map((entry) => [entry.title, entry.status, entry.seriesPosition])).toEqual([
      ['Red Rising', 'wishlist', 1],
      ['Morning Star', 'wishlist', 3],
    ]);
    expect(result.skippedCorpusIds).toEqual(['openlibrary:OL-golden-son']);
    expect(await db.author.count()).toBe(1);
    const order = (await repo.listReadingOrders('series', confirmed.series.id))[0]!;
    expect((await repo.getReadingOrderEntries(order.id)).every((entry) => entry.workId)).toBe(true);

    const before = await db.work.count();
    await expect(
      repo.addSeriesEntriesToWishlist(confirmed.series.id, [
        {
          corpusId: 'openlibrary:valid',
          title: 'Valid',
          authors: [],
          formatHint: 'book',
          source: 'openlibrary',
        },
        {
          corpusId: 'openlibrary:no-format',
          title: 'Needs a shelf',
          authors: [],
          source: 'openlibrary',
        },
      ]),
    ).rejects.toThrow(/shelf choice/);
    expect(await db.work.count()).toBe(before);
  });

  it('keeps universe confirmation separate and updates the containing series atomically', async () => {
    const goldenSon = work({ seriesId: 'series-red-rising', seriesPosition: 2 });
    await db.series.add(series());
    await db.work.add(goldenSon);
    const confirmed = await repo.confirmUniverseSuggestion(goldenSon.id, {
      kind: 'universe',
      source: 'corpus',
      confidence: 'high',
      name: 'Red Rising Saga',
      description: 'A shared continuity.',
      corpusUniverseId: 'universe:wikidata:Q-SAGA',
    });
    expect(confirmed.work.universeId).toBe('universe:wikidata:Q-SAGA');
    expect((await db.series.get('series-red-rising'))?.universeId).toBe('universe:wikidata:Q-SAGA');
  });
});

describe('completion and named reading orders', () => {
  it('counts finished entries and refuses to invent a completion denominator', () => {
    const unknown = series();
    const known = series({ totalEntriesKnown: 6 });
    const works = [
      work({ id: 'one', seriesId: known.id, status: 'finished' }),
      work({ id: 'two', seriesId: known.id, status: 'reading' }),
      work({ id: 'wish', seriesId: known.id, status: 'wishlist' }),
    ];
    expect(seriesCompletionFacts(unknown, works).ring).toBeUndefined();
    expect(seriesCompletionFacts(known, works)).toMatchObject({
      owned: 2,
      finished: 1,
      ring: { value: 1, total: 6 },
    });
  });

  it('stores several named orders and replaces an order atomically', async () => {
    const redRising = series();
    const first = work({ id: 'first', title: 'Red Rising', seriesId: redRising.id });
    const second = work({ id: 'second', seriesId: redRising.id, seriesPosition: 2 });
    await db.series.add(redRising);
    await db.work.bulkAdd([first, second]);

    const publication = await repo.createReadingOrder(
      { contextType: 'series', contextId: redRising.id, name: 'Publication order' },
      [
        { kind: 'work', workId: first.id, label: first.title },
        { kind: 'work', workId: second.id, label: second.title },
      ],
    );
    await repo.createReadingOrder(
      { contextType: 'series', contextId: redRising.id, name: 'Preferred order' },
      [{ kind: 'work', workId: second.id, label: second.title }],
    );
    expect(await repo.listReadingOrders('series', redRising.id)).toHaveLength(2);

    await expect(
      repo.replaceReadingOrderEntries(publication.order.id, [
        { kind: 'work', workId: 'missing', label: 'Missing' },
      ]),
    ).rejects.toThrow(/does not exist/);
    expect(
      (await repo.getReadingOrderEntries(publication.order.id)).map((entry) => entry.workId),
    ).toEqual([first.id, second.id]);

    await repo.saveReadingOrder(
      publication.order.id,
      { name: 'Chronological order', description: 'Read the second entry first.' },
      [
        { kind: 'work', workId: second.id, label: second.title },
        { kind: 'work', workId: first.id, label: first.title },
      ],
    );
    expect(await db.readingOrder.get(publication.order.id)).toMatchObject({
      name: 'Chronological order',
      description: 'Read the second entry first.',
    });
    expect(
      (await repo.getReadingOrderEntries(publication.order.id)).map((entry) => entry.workId),
    ).toEqual([second.id, first.id]);

    await expect(
      repo.saveReadingOrder(publication.order.id, { name: 'A name that must roll back' }, [
        { kind: 'work', workId: 'missing', label: 'Missing' },
      ]),
    ).rejects.toThrow(/does not exist/);
    expect(await db.readingOrder.get(publication.order.id)).toMatchObject({
      name: 'Chronological order',
      description: 'Read the second entry first.',
    });
    expect(
      (await repo.getReadingOrderEntries(publication.order.id)).map((entry) => entry.workId),
    ).toEqual([second.id, first.id]);
  });

  it('stores and clears a universe starting point without changing its named orders', async () => {
    const universe = await repo.universeByName('The Ledger Continuity');
    const order = await repo.createReadingOrder(
      { contextType: 'universe', contextId: universe.id, name: 'Preferred order' },
      [],
    );

    await repo.updateUniverse(universe.id, {
      readingOrderNote: 'Start with The Verdigris Cycle.',
    });
    expect((await repo.getUniverse(universe.id))?.readingOrderNote).toBe(
      'Start with The Verdigris Cycle.',
    );
    await repo.updateUniverse(universe.id, { readingOrderNote: '' });
    expect((await repo.getUniverse(universe.id))?.readingOrderNote).toBeUndefined();
    expect(await db.readingOrder.get(order.order.id)).toBeTruthy();
  });
});
