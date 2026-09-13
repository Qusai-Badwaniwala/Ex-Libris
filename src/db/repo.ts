import { db } from './db';
import { newId, nowIso, sortTitleOf, sortNameOf, normalizeTag } from './keys';
import { GENRES, TAG_GROUP_MEMBERSHIP } from '../data/taxonomy';
import { deleteFile } from '../storage/opfs';
import { catalogueCoverUrl } from '../metadata/cover-urls';
import { AXIS_KEYS, type AxisKey } from '../axes/axes';
import type { CorpusRelationshipEntry } from '../catalogue/types';
import type {
  Author,
  AxisRating,
  AxisScore,
  ExternalIds,
  Format,
  GenreIndex,
  ProgressUnit,
  PublicationStatus,
  ReadingStatus,
  ReadingOrder,
  ReadingOrderEntry,
  ReadingSession,
  Note,
  Series,
  Tag,
  Universe,
  Work,
} from './schema';
import type { SeriesSuggestion, UniverseSuggestion } from '../relationships/resolver';
import { localYear, yearsTracked } from './dates';

/**
 * Every read and write against the library. Screens call these; nothing else
 * touches Dexie.
 *
 * The reason this is one module rather than one per entity: almost every rule
 * worth enforcing spans two tables. Changing a status stamps a date. Deleting a
 * work leaves its notes alone. Adding a tag bumps a counter. Split across five
 * files, each of those becomes a convention that a future call site can forget.
 */

/** Default unit by format. Applied ONLY at creation — see setFormat. */
const UNIT_BY_FORMAT: Record<Format, ProgressUnit> = {
  book: 'page',
  novel: 'chapter',
  manhwa: 'chapter',
};

/** SCHEMA §1: the trash holds a soft-deleted record for thirty days. */
export const TRASH_DAYS = 30;

// ── reading ───────────────────────────────────────────────────────────────

/** The library. Excludes the trash, and excludes the wishlist by default —
 *  a wishlist entry is not something you own (SCHEMA §9.4: never inflate). */
export async function listLibrary(opts: { includeWishlist?: boolean } = {}): Promise<Work[]> {
  const all = await db.work.filter((w) => !w.deletedAt).toArray();
  return opts.includeWishlist ? all : all.filter((w) => w.status !== 'wishlist');
}

export async function listByFormat(format: Format): Promise<Work[]> {
  const rows = await db.work.where('format').equals(format).toArray();
  return rows.filter((w) => !w.deletedAt && w.status !== 'wishlist');
}

export async function listWishlist(): Promise<Work[]> {
  const rows = await db.work.where('status').equals('wishlist').toArray();
  return rows.filter((w) => !w.deletedAt);
}

export async function listTrash(): Promise<Work[]> {
  return (await db.work.filter((w) => !!w.deletedAt).toArray()).sort((a, b) =>
    (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''),
  );
}

export const getWork = (id: string) => db.work.get(id);

/**
 * Works currently being read, in the order the Continue strip wants them:
 * whatever was touched most recently. `caught_up` is included because a
 * caught-up serial is still an open book — you are waiting for chapters, not
 * finished with it.
 */
export async function listContinuing(): Promise<Work[]> {
  const rows = await db.work.filter((w) => !w.deletedAt).toArray();
  return rows
    .filter((w) => w.status === 'reading' || w.status === 'caught_up')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function countsByFormat(): Promise<Record<Format, number>> {
  const rows = await listLibrary();
  const out: Record<Format, number> = { book: 0, novel: 0, manhwa: 0 };
  for (const w of rows) out[w.format]++;
  return out;
}

export interface GenreStat {
  index: GenreIndex;
  name: string;
  count: number;
}

export interface LibraryStats {
  year: number;
  finishedThisYear: number;
  chaptersRead: number;
  yearsTracked: number;
  libraryTotal: number;
  readingNow: number;
  caughtUp: number;
  wishlistTotal: number;
  dropped: number;
  genres: { all: GenreStat[]; finished: GenreStat[] };
  seriesStarted: number;
  seriesCompleted: number;
  seriesOneAway: number;
  mostReadAuthor?: { name: string; count: number };
  authorsInLibrary: number;
  finishing?: { finished: number; dropped: number; open: number };
  priorYears: { year: number; finished: number }[];
}

function genreStats(works: Work[]): GenreStat[] {
  const counts = new Map<GenreIndex, number>();
  for (const work of works) {
    for (const index of new Set(work.genres)) counts.set(index, (counts.get(index) ?? 0) + 1);
  }
  return GENRES.map((genre) => ({
    index: genre.colorIndex,
    name: genre.name,
    count: counts.get(genre.colorIndex) ?? 0,
  })).filter((genre) => genre.count > 0);
}

function percentageSplit(counts: readonly number[]): number[] {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (!total) return counts.map(() => 0);
  const exact = counts.map((count) => (count / total) * 100);
  const result = exact.map(Math.floor);
  const remaining = 100 - result.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  for (let index = 0; index < remaining; index++) result[order[index]!.index]!++;
  return result;
}

/**
 * Phase 9's complete statistics snapshot. Every row is read inside one Dexie
 * transaction so a status change cannot land in one figure but miss another.
 * Wishlist records never inflate library counts; sessions are the sole source
 * for chapters read; calendar questions use local time.
 */
export async function libraryStats(now = new Date()): Promise<LibraryStats> {
  return db.transaction(
    'r',
    db.work,
    db.author,
    db.series,
    db.readingSession,
    db.settings,
    async () => {
      const [allWorks, authors, seriesRows, sessions, settings] = await Promise.all([
        db.work.filter((work) => !work.deletedAt).toArray(),
        db.author.toArray(),
        db.series.toArray(),
        db.readingSession.toArray(),
        db.settings.get('singleton'),
      ]);
      const library = allWorks.filter((work) => work.status !== 'wishlist');
      const finished = library.filter((work) => work.status === 'finished');
      const year = now.getFullYear();

      const finishedBySeries = new Map<string, number>();
      const startedSeries = new Set<string>();
      for (const work of library) {
        if (!work.seriesId) continue;
        startedSeries.add(work.seriesId);
        if (work.status === 'finished') {
          finishedBySeries.set(work.seriesId, (finishedBySeries.get(work.seriesId) ?? 0) + 1);
        }
      }
      const relevantSeries = seriesRows.filter((series) => startedSeries.has(series.id));

      const authorById = new Map(authors.map((author) => [author.id, author]));
      const authorsInLibrary = new Set(library.flatMap((work) => work.authorIds)).size;
      const finishedByAuthor = new Map<string, number>();
      for (const work of finished) {
        for (const authorId of new Set(work.authorIds)) {
          finishedByAuthor.set(authorId, (finishedByAuthor.get(authorId) ?? 0) + 1);
        }
      }
      const mostRead = [...finishedByAuthor]
        .map(([id, count]) => ({ author: authorById.get(id), count }))
        .filter((row): row is { author: Author; count: number } => !!row.author)
        .sort(
          (left, right) =>
            right.count - left.count || left.author.sortName.localeCompare(right.author.sortName),
        )[0];

      const priorYearCounts = new Map<number, number>();
      for (const work of finished) {
        if (!work.dateFinished) continue;
        const finishedYear = localYear(work.dateFinished);
        if (Number.isNaN(finishedYear) || finishedYear >= year) continue;
        priorYearCounts.set(finishedYear, (priorYearCounts.get(finishedYear) ?? 0) + 1);
      }

      const finishedCount = finished.length;
      const droppedCount = library.filter((work) => work.status === 'dropped').length;
      const openCount = library.filter(
        (work) => work.status === 'reading' || work.status === 'caught_up',
      ).length;
      const finishingTotal = finishedCount + droppedCount + openCount;
      const finishing = finishingTotal
        ? percentageSplit([finishedCount, droppedCount, openCount])
        : undefined;

      return {
        year,
        finishedThisYear: finished.filter(
          (work) => work.dateFinished && localYear(work.dateFinished) === year,
        ).length,
        chaptersRead: sessions
          .filter((session) => session.unit === 'chapter')
          .reduce((sum, session) => sum + session.delta, 0),
        yearsTracked: settings?.firstTrackedAt ? yearsTracked(settings.firstTrackedAt, now) : 0,
        libraryTotal: library.length,
        readingNow: library.filter((work) => work.status === 'reading').length,
        caughtUp: library.filter((work) => work.status === 'caught_up').length,
        wishlistTotal: allWorks.filter((work) => work.status === 'wishlist').length,
        dropped: droppedCount,
        genres: { all: genreStats(library), finished: genreStats(finished) },
        seriesStarted: relevantSeries.length,
        seriesCompleted: relevantSeries.filter(
          (series) =>
            series.totalEntriesKnown !== undefined &&
            (finishedBySeries.get(series.id) ?? 0) >= series.totalEntriesKnown,
        ).length,
        seriesOneAway: relevantSeries.filter(
          (series) =>
            series.totalEntriesKnown !== undefined &&
            series.totalEntriesKnown - (finishedBySeries.get(series.id) ?? 0) === 1,
        ).length,
        ...(mostRead
          ? { mostReadAuthor: { name: mostRead.author.name, count: mostRead.count } }
          : {}),
        authorsInLibrary,
        ...(finishing
          ? { finishing: { finished: finishing[0]!, dropped: finishing[1]!, open: finishing[2]! } }
          : {}),
        priorYears: [...priorYearCounts]
          .map(([pastYear, count]) => ({ year: pastYear, finished: count }))
          .sort((left, right) => right.year - left.year),
      };
    },
  );
}

// ── authors, series, universes, tags ──────────────────────────────────────

/**
 * Finds an author by name or creates one. Matching is on the sort name so
 * "Pierce Brown" typed twice does not become two people; it is deliberately not
 * fuzzy, because merging two authors who really are different is worse than
 * listing one twice, and the second is visible while the first is not.
 */
export async function authorByName(name: string): Promise<Author> {
  const clean = name.trim();
  const sortName = sortNameOf(clean);
  const existing = await db.author.where('sortName').equals(sortName).first();
  if (existing) return existing;
  const author: Author = { id: newId(), name: clean, sortName, externalIds: {} };
  await db.author.add(author);
  return author;
}

export async function authorNames(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db.author.bulkGet(ids);
  return rows.filter((a): a is Author => !!a).map((a) => a.name);
}

export async function seriesByName(name: string): Promise<Series> {
  const clean = name.trim();
  const sortName = sortTitleOf(clean);
  const existing = await db.series.where('sortName').equals(sortName).first();
  if (existing) return existing;
  const series: Series = {
    id: newId(),
    name: clean,
    sortName,
    source: 'user',
    externalIds: {},
    updatedAt: nowIso(),
  };
  await db.series.add(series);
  return series;
}

export async function universeByName(name: string): Promise<Universe> {
  const clean = name.trim();
  const existing = await db.universe.where('name').equals(clean).first();
  if (existing) return existing;
  const universe: Universe = {
    id: newId(),
    name: clean,
    source: 'user',
    externalIds: {},
    updatedAt: nowIso(),
  };
  await db.universe.add(universe);
  return universe;
}

export const listSeries = (): Promise<Series[]> => db.series.orderBy('sortName').toArray();
export const getSeries = (id: string): Promise<Series | undefined> => db.series.get(id);
export const getUniverse = (id: string): Promise<Universe | undefined> => db.universe.get(id);

export async function listUniverses(): Promise<Universe[]> {
  return (await db.universe.toArray()).sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }),
  );
}

export async function listWorksInSeries(seriesId: string): Promise<Work[]> {
  return (await db.work.where('seriesId').equals(seriesId).toArray())
    .filter((work) => !work.deletedAt)
    .sort(
      (left, right) =>
        (left.seriesPosition ?? Number.POSITIVE_INFINITY) -
          (right.seriesPosition ?? Number.POSITIVE_INFINITY) ||
        left.sortTitle.localeCompare(right.sortTitle),
    );
}

export async function listSeriesInUniverse(universeId: string): Promise<Series[]> {
  return db.series.where('universeId').equals(universeId).sortBy('sortName');
}

export async function updateSeries(
  id: string,
  changes: { name?: string; totalEntriesKnown?: number },
): Promise<Series> {
  const current = await db.series.get(id);
  if (!current) throw new Error(`Series ${id} does not exist.`);
  const patch: Partial<Series> = { updatedAt: nowIso() };
  if (changes.name !== undefined) {
    const name = changes.name.trim();
    if (!name) throw new Error('A series name cannot be empty.');
    patch.name = name;
    patch.sortName = sortTitleOf(name);
  }
  if (changes.totalEntriesKnown !== undefined) {
    if (!Number.isInteger(changes.totalEntriesKnown) || changes.totalEntriesKnown < 1) {
      throw new Error('A known series total must be a positive whole number.');
    }
    patch.totalEntriesKnown = changes.totalEntriesKnown;
  }
  await db.series.update(id, patch);
  return (await db.series.get(id))!;
}

export async function updateUniverse(
  id: string,
  changes: { name?: string; description?: string; readingOrderNote?: string },
): Promise<Universe> {
  const current = await db.universe.get(id);
  if (!current) throw new Error(`Universe ${id} does not exist.`);
  const patch: Partial<Universe> = { updatedAt: nowIso() };
  if (changes.name !== undefined) {
    const name = changes.name.trim();
    if (!name) throw new Error('A universe name cannot be empty.');
    patch.name = name;
  }
  if (changes.description !== undefined)
    patch.description = changes.description.trim() || undefined;
  if (changes.readingOrderNote !== undefined) {
    patch.readingOrderNote = changes.readingOrderNote.trim() || undefined;
  }
  await db.universe.update(id, patch);
  return (await db.universe.get(id))!;
}

function corpusExternalId(id: string): Series['externalIds'] {
  const wikidata = id.match(/^series:wikidata:(.+)$/)?.[1];
  const openLibrary = id.match(/^series:openlibrary:(.+)$/)?.[1];
  return { ...(wikidata ? { wikidata } : {}), ...(openLibrary ? { openLibrary } : {}) };
}

/**
 * The only write path from a series suggestion. Resolution itself is pure;
 * this transaction begins only after the reader explicitly chooses Group.
 */
export async function confirmSeriesSuggestion(
  workId: string,
  suggestion: SeriesSuggestion,
): Promise<{ work: Work; series: Series }> {
  return db.transaction(
    'rw',
    db.work,
    db.series,
    db.readingOrder,
    db.readingOrderEntry,
    async () => {
      const work = await db.work.get(workId);
      if (!work) throw new Error(`Work ${workId} does not exist.`);
      const sortName = sortTitleOf(suggestion.name);
      let series = suggestion.existingSeriesId
        ? await db.series.get(suggestion.existingSeriesId)
        : undefined;
      if (!series && suggestion.corpusSeriesId)
        series = await db.series.get(suggestion.corpusSeriesId);
      if (!series) series = await db.series.where('sortName').equals(sortName).first();
      if (!series) {
        series = {
          id: suggestion.corpusSeriesId ?? newId(),
          name: suggestion.name.trim(),
          sortName,
          totalEntriesKnown: suggestion.totalEntriesKnown,
          source: suggestion.source === 'corpus' ? 'corpus' : 'user',
          externalIds: suggestion.corpusSeriesId ? corpusExternalId(suggestion.corpusSeriesId) : {},
          updatedAt: nowIso(),
        };
        if (!series.name) throw new Error('A series suggestion must have a name.');
        await db.series.add(series);
      }
      await db.work.update(workId, {
        seriesId: series.id,
        seriesPosition: suggestion.position,
        updatedAt: nowIso(),
      });

      // Preserve the source-stated sequence as a named order with ghost
      // entries. This is not a claim that the sequence is complete, and it does
      // not add any missing work to the library.
      if (suggestion.source === 'corpus' && suggestion.catalogueEntries.length) {
        const orders = await db.readingOrder
          .where('[contextType+contextId]')
          .equals(['series', series.id])
          .toArray();
        if (!orders.some((order) => sortTitleOf(order.name) === 'publication order')) {
          const order: ReadingOrder = {
            id: newId(),
            contextType: 'series',
            contextId: series.id,
            name: 'Publication order',
            description: 'Catalogue-known sequence; missing positions remain visible.',
            source: 'corpus',
            updatedAt: nowIso(),
          };
          const localWorks = await db.work.toArray();
          const byCorpusId = new Map(
            localWorks.filter((entry) => entry.corpusId).map((entry) => [entry.corpusId!, entry]),
          );
          const entries = suggestion.catalogueEntries.map((entry, index): ReadingOrderEntry => {
            const local = byCorpusId.get(entry.corpusId);
            return {
              id: newId(),
              orderId: order.id,
              position: index + 1,
              kind: 'work',
              label: entry.title,
              workId: local?.id,
              corpusId: entry.corpusId,
            };
          });
          await db.readingOrder.add(order);
          await db.readingOrderEntry.bulkAdd(entries);
        }
      }

      const saved = await db.work.get(workId);
      if (!saved) throw new Error(`Work ${workId} disappeared while joining a series.`);
      return { work: saved, series };
    },
  );
}

/** Universe confirmation stays separate from series confirmation by design. */
export async function confirmUniverseSuggestion(
  workId: string,
  suggestion: UniverseSuggestion,
): Promise<{ work: Work; universe: Universe }> {
  return db.transaction('rw', db.work, db.series, db.universe, async () => {
    const work = await db.work.get(workId);
    if (!work) throw new Error(`Work ${workId} does not exist.`);
    let universe = await db.universe.get(suggestion.corpusUniverseId);
    if (!universe) {
      const normalized = sortTitleOf(suggestion.name);
      universe = (await db.universe.toArray()).find(
        (entry) => sortTitleOf(entry.name) === normalized,
      );
    }
    if (!universe) {
      const wikidata = suggestion.corpusUniverseId.match(/^universe:wikidata:(.+)$/)?.[1];
      universe = {
        id: suggestion.corpusUniverseId,
        name: suggestion.name.trim(),
        description: suggestion.description,
        source: 'corpus',
        externalIds: wikidata ? { wikidata } : {},
        updatedAt: nowIso(),
      };
      if (!universe.name) throw new Error('A universe suggestion must have a name.');
      await db.universe.add(universe);
    }
    await db.work.update(workId, { universeId: universe.id, updatedAt: nowIso() });
    if (work.seriesId) {
      await db.series.update(work.seriesId, { universeId: universe.id, updatedAt: nowIso() });
    }
    const saved = await db.work.get(workId);
    if (!saved) throw new Error(`Work ${workId} disappeared while joining a universe.`);
    return { work: saved, universe };
  });
}

export interface BulkWishlistResult {
  added: Work[];
  /** Existing rows are left exactly as the reader set them, including Trash. */
  skippedCorpusIds: string[];
}

/**
 * Explicit "Add whole series" write path. Missing catalogue entries enter the
 * Wishlist, never Reading, and the entire batch rolls back if any row cannot
 * be represented honestly (for example, a missing format hint).
 */
export async function addSeriesEntriesToWishlist(
  seriesId: string,
  entries: CorpusRelationshipEntry[],
  universeId?: string,
): Promise<BulkWishlistResult> {
  return db.transaction(
    'rw',
    db.work,
    db.author,
    db.series,
    db.universe,
    db.readingOrderEntry,
    async () => {
      if (!(await db.series.get(seriesId))) throw new Error(`Series ${seriesId} does not exist.`);
      if (universeId && !(await db.universe.get(universeId))) {
        throw new Error(`Universe ${universeId} does not exist.`);
      }

      const existing = await db.work.toArray();
      const existingCorpusIds = new Set(existing.map((work) => work.corpusId).filter(Boolean));
      const batchCorpusIds = new Set<string>();
      const toAdd: CorpusRelationshipEntry[] = [];
      const skippedCorpusIds: string[] = [];
      for (const entry of entries) {
        if (existingCorpusIds.has(entry.corpusId) || batchCorpusIds.has(entry.corpusId)) {
          skippedCorpusIds.push(entry.corpusId);
          continue;
        }
        if (!entry.formatHint) {
          throw new Error(`"${entry.title}" needs a shelf choice before the series can be added.`);
        }
        batchCorpusIds.add(entry.corpusId);
        toAdd.push(entry);
      }

      const added: Work[] = [];
      for (const entry of toAdd) {
        const authorIds: string[] = [];
        for (const name of entry.authors) {
          const clean = name.trim();
          if (!clean) continue;
          const key = sortNameOf(clean);
          let author = await db.author.where('sortName').equals(key).first();
          if (!author) {
            author = { id: newId(), name: clean, sortName: key, externalIds: {} };
            await db.author.add(author);
          }
          if (!authorIds.includes(author.id)) authorIds.push(author.id);
        }

        const now = nowIso();
        const openLibraryWork = entry.corpusId.startsWith('openlibrary:')
          ? entry.corpusId.slice('openlibrary:'.length)
          : undefined;
        const format = entry.formatHint!;
        const coverRemoteUrl = catalogueCoverUrl(entry);
        const created: Work = {
          id: newId(),
          title: entry.title.trim(),
          sortTitle: sortTitleOf(entry.title),
          format,
          authorIds,
          seriesId,
          seriesPosition: entry.seriesPosition,
          universeId,
          status: 'wishlist',
          publicationStatus: entry.publicationStatus ?? 'unknown',
          progressUnit: UNIT_BY_FORMAT[format],
          progressCurrent: 0,
          progressTotal: format === 'book' ? undefined : (entry.chapterCount ?? entry.volumeCount),
          coverSource: 'none',
          coverRemoteUrl,
          tagIds: [],
          genres: [],
          isTranslated: false,
          dateAdded: now,
          externalIds: openLibraryWork ? { openLibraryWork } : {},
          corpusId: entry.corpusId,
          isManualEntry: false,
          updatedAt: now,
        };
        await db.work.add(created);
        await db.readingOrderEntry
          .where('corpusId')
          .equals(entry.corpusId)
          .modify({ workId: created.id });
        added.push(created);
      }
      return { added, skippedCorpusIds };
    },
  );
}

export async function linkSeriesToUniverse(
  seriesId: string,
  universeId: string | undefined,
): Promise<Series> {
  return db.transaction('rw', db.series, db.universe, db.work, async () => {
    const series = await db.series.get(seriesId);
    if (!series) throw new Error(`Series ${seriesId} does not exist.`);
    if (universeId && !(await db.universe.get(universeId))) {
      throw new Error(`Universe ${universeId} does not exist.`);
    }
    await db.series.update(seriesId, { universeId, updatedAt: nowIso() });
    await db.work.where('seriesId').equals(seriesId).modify({ universeId, updatedAt: nowIso() });
    return (await db.series.get(seriesId))!;
  });
}

export function setUniverse(id: string, universeId: string | undefined): Promise<Work> {
  return patch(id, { universeId });
}

/**
 * Finds a tag by its normalised name or creates one.
 *
 * `normalizedName` is a UNIQUE index, so a race between two callers creating
 * the same tag throws rather than producing a duplicate. That throw is caught
 * and re-read rather than propagated: the caller asked for the tag to exist,
 * and it now does.
 */
export async function tagByName(name: string, source: Tag['source'] = 'user'): Promise<Tag> {
  const clean = name.trim();
  const normalizedName = normalizeTag(clean);
  const existing = await db.tag.where('normalizedName').equals(normalizedName).first();
  if (existing) return existing;
  const tag: Tag = {
    id: newId(),
    name: clean,
    normalizedName,
    source,
    groups: TAG_GROUP_MEMBERSHIP.get(clean) ?? [],
    usageCount: 0,
  };
  try {
    await db.tag.add(tag);
    return tag;
  } catch {
    const raced = await db.tag.where('normalizedName').equals(normalizedName).first();
    if (raced) return raced;
    throw new Error(`Could not create or find the tag "${clean}".`);
  }
}

/** Recomputes usageCount from the works that actually reference each tag.
 *  Denormalised counters drift; this is the one place that repairs them. */
export async function refreshTagCounts(): Promise<void> {
  const [works, notes] = await Promise.all([
    db.work.filter((w) => !w.deletedAt).toArray(),
    db.note.filter((note) => !note.deletedAt).toArray(),
  ]);
  const counts = new Map<string, number>();
  for (const w of works) for (const id of w.tagIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const note of notes) for (const id of note.tagIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  const tags = await db.tag.toArray();
  await db.tag.bulkPut(tags.map((t) => ({ ...t, usageCount: counts.get(t.id) ?? 0 })));
}

export interface TagMaintenanceRow {
  tag: Tag;
  /** Active works and notes, matching the denormalised usage count. */
  activeUses: number;
  /** Soft-deleted records still retain their tags for a lossless restore. */
  trashUses: number;
}

/**
 * Settings needs the difference between "unused" and "only used in Trash".
 * Deleting the latter would quietly change a record that can still be restored,
 * so the maintenance screen only offers deletion when both counts are zero.
 */
export async function listTagsForMaintenance(): Promise<TagMaintenanceRow[]> {
  const [tags, works, notes] = await Promise.all([
    db.tag.toArray(),
    db.work.toArray(),
    db.note.toArray(),
  ]);
  const active = new Map<string, number>();
  const trash = new Map<string, number>();
  const count = (ids: string[], target: Map<string, number>) => {
    for (const id of ids) target.set(id, (target.get(id) ?? 0) + 1);
  };
  for (const work of works) count(work.tagIds, work.deletedAt ? trash : active);
  for (const note of notes) count(note.tagIds, note.deletedAt ? trash : active);
  return tags
    .map((tag) => ({
      tag,
      activeUses: active.get(tag.id) ?? 0,
      trashUses: trash.get(tag.id) ?? 0,
    }))
    .sort(
      (left, right) =>
        right.activeUses - left.activeUses || left.tag.name.localeCompare(right.tag.name),
    );
}

export type RenameTagResult = { kind: 'renamed'; tag: Tag } | { kind: 'merged'; tag: Tag };

/** Rename a tag, or merge it into the existing exact destination name. */
export async function renameOrMergeTag(id: string, name: string): Promise<RenameTagResult> {
  const clean = name.trim();
  if (!clean) throw new Error('A tag needs a name.');
  return db.transaction('rw', db.tag, db.work, db.note, async () => {
    const source = await db.tag.get(id);
    if (!source) throw new Error('That tag no longer exists.');
    const normalizedName = normalizeTag(clean);
    const destination = await db.tag.where('normalizedName').equals(normalizedName).first();

    if (!destination || destination.id === source.id) {
      const updated: Tag = { ...source, name: clean, normalizedName };
      await db.tag.put(updated);
      return { kind: 'renamed', tag: updated };
    }

    const replace = (tagIds: string[]) => [
      ...new Set(tagIds.map((tagId) => (tagId === source.id ? destination.id : tagId))),
    ];
    await db.work
      .filter((work) => work.tagIds.includes(source.id))
      .modify((work) => {
        work.tagIds = replace(work.tagIds);
        work.updatedAt = nowIso();
      });
    await db.note
      .filter((note) => note.tagIds.includes(source.id))
      .modify((note) => {
        note.tagIds = replace(note.tagIds);
        note.updatedAt = nowIso();
      });
    await db.tag.update(destination.id, {
      groups: [...new Set([...destination.groups, ...source.groups])],
    });
    await db.tag.delete(source.id);
    await refreshTagCounts();
    const merged = await db.tag.get(destination.id);
    if (!merged) throw new Error('The destination tag disappeared during the merge.');
    return { kind: 'merged', tag: merged };
  });
}

/** Delete only a genuinely unreferenced tag; Trash references also count. */
export async function deleteUnusedTag(id: string): Promise<void> {
  await db.transaction('rw', db.tag, db.work, db.note, async () => {
    const tag = await db.tag.get(id);
    if (!tag) throw new Error('That tag no longer exists.');
    const [workUse, noteUse] = await Promise.all([
      db.work.filter((work) => work.tagIds.includes(id)).count(),
      db.note.filter((note) => note.tagIds.includes(id)).count(),
    ]);
    if (workUse + noteUse > 0) {
      throw new Error('This tag is still attached to something.');
    }
    await db.tag.delete(id);
  });
}

// ── creating a work ───────────────────────────────────────────────────────

export interface NewWorkInput {
  title: string;
  authorName?: string;
  format: Format;
  status: ReadingStatus;
  publicationStatus?: PublicationStatus;
  progressUnit?: ProgressUnit;
  progressCurrent?: number;
  progressTotal?: number;
  rating?: number;
  genres?: GenreIndex[];
  tagIds?: string[];
  tagNames?: string[];
  corpusId?: string;
  externalIds?: ExternalIds;
  coverRemoteUrl?: string;
}

export async function createWork(input: NewWorkInput): Promise<Work> {
  return (await createWorks([input]))[0]!;
}

/**
 * The one constructor for manual, catalogue, pasted-list, and CSV additions.
 * A batch shares one transaction so a malformed late row cannot leave the
 * first rows behind.
 */
export async function createWorks(inputs: NewWorkInput[]): Promise<Work[]> {
  if (inputs.some((input) => !input.title.trim()))
    throw new Error('Every imported work needs a title.');
  return db.transaction('rw', db.work, db.author, db.tag, db.note, async () => {
    const works: Work[] = [];
    for (const input of inputs) {
      const now = nowIso();
      const authorIds = input.authorName?.trim() ? [(await authorByName(input.authorName)).id] : [];
      const namedTagIds = await Promise.all((input.tagNames ?? []).map((name) => tagByName(name)));
      const tagIds = [...new Set([...(input.tagIds ?? []), ...namedTagIds.map((tag) => tag.id)])];
      const work: Work = {
        id: newId(),
        title: input.title.trim(),
        sortTitle: sortTitleOf(input.title),
        format: input.format,
        authorIds,
        status: input.status,
        publicationStatus: input.publicationStatus ?? 'unknown',
        progressUnit: input.progressUnit ?? UNIT_BY_FORMAT[input.format],
        progressCurrent: input.progressCurrent ?? 0,
        // A URL is only a download lead. The source becomes `api` after the
        // decoded, downscaled image has been committed to OPFS and its pointer
        // is durable; until then the honest state is still no local cover.
        coverSource: 'none',
        tagIds,
        genres: (input.genres ?? []).slice(0, 2),
        isTranslated: false,
        dateAdded: now,
        externalIds: input.externalIds ?? {},
        isManualEntry: !input.corpusId,
        updatedAt: now,
      };
      if (input.progressTotal !== undefined) work.progressTotal = input.progressTotal;
      if (input.rating !== undefined) work.rating = input.rating;
      if (input.corpusId) work.corpusId = input.corpusId;
      if (input.coverRemoteUrl) work.coverRemoteUrl = input.coverRemoteUrl;
      if (input.status === 'reading') work.dateStarted = now;
      if (input.status === 'finished') work.dateFinished = now;
      if (input.status === 'dropped') work.dateDropped = now;
      await db.work.add(work);
      works.push(work);
    }
    if (works.some((work) => work.tagIds.length)) await refreshTagCounts();
    return works;
  });
}

// ── editing a work ────────────────────────────────────────────────────────

async function patch(id: string, changes: Partial<Work>): Promise<Work> {
  await db.work.update(id, { ...changes, updatedAt: nowIso() });
  const after = await db.work.get(id);
  if (!after) throw new Error(`Work ${id} disappeared during an update.`);
  return after;
}

/** Retitling also rebuilds the sort key. These two must never be set apart. */
export function setTitle(id: string, title: string): Promise<Work> {
  const clean = title.trim();
  return patch(id, { title: clean, sortTitle: sortTitleOf(clean) });
}

export async function setAuthor(id: string, name: string): Promise<Work> {
  const clean = name.trim();
  if (!clean) return patch(id, { authorIds: [] });
  const author = await authorByName(clean);
  return patch(id, { authorIds: [author.id] });
}

/**
 * The shelf a work sits on. SCHEMA §1 is explicit that this is decided by how
 * the work is READ, is editable in one tap, and is never auto-corrected.
 *
 * So it does NOT touch progressUnit. Moving a web novel from Books to Novels
 * must not silently turn its page count into a chapter count — the number on
 * screen would change meaning without changing value, which is the worst kind
 * of quiet edit. The unit is a separate control on the same sheet.
 */
export function setFormat(id: string, format: Format): Promise<Work> {
  return patch(id, { format });
}

export function setProgressUnit(id: string, progressUnit: ProgressUnit): Promise<Work> {
  return patch(id, { progressUnit });
}

/** `undefined` clears the total, which is a real state: no bar, no percentage. */
export function setProgressTotal(id: string, total: number | undefined): Promise<Work> {
  return patch(id, { progressTotal: total === undefined || total <= 0 ? undefined : total });
}

/**
 * Sets the position directly. Unlike a logged session this may go backwards —
 * it is the correction path, and without it a mis-tapped session is permanent.
 * It records no session, because nothing was read.
 */
export function setProgressCurrent(id: string, current: number): Promise<Work> {
  return patch(id, { progressCurrent: Math.max(0, Math.floor(current)) });
}

export function setPublicationStatus(id: string, publicationStatus: PublicationStatus) {
  return patch(id, { publicationStatus });
}

export function setGenres(id: string, genres: GenreIndex[]): Promise<Work> {
  // At most two, primary first (taxonomy §4). Enforced here rather than at the
  // picker, so no other caller can write a third.
  return patch(id, { genres: genres.slice(0, 2) });
}

export async function setTags(id: string, tagIds: string[]): Promise<Work> {
  const w = await patch(id, { tagIds });
  await refreshTagCounts();
  return w;
}

export async function setSeries(
  id: string,
  series: { seriesId?: string; seriesPosition?: number },
): Promise<Work> {
  // Clearing the series must clear the position with it. A position with no
  // series renders as "#3" of nothing.
  return series.seriesId
    ? patch(id, series)
    : patch(id, { seriesId: undefined, seriesPosition: undefined });
}

export async function deleteSeries(id: string): Promise<void> {
  await db.transaction(
    'rw',
    db.series,
    db.work,
    db.readingOrder,
    db.readingOrderEntry,
    async () => {
      if (!(await db.series.get(id))) return;
      const contextOrders = await db.readingOrder
        .where('[contextType+contextId]')
        .equals(['series', id])
        .toArray();
      const orderIds = contextOrders.map((order) => order.id);
      for (const orderId of orderIds)
        await db.readingOrderEntry.where('orderId').equals(orderId).delete();
      await db.readingOrder.bulkDelete(orderIds);
      await db.readingOrderEntry.where('seriesId').equals(id).modify({ seriesId: undefined });
      await db.work
        .where('seriesId')
        .equals(id)
        .modify((work) => {
          work.seriesId = undefined;
          work.seriesPosition = undefined;
          work.updatedAt = nowIso();
        });
      await db.series.delete(id);
    },
  );
}

export async function deleteUniverse(id: string): Promise<void> {
  await db.transaction(
    'rw',
    db.universe,
    db.series,
    db.work,
    db.readingOrder,
    db.readingOrderEntry,
    async () => {
      if (!(await db.universe.get(id))) return;
      const contextOrders = await db.readingOrder
        .where('[contextType+contextId]')
        .equals(['universe', id])
        .toArray();
      for (const order of contextOrders) {
        await db.readingOrderEntry.where('orderId').equals(order.id).delete();
      }
      await db.readingOrder.bulkDelete(contextOrders.map((order) => order.id));
      await db.series
        .where('universeId')
        .equals(id)
        .modify((series) => {
          series.universeId = undefined;
          series.updatedAt = nowIso();
        });
      await db.work
        .where('universeId')
        .equals(id)
        .modify((work) => {
          work.universeId = undefined;
          work.updatedAt = nowIso();
        });
      await db.universe.delete(id);
    },
  );
}

export interface NewReadingOrderEntry {
  kind: 'work' | 'series';
  label: string;
  workId?: string;
  seriesId?: string;
  corpusId?: string;
  note?: string;
}

async function validateOrderEntries(entries: NewReadingOrderEntry[]): Promise<void> {
  for (const entry of entries) {
    if (!entry.label.trim()) throw new Error('A reading-order entry must have a label.');
    if (entry.kind === 'work') {
      if (entry.seriesId || (!entry.workId && !entry.corpusId)) {
        throw new Error('A work order entry needs a local work or catalogue identity.');
      }
      if (entry.workId && !(await db.work.get(entry.workId))) {
        throw new Error(`Work ${entry.workId} does not exist.`);
      }
    } else {
      if (entry.workId || (!entry.seriesId && !entry.corpusId)) {
        throw new Error('A series order entry needs a local series or catalogue identity.');
      }
      if (entry.seriesId && !(await db.series.get(entry.seriesId))) {
        throw new Error(`Series ${entry.seriesId} does not exist.`);
      }
    }
  }
}

function storedOrderEntries(orderId: string, entries: NewReadingOrderEntry[]): ReadingOrderEntry[] {
  return entries.map((entry, index) => ({
    id: newId(),
    orderId,
    position: index + 1,
    kind: entry.kind,
    label: entry.label.trim(),
    workId: entry.workId,
    seriesId: entry.seriesId,
    corpusId: entry.corpusId,
    note: entry.note?.trim() || undefined,
  }));
}

export async function createReadingOrder(
  input: {
    contextType: ReadingOrder['contextType'];
    contextId: string;
    name: string;
    description?: string;
    source?: ReadingOrder['source'];
  },
  entries: NewReadingOrderEntry[],
): Promise<{ order: ReadingOrder; entries: ReadingOrderEntry[] }> {
  return db.transaction(
    'rw',
    db.readingOrder,
    db.readingOrderEntry,
    db.series,
    db.universe,
    db.work,
    async () => {
      const name = input.name.trim();
      if (!name) throw new Error('A reading order must have a name.');
      const contextExists =
        input.contextType === 'series'
          ? await db.series.get(input.contextId)
          : await db.universe.get(input.contextId);
      if (!contextExists) {
        throw new Error(`${input.contextType} ${input.contextId} does not exist.`);
      }
      const duplicates = await db.readingOrder
        .where('[contextType+contextId]')
        .equals([input.contextType, input.contextId])
        .toArray();
      if (duplicates.some((order) => sortTitleOf(order.name) === sortTitleOf(name))) {
        throw new Error(`A reading order named "${name}" already exists here.`);
      }
      await validateOrderEntries(entries);
      const order: ReadingOrder = {
        id: newId(),
        contextType: input.contextType,
        contextId: input.contextId,
        name,
        description: input.description?.trim() || undefined,
        source: input.source ?? 'user',
        updatedAt: nowIso(),
      };
      const stored = storedOrderEntries(order.id, entries);
      await db.readingOrder.add(order);
      await db.readingOrderEntry.bulkAdd(stored);
      return { order, entries: stored };
    },
  );
}

export async function listReadingOrders(
  contextType: ReadingOrder['contextType'],
  contextId: string,
): Promise<ReadingOrder[]> {
  return db.readingOrder
    .where('[contextType+contextId]')
    .equals([contextType, contextId])
    .sortBy('name');
}

export function getReadingOrderEntries(orderId: string): Promise<ReadingOrderEntry[]> {
  return db.readingOrderEntry.where('orderId').equals(orderId).sortBy('position');
}

export async function updateReadingOrder(
  id: string,
  changes: { name?: string; description?: string },
): Promise<ReadingOrder> {
  const order = await db.readingOrder.get(id);
  if (!order) throw new Error(`Reading order ${id} does not exist.`);
  const patch: Partial<ReadingOrder> = { updatedAt: nowIso() };
  if (changes.name !== undefined) {
    const name = changes.name.trim();
    if (!name) throw new Error('A reading order must have a name.');
    const peers = await listReadingOrders(order.contextType, order.contextId);
    if (peers.some((peer) => peer.id !== id && sortTitleOf(peer.name) === sortTitleOf(name))) {
      throw new Error(`A reading order named "${name}" already exists here.`);
    }
    patch.name = name;
  }
  if (changes.description !== undefined)
    patch.description = changes.description.trim() || undefined;
  await db.readingOrder.update(id, patch);
  return (await db.readingOrder.get(id))!;
}

/**
 * Saves a named order and its sequence as one fact. The editor must never leave
 * a renamed order paired with the old sequence when the second write fails.
 */
export async function saveReadingOrder(
  id: string,
  changes: { name: string; description?: string },
  entries: NewReadingOrderEntry[],
): Promise<{ order: ReadingOrder; entries: ReadingOrderEntry[] }> {
  return db.transaction(
    'rw',
    db.readingOrder,
    db.readingOrderEntry,
    db.series,
    db.work,
    async () => {
      const order = await db.readingOrder.get(id);
      if (!order) throw new Error(`Reading order ${id} does not exist.`);
      const name = changes.name.trim();
      if (!name) throw new Error('A reading order must have a name.');
      const peers = await db.readingOrder
        .where('[contextType+contextId]')
        .equals([order.contextType, order.contextId])
        .toArray();
      if (peers.some((peer) => peer.id !== id && sortTitleOf(peer.name) === sortTitleOf(name))) {
        throw new Error(`A reading order named "${name}" already exists here.`);
      }
      await validateOrderEntries(entries);
      const stored = storedOrderEntries(id, entries);
      await db.readingOrder.update(id, {
        name,
        description: changes.description?.trim() || undefined,
        updatedAt: nowIso(),
      });
      await db.readingOrderEntry.where('orderId').equals(id).delete();
      await db.readingOrderEntry.bulkAdd(stored);
      const saved = await db.readingOrder.get(id);
      if (!saved) throw new Error(`Reading order ${id} disappeared during an update.`);
      return { order: saved, entries: stored };
    },
  );
}

export async function replaceReadingOrderEntries(
  orderId: string,
  entries: NewReadingOrderEntry[],
): Promise<ReadingOrderEntry[]> {
  return db.transaction(
    'rw',
    db.readingOrder,
    db.readingOrderEntry,
    db.series,
    db.work,
    async () => {
      if (!(await db.readingOrder.get(orderId))) {
        throw new Error(`Reading order ${orderId} does not exist.`);
      }
      await validateOrderEntries(entries);
      const stored = storedOrderEntries(orderId, entries);
      await db.readingOrderEntry.where('orderId').equals(orderId).delete();
      await db.readingOrderEntry.bulkAdd(stored);
      await db.readingOrder.update(orderId, { updatedAt: nowIso() });
      return stored;
    },
  );
}

export async function deleteReadingOrder(id: string): Promise<void> {
  await db.transaction('rw', db.readingOrder, db.readingOrderEntry, async () => {
    await db.readingOrderEntry.where('orderId').equals(id).delete();
    await db.readingOrder.delete(id);
  });
}

// ── status, the most-used edit in the app ─────────────────────────────────

/**
 * SCHEMA §1: `caught_up` describes a reader who has read everything published
 * so far, which is only a coherent claim about a work that is still being
 * published. Offering it for a finished book would let the library assert
 * something that cannot be true.
 */
export function statusesFor(publicationStatus: PublicationStatus): ReadingStatus[] {
  const base: ReadingStatus[] = ['wishlist', 'reading', 'finished', 'dropped'];
  if (publicationStatus === 'ongoing' || publicationStatus === 'hiatus') {
    return ['wishlist', 'reading', 'caught_up', 'finished', 'dropped'];
  }
  return base;
}

/**
 * Changing the status, and the dates that follow from it.
 *
 * The stamps are set on the way IN and cleared on the way OUT. Clearing matters
 * more than stamping: a work marked finished by mistake and then corrected must
 * lose its `dateFinished`, or it goes on counting toward "finished in 2026"
 * forever — a number the reader would have no way to explain and no way to fix.
 */
export async function setStatus(id: string, status: ReadingStatus): Promise<Work> {
  const w = await db.work.get(id);
  if (!w) throw new Error(`No work ${id}.`);
  if (w.status === status) return w;

  if (!statusesFor(w.publicationStatus).includes(status)) {
    throw new Error(
      `"${status}" is not offered for a work whose publication status is "${w.publicationStatus}".`,
    );
  }

  const now = nowIso();
  const changes: Partial<Work> = { status };

  if (status === 'reading' || status === 'caught_up') {
    if (!w.dateStarted) changes.dateStarted = now;
  }
  if (status === 'finished') {
    changes.dateFinished = now;
    if (!w.dateStarted) changes.dateStarted = now;
  }
  if (status === 'dropped') {
    changes.dateDropped = now;
    changes.dropAtProgress = w.progressCurrent;
  }

  if (w.status === 'finished' && status !== 'finished') changes.dateFinished = undefined;
  if (w.status === 'dropped' && status !== 'dropped') {
    changes.dateDropped = undefined;
    changes.dropReason = undefined;
    changes.dropAtProgress = undefined;
  }

  return db.transaction('rw', db.work, db.axisRating, async () => {
    const updated = await patch(id, changes);
    if (w.status === 'finished' && status !== 'finished') {
      const rating = await db.axisRating.get(id);
      if (rating) {
        delete rating.ending;
        delete rating.endingNone;
        if (hasAxisValue(rating)) await db.axisRating.put(rating);
        else await db.axisRating.delete(id);
      }
    }
    return updated;
  });
}

export function setDropReason(id: string, reason: string): Promise<Work> {
  return patch(id, { dropReason: reason.trim() || undefined });
}

// ── the seven descriptive axes ───────────────────────────────────────────

export type AxisRatingChanges = Partial<Record<AxisKey, AxisScore | undefined>> & {
  endingNone?: boolean | undefined;
};

function isAxisScore(value: unknown): value is AxisScore {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5;
}

function hasAxisValue(rating: AxisRating): boolean {
  return AXIS_KEYS.some((key) => rating[key] !== undefined) || rating.endingNone === true;
}

/**
 * Saves one or more axis choices without manufacturing answers for the rest.
 * Ending and Unfinished are available only after the reader has marked the
 * work Finished, and are mutually exclusive facts.
 */
export async function saveAxisRating(
  workId: string,
  changes: AxisRatingChanges,
): Promise<AxisRating | undefined> {
  return db.transaction('rw', db.work, db.axisRating, async () => {
    const work = await db.work.get(workId);
    if (!work) throw new Error(`No work ${workId}.`);

    for (const key of AXIS_KEYS) {
      const value = changes[key];
      if (value !== undefined && !isAxisScore(value)) {
        throw new Error(`Axis ${key} must be a whole number from 1 to 5.`);
      }
    }
    if (
      work.status !== 'finished' &&
      (changes.ending !== undefined || changes.endingNone === true)
    ) {
      throw new Error('Ending can be set only after the work is marked Finished.');
    }

    const next: AxisRating = { ...(await db.axisRating.get(workId)), workId };
    for (const key of AXIS_KEYS) {
      if (!(key in changes)) continue;
      const value = changes[key];
      if (value === undefined) delete next[key];
      else next[key] = value;
    }
    if ('endingNone' in changes) {
      if (changes.endingNone) next.endingNone = true;
      else delete next.endingNone;
    }
    if (changes.ending !== undefined) delete next.endingNone;
    if (changes.endingNone === true) delete next.ending;

    if (!hasAxisValue(next)) {
      await db.axisRating.delete(workId);
      return undefined;
    }
    next.ratedAt = nowIso();
    await db.axisRating.put(next);
    return next;
  });
}

// ── reading sessions ──────────────────────────────────────────────────────

/**
 * Records reaching a position, and moves the work to match.
 *
 * The sheet asks where you got to, never how much you read — nobody knows the
 * second one. `delta` is stored so Stats is a sum over sessions rather than a
 * sum over `progressCurrent`, which would be wrong the first time a position is
 * corrected downward.
 *
 * A session that does not move forward records nothing at all. Use
 * setProgressCurrent to correct a position.
 */
export interface SessionResult {
  work: Work;
  /** The session reached the end of a work that has finished publishing. */
  finished: boolean;
  /**
   * The session reached the last chapter released so far of a work that is
   * still being published, and the reader is still marked as Reading.
   *
   * This is an OFFER, never an action. `status` describes the reader and is
   * never derived from the work (SCHEMA §1), so the app may not move someone to
   * Caught up on their behalf — but leaving the progress row reading
   * "published" while the pill says Reading makes the reader reconcile two true
   * statements. Asking once, at the moment it becomes true, is the way out.
   * Q-022, settled with the owner on 2026-09-03.
   */
  atPublishedEdge: boolean;
}

export async function logSession(id: string, to: number): Promise<SessionResult> {
  const w = await db.work.get(id);
  if (!w) throw new Error(`No work ${id}.`);

  const from = w.progressCurrent;
  const target = Math.floor(to);
  if (target <= from) return { work: w, finished: false, atPublishedEdge: false };

  const session: ReadingSession = {
    id: newId(),
    workId: id,
    from,
    to: target,
    delta: target - from,
    unit: w.progressUnit,
    at: nowIso(),
  };
  await db.readingSession.add(session);

  // D-105: for an ongoing work the total is how much has been RELEASED, not a
  // ceiling. Reaching it means caught up, and finishing an unfinished serial is
  // not something the app may claim on the reader's behalf.
  const reachedEnd =
    w.progressTotal !== undefined && target >= w.progressTotal && w.publicationStatus !== 'ongoing';

  // The offer only makes sense while the reader is still marked Reading. A
  // work already Caught up needs nothing said, and one that is Dropped is not
  // waiting for chapters.
  const atPublishedEdge =
    w.publicationStatus === 'ongoing' &&
    w.progressTotal !== undefined &&
    target >= w.progressTotal &&
    w.status === 'reading';

  const work = await patch(id, { progressCurrent: target });
  if (reachedEnd) {
    return { work: await setStatus(id, 'finished'), finished: true, atPublishedEdge: false };
  }
  return { work, finished: false, atPublishedEdge };
}

export async function chaptersRead(): Promise<number> {
  const rows = await db.readingSession.toArray();
  return rows.filter((session) => session.unit === 'chapter').reduce((n, s) => n + s.delta, 0);
}

// ── the trash ─────────────────────────────────────────────────────────────

/**
 * Soft delete. Notes stay linked through this: a restored work should come back
 * with its notes attached, and SCHEMA §6's promise that notes survive is about
 * the permanent delete. A note pointing at a soft-deleted work renders its pill
 * against the fallback colour (COMPONENTS, NoteCard).
 */
export interface NoteWriteInput {
  title?: string;
  body: string;
  pinned?: boolean;
  /** Names, rather than ids, keep a not-yet-saved custom tag inside the draft. */
  tagNames?: string[];
  workIds?: string[];
}

export interface NoteContext {
  note: Note;
  works: Work[];
  tags: Tag[];
}

/** Phase 7's order is a product rule: a recent loose thought cannot jump above
 * something the reader deliberately kept at the top. */
export function listNotes(): Promise<Note[]> {
  return db.note
    .filter((note) => !note.deletedAt)
    .toArray()
    .then((notes) =>
      notes.sort(
        (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt),
      ),
    );
}

export function getNote(id: string): Promise<Note | undefined> {
  return db.note.get(id);
}

async function hydrateNoteContexts(notes: Note[]): Promise<NoteContext[]> {
  if (notes.length === 0) return [];
  const noteLinks = await db.noteLink
    .where('noteId')
    .anyOf(notes.map((note) => note.id))
    .toArray();
  const uniqueWorkIds = [...new Set(noteLinks.map((link) => link.workId))];
  const uniqueTagIds = [...new Set(notes.flatMap((note) => note.tagIds))];
  const [workRows, tags] = await Promise.all([
    db.work.bulkGet(uniqueWorkIds),
    db.tag.bulkGet(uniqueTagIds),
  ]);
  const workById = new Map(workRows.flatMap((work) => (work ? [[work.id, work]] : [])));
  const tagById = new Map(tags.flatMap((tag) => (tag ? [[tag.id, tag]] : [])));
  const workIdsByNote = new Map<string, string[]>();
  for (const link of noteLinks) {
    const ids = workIdsByNote.get(link.noteId);
    if (ids) ids.push(link.workId);
    else workIdsByNote.set(link.noteId, [link.workId]);
  }
  return notes.map((note) => ({
    note,
    works: (workIdsByNote.get(note.id) ?? []).flatMap((workId) => {
      const work = workById.get(workId);
      return work ? [work] : [];
    }),
    tags: note.tagIds.flatMap((tagId) => {
      const tag = tagById.get(tagId);
      return tag ? [tag] : [];
    }),
  }));
}

export async function getNoteContext(id: string): Promise<NoteContext | undefined> {
  const note = await db.note.get(id);
  return note ? (await hydrateNoteContexts([note]))[0] : undefined;
}

export async function listNoteContexts(): Promise<NoteContext[]> {
  return hydrateNoteContexts(await listNotes());
}

export async function listNotesForWork(workId: string): Promise<NoteContext[]> {
  const links = await db.noteLink.where('workId').equals(workId).toArray();
  const notes = await db.note.bulkGet(links.map((link) => link.noteId));
  const rows = await hydrateNoteContexts(notes.filter((note): note is Note => !!note));
  return rows
    .filter((row) => !row.note.deletedAt)
    .sort(
      (a, b) =>
        Number(b.note.pinned) - Number(a.note.pinned) ||
        b.note.updatedAt.localeCompare(a.note.updatedAt),
    );
}

async function resolveNoteTagNames(names: string[]): Promise<string[]> {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const clean = name.trim();
    const normalizedName = normalizeTag(clean);
    if (!clean || seen.has(normalizedName)) continue;
    seen.add(normalizedName);
    const existing = await db.tag.where('normalizedName').equals(normalizedName).first();
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const tag: Tag = {
      id: newId(),
      name: clean,
      normalizedName,
      source: 'user',
      groups: TAG_GROUP_MEMBERSHIP.get(clean) ?? [],
      usageCount: 0,
    };
    await db.tag.add(tag);
    ids.push(tag.id);
  }
  return ids;
}

async function replaceNoteLinks(noteId: string, workIds: string[]): Promise<void> {
  const unique = [...new Set(workIds)];
  const works = await db.work.bulkGet(unique);
  if (works.some((work) => !work))
    throw new Error('A work attached to this note no longer exists.');
  const existing = await db.noteLink.where('noteId').equals(noteId).toArray();
  const createdAtByWork = new Map(existing.map((link) => [link.workId, link.createdAt]));
  await db.noteLink.where('noteId').equals(noteId).delete();
  if (unique.length) {
    const now = nowIso();
    await db.noteLink.bulkAdd(
      unique.map((workId) => ({ noteId, workId, createdAt: createdAtByWork.get(workId) ?? now })),
    );
  }
}

export async function createNote(input: NoteWriteInput): Promise<Note> {
  if (!input.title?.trim() && !input.body.trim()) throw new Error('An empty note is not saved.');
  const now = nowIso();
  return db.transaction('rw', db.note, db.noteLink, db.tag, db.work, async () => {
    const note: Note = {
      id: newId(),
      body: input.body,
      tagIds: await resolveNoteTagNames(input.tagNames ?? []),
      pinned: input.pinned ?? false,
      createdAt: now,
      updatedAt: now,
    };
    const title = input.title?.trim();
    if (title) note.title = title;
    await db.note.add(note);
    await replaceNoteLinks(note.id, input.workIds ?? []);
    await refreshTagCounts();
    return note;
  });
}

export async function updateNote(id: string, input: NoteWriteInput): Promise<Note> {
  if (!input.title?.trim() && !input.body.trim()) throw new Error('An empty note is not saved.');
  return db.transaction('rw', db.note, db.noteLink, db.tag, db.work, async () => {
    const current = await db.note.get(id);
    if (!current) throw new Error(`Note ${id} does not exist.`);
    const title = input.title?.trim();
    await db.note.update(id, {
      title: title || undefined,
      body: input.body,
      pinned: input.pinned ?? current.pinned,
      tagIds:
        input.tagNames === undefined ? current.tagIds : await resolveNoteTagNames(input.tagNames),
      updatedAt: nowIso(),
    });
    if (input.workIds !== undefined) await replaceNoteLinks(id, input.workIds);
    await refreshTagCounts();
    const saved = await db.note.get(id);
    if (!saved) throw new Error(`Note ${id} disappeared during an update.`);
    return saved;
  });
}

export function listDeletedNotes(): Promise<Note[]> {
  return db.note
    .filter((note) => !!note.deletedAt)
    .toArray()
    .then((notes) => notes.sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? '')));
}

export async function softDeleteNote(id: string): Promise<void> {
  await db.transaction('rw', db.note, db.tag, db.work, async () => {
    const now = nowIso();
    await db.note.update(id, { deletedAt: now, updatedAt: now });
    await refreshTagCounts();
  });
}

export async function restoreNote(id: string): Promise<void> {
  await db.transaction('rw', db.note, db.tag, db.work, async () => {
    await db.note.update(id, { deletedAt: undefined, updatedAt: nowIso() });
    await refreshTagCounts();
  });
}

export async function purgeNote(id: string): Promise<void> {
  await db.transaction('rw', db.note, db.noteLink, db.tag, db.work, async () => {
    await db.noteLink.where('noteId').equals(id).delete();
    await db.note.delete(id);
    await refreshTagCounts();
  });
}

export function softDeleteWork(id: string): Promise<Work> {
  return patch(id, { deletedAt: nowIso() });
}

export function restoreWork(id: string): Promise<Work> {
  return patch(id, { deletedAt: undefined });
}

/**
 * Permanent. Unlinks notes rather than deleting them — they survive as loose
 * notes — and takes the work's sessions and axis rating with it, because those
 * describe a work that no longer exists.
 */
export async function purgeWork(id: string): Promise<void> {
  const coverPath = (await db.work.get(id))?.coverPath;
  await db.transaction('rw', db.work, db.noteLink, db.readingSession, db.axisRating, async () => {
    await db.noteLink.where('workId').equals(id).delete();
    await db.readingSession.where('workId').equals(id).delete();
    await db.axisRating.delete(id);
    await db.work.delete(id);
  });
  if (coverPath) await deleteFile(coverPath);
  await refreshTagCounts();
}

export async function emptyTrash(): Promise<number> {
  const [works, notes] = await Promise.all([listTrash(), listDeletedNotes()]);
  for (const work of works) await purgeWork(work.id);
  for (const note of notes) await purgeNote(note.id);
  return works.length + notes.length;
}

/**
 * Runs on app open. There is no server and no background job, so a thirty-day
 * retention can only be enforced when the app is actually launched — leave it
 * shut for two months and everything expires at once on the next open. That is
 * the honest behaviour, and it is why the trash screen must not show a
 * countdown it cannot run. See OPEN-QUESTIONS Q-021.
 */
export async function purgeExpired(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - TRASH_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const [works, notes] = await Promise.all([listTrash(), listDeletedNotes()]);
  const expiredWorks = works.filter((work) => (work.deletedAt ?? '') < cutoff);
  const expiredNotes = notes.filter((note) => (note.deletedAt ?? '') < cutoff);
  for (const work of expiredWorks) await purgeWork(work.id);
  for (const note of expiredNotes) await purgeNote(note.id);
  return expiredWorks.length + expiredNotes.length;
}

/** Whole days left before a soft-deleted record is purged. Never negative. */
export function daysLeftInTrash(deletedAt: string, now: Date = new Date()): number {
  const gone = new Date(deletedAt).getTime();
  if (Number.isNaN(gone)) return 0;
  const elapsed = (now.getTime() - gone) / (24 * 60 * 60 * 1000);
  return Math.max(0, Math.ceil(TRASH_DAYS - elapsed));
}
