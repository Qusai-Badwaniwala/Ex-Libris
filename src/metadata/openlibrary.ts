import { normalizeOpenLibraryCoverId, openLibraryCoverUrl } from './cover-urls';

const API_ORIGIN = 'https://openlibrary.org';
const WORK_ID = /^OL\d+W$/i;
const EDITION_ID = /^OL\d+M$/i;
const AUTHOR_ID = /^OL\d+A$/i;

export interface OpenLibraryReference {
  workId: string;
  /** Exact edition only. Without it, page count remains unknown. */
  editionId?: string;
}

export interface OpenLibraryMetadata {
  source: 'openlibrary';
  workId: string;
  editionId?: string;
  title: string;
  subtitle?: string;
  /** Stable source identifiers; catalogue search already supplies display names. */
  authorIds: string[];
  description?: string;
  firstPublishYear?: number;
  /** Present only when an exact edition record supplied a positive count. */
  pageCount?: number;
  coverId?: string;
  coverUrl?: string;
  isbn13?: string;
}

interface OpenLibraryWorkRecord {
  title?: unknown;
  subtitle?: unknown;
  description?: unknown;
  first_publish_date?: unknown;
  covers?: unknown;
  authors?: unknown;
}

interface OpenLibraryEditionRecord {
  title?: unknown;
  subtitle?: unknown;
  number_of_pages?: unknown;
  covers?: unknown;
  isbn_13?: unknown;
  authors?: unknown;
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const descriptionText = (value: unknown): string | undefined => {
  const direct = text(value);
  if (direct) return direct;
  if (!value || typeof value !== 'object') return undefined;
  return text((value as { value?: unknown }).value);
};

const positiveWhole = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const firstPositiveCover = (value: unknown): string | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value.map(normalizeOpenLibraryCoverId).find(Boolean);
};

const firstIsbn13 = (value: unknown): string | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value
    .map(text)
    .map((isbn) => isbn?.replaceAll('-', ''))
    .find((isbn): isbn is string => !!isbn && /^\d{13}$/.test(isbn));
};

function idsFromLinks(value: unknown, expected: RegExp): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return undefined;
      const row = entry as { key?: unknown; author?: { key?: unknown } };
      return normalizeOpenLibraryId(row.author?.key ?? row.key, expected);
    })
    .filter((id): id is string => !!id);
  return [...new Set(ids)].slice(0, 8);
}

export function normalizeOpenLibraryId(value: unknown, expected: RegExp): string | undefined {
  if (typeof value !== 'string') return undefined;
  const clean = value
    .trim()
    .replace(/^https?:\/\/openlibrary\.org/i, '')
    .replace(/\.json$/i, '');
  const id = clean.split('/').filter(Boolean).pop()?.toUpperCase();
  return id && expected.test(id) ? id : undefined;
}

export const normalizeOpenLibraryWorkId = (value: unknown): string | undefined =>
  normalizeOpenLibraryId(value, WORK_ID);
export const normalizeOpenLibraryEditionId = (value: unknown): string | undefined =>
  normalizeOpenLibraryId(value, EDITION_ID);
export const normalizeOpenLibraryAuthorId = (value: unknown): string | undefined =>
  normalizeOpenLibraryId(value, AUTHOR_ID);

export interface ParsedOpenLibraryRecord {
  title?: string;
  subtitle?: string;
  description?: string;
  firstPublishYear?: number;
  pageCount?: number;
  coverId?: string;
  isbn13?: string;
  authorIds: string[];
}

/** Exported because every network record is untrusted and fixture-tested. */
export function parseOpenLibraryWork(value: unknown): ParsedOpenLibraryRecord {
  if (!value || typeof value !== 'object') return { authorIds: [] };
  const record = value as OpenLibraryWorkRecord;
  const firstPublish = text(record.first_publish_date);
  const year = firstPublish ? /\b(\d{4})\b/.exec(firstPublish)?.[1] : undefined;
  return {
    title: text(record.title),
    subtitle: text(record.subtitle),
    description: descriptionText(record.description),
    firstPublishYear: year ? Number(year) : undefined,
    coverId: firstPositiveCover(record.covers),
    authorIds: idsFromLinks(record.authors, AUTHOR_ID),
  };
}

export function parseOpenLibraryEdition(value: unknown): ParsedOpenLibraryRecord {
  if (!value || typeof value !== 'object') return { authorIds: [] };
  const record = value as OpenLibraryEditionRecord;
  return {
    title: text(record.title),
    subtitle: text(record.subtitle),
    pageCount: positiveWhole(record.number_of_pages),
    coverId: firstPositiveCover(record.covers),
    isbn13: firstIsbn13(record.isbn_13),
    authorIds: idsFromLinks(record.authors, AUTHOR_ID),
  };
}

interface LookupOptions {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
}

async function readJson(
  path: string,
  fetcher: typeof fetch,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const response = await fetcher(`${API_ORIGIN}${path}`, {
    headers: { accept: 'application/json' },
    signal,
  });
  if (response.status === 429) {
    const wait = response.headers.get('Retry-After');
    throw new Error(
      wait ? `Open Library asked us to wait ${wait} seconds.` : 'Open Library asked us to wait.',
    );
  }
  if (!response.ok) throw new Error(`Open Library metadata failed (${response.status}).`);
  const value = (await response.json()) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Open Library returned unreadable metadata.');
  }
  return value as Record<string, unknown>;
}

/**
 * Low-volume lookup for one work the reader is acting on. It never searches or
 * crawls, and it never guesses an edition-specific page count from another
 * edition of the work.
 */
export async function lookupOpenLibraryMetadata(
  reference: OpenLibraryReference,
  options: LookupOptions = {},
): Promise<OpenLibraryMetadata> {
  const workId = normalizeOpenLibraryWorkId(reference.workId);
  if (!workId) throw new Error('The Open Library work identifier is invalid.');
  const editionId = reference.editionId
    ? normalizeOpenLibraryEditionId(reference.editionId)
    : undefined;
  if (reference.editionId && !editionId) {
    throw new Error('The Open Library edition identifier is invalid.');
  }

  const fetcher = options.fetcher ?? fetch;
  // Keep this one-at-a-time. An unidentified browser client receives Open
  // Library's conservative default rate limit, and a metadata fill is not a
  // reason to burst several record requests in parallel.
  const workValue = await readJson(`/works/${workId}.json`, fetcher, options.signal);
  const editionValue = editionId
    ? await readJson(`/books/${editionId}.json`, fetcher, options.signal)
    : undefined;
  const work = parseOpenLibraryWork(workValue);
  const edition = editionValue ? parseOpenLibraryEdition(editionValue) : undefined;
  const title = edition?.title ?? work.title;
  if (!title) throw new Error('Open Library metadata did not include a title.');

  const coverId = edition?.coverId ?? work.coverId;
  return {
    source: 'openlibrary',
    workId,
    editionId,
    title,
    subtitle: edition?.subtitle ?? work.subtitle,
    authorIds: edition?.authorIds.length ? edition.authorIds : work.authorIds,
    description: work.description,
    firstPublishYear: work.firstPublishYear,
    pageCount: edition?.pageCount,
    coverId,
    coverUrl: openLibraryCoverUrl(coverId),
    isbn13: edition?.isbn13,
  };
}
