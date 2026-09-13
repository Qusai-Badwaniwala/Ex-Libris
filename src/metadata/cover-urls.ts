import type { CorpusMatch } from '../catalogue/types';

export type OpenLibraryCoverSize = 'S' | 'M' | 'L';

export function normalizeOpenLibraryCoverId(value: unknown): string | undefined {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? String(value) : undefined;
  }
  if (typeof value !== 'string') return undefined;
  const clean = value.trim();
  return /^[1-9]\d*$/.test(clean) ? clean : undefined;
}

/** `default=false` turns a missing cover into an honest 404, not a blank tile. */
export function openLibraryCoverUrl(
  coverId: unknown,
  size: OpenLibraryCoverSize = 'L',
): string | undefined {
  const id = normalizeOpenLibraryCoverId(coverId);
  return id
    ? `https://covers.openlibrary.org/b/id/${encodeURIComponent(id)}-${size}.jpg?default=false`
    : undefined;
}

function mangaDexCoverUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const [mangaId, filename, ...rest] = value.trim().split('/');
  if (!mangaId || !filename || rest.length) return undefined;
  return `https://uploads.mangadex.org/covers/${encodeURIComponent(mangaId)}/${encodeURIComponent(filename)}.512.jpg`;
}

/** Maps only identifiers whose current production source contract we know. */
export function catalogueCoverUrl(
  candidate: Pick<CorpusMatch, 'coverId' | 'coverSource'>,
): string | undefined {
  if (candidate.coverSource === 'openlibrary') return openLibraryCoverUrl(candidate.coverId);
  if (candidate.coverSource === 'mangadex') return mangaDexCoverUrl(candidate.coverId);
  return undefined;
}
