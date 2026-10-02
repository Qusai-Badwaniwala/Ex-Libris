import type { CorpusMatch } from './types';

const ENDPOINT = 'https://openlibrary.org/search.json';

interface SearchDocument {
  key?: unknown;
  title?: unknown;
  author_name?: unknown;
  cover_i?: unknown;
  first_publish_year?: unknown;
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

/** A search result is a lead, never a source for an invented series or edition. */
export function parseOpenLibraryResult(value: unknown): CorpusMatch | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as SearchDocument;
  const key = text(row.key)
    ?.match(/(?:^|\/)OL\d+W$/i)?.[0]
    .replace(/^\//, '');
  const title = text(row.title);
  if (!key || !title) return null;
  const authors = Array.isArray(row.author_name)
    ? row.author_name
        .map(text)
        .filter((name): name is string => !!name)
        .slice(0, 8)
    : [];
  const cover = Number(row.cover_i);
  const year = Number(row.first_publish_year);
  return {
    corpusId: `openlibrary:${key}`,
    title,
    authors,
    formatHint: 'book',
    coverId: Number.isSafeInteger(cover) && cover > 0 ? String(cover) : undefined,
    coverSource: Number.isSafeInteger(cover) && cover > 0 ? 'openlibrary' : undefined,
    year: Number.isSafeInteger(year) && year > 0 ? year : undefined,
    source: 'openlibrary-live',
  };
}

/** One explicit, bounded title search. The downloaded index remains the offline path. */
export async function searchOpenLibrary(
  query: string,
  signal?: AbortSignal,
): Promise<CorpusMatch[]> {
  const clean = query.trim();
  if (clean.length < 3) return [];
  const params = new URLSearchParams({
    q: clean,
    fields: 'key,title,author_name,cover_i,first_publish_year',
    limit: '10',
  });
  const response = await fetch(`${ENDPOINT}?${params}`, {
    headers: { accept: 'application/json' },
    signal,
  });
  if (response.status === 429) {
    const wait = response.headers.get('Retry-After');
    throw new Error(
      wait ? `Open Library asked us to wait ${wait} seconds.` : 'Open Library asked us to wait.',
    );
  }
  if (!response.ok) throw new Error(`Open Library search failed (${response.status}).`);
  const payload = (await response.json()) as { docs?: unknown };
  if (!Array.isArray(payload.docs))
    throw new Error('Open Library returned an unreadable response.');
  return payload.docs.map(parseOpenLibraryResult).filter((match): match is CorpusMatch => !!match);
}
