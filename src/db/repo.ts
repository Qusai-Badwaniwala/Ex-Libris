import { db } from './db';
import { newId, nowIso, sortTitleOf, sortNameOf, normalizeTag } from './keys';
import { TAG_GROUP_MEMBERSHIP } from '../data/taxonomy';
import type {
  Author,
  Format,
  GenreIndex,
  ProgressUnit,
  PublicationStatus,
  ReadingStatus,
  ReadingSession,
  Series,
  Tag,
  Universe,
  Work,
} from './schema';

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
  const works = await db.work.filter((w) => !w.deletedAt).toArray();
  const counts = new Map<string, number>();
  for (const w of works) for (const id of w.tagIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  const tags = await db.tag.toArray();
  await db.tag.bulkPut(tags.map((t) => ({ ...t, usageCount: counts.get(t.id) ?? 0 })));
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
  genres?: GenreIndex[];
  tagIds?: string[];
  corpusId?: string;
}

export async function createWork(input: NewWorkInput): Promise<Work> {
  const now = nowIso();
  const authorIds = input.authorName?.trim() ? [(await authorByName(input.authorName)).id] : [];

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
    coverSource: 'none',
    tagIds: input.tagIds ?? [],
    genres: (input.genres ?? []).slice(0, 2),
    isTranslated: false,
    dateAdded: now,
    externalIds: {},
    isManualEntry: !input.corpusId,
    updatedAt: now,
  };
  if (input.progressTotal !== undefined) work.progressTotal = input.progressTotal;
  if (input.corpusId) work.corpusId = input.corpusId;
  // Adding something straight to Reading is a start, and the date should say so.
  if (input.status === 'reading') work.dateStarted = now;

  await db.work.add(work);
  if (work.tagIds.length) await refreshTagCounts();
  return work;
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

  return patch(id, changes);
}

export function setDropReason(id: string, reason: string): Promise<Work> {
  return patch(id, { dropReason: reason.trim() || undefined });
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
export async function logSession(
  id: string,
  to: number,
): Promise<{ work: Work; finished: boolean }> {
  const w = await db.work.get(id);
  if (!w) throw new Error(`No work ${id}.`);

  const from = w.progressCurrent;
  const target = Math.floor(to);
  if (target <= from) return { work: w, finished: false };

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

  const work = await patch(id, { progressCurrent: target });
  if (reachedEnd) return { work: await setStatus(id, 'finished'), finished: true };
  return { work, finished: false };
}

export async function chaptersRead(): Promise<number> {
  const rows = await db.readingSession.toArray();
  return rows.reduce((n, s) => n + s.delta, 0);
}

// ── the trash ─────────────────────────────────────────────────────────────

/**
 * Soft delete. Notes stay linked through this: a restored work should come back
 * with its notes attached, and SCHEMA §6's promise that notes survive is about
 * the permanent delete. A note pointing at a soft-deleted work renders its pill
 * against the fallback colour (COMPONENTS, NoteCard).
 */
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
  await db.transaction('rw', db.work, db.noteLink, db.readingSession, db.axisRating, async () => {
    await db.noteLink.where('workId').equals(id).delete();
    await db.readingSession.where('workId').equals(id).delete();
    await db.axisRating.delete(id);
    await db.work.delete(id);
  });
  await refreshTagCounts();
}

export async function emptyTrash(): Promise<number> {
  const rows = await listTrash();
  for (const w of rows) await purgeWork(w.id);
  return rows.length;
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
  const expired = (await listTrash()).filter((w) => (w.deletedAt ?? '') < cutoff);
  for (const w of expired) await purgeWork(w.id);
  return expired.length;
}

/** Whole days left before a soft-deleted record is purged. Never negative. */
export function daysLeftInTrash(deletedAt: string, now: Date = new Date()): number {
  const gone = new Date(deletedAt).getTime();
  if (Number.isNaN(gone)) return 0;
  const elapsed = (now.getTime() - gone) / (24 * 60 * 60 * 1000);
  return Math.max(0, Math.ceil(TRASH_DAYS - elapsed));
}
