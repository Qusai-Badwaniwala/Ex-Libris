import type { PublicationStatus } from '../db/schema';
import type { CorpusMatch } from './types';

const ENDPOINT = 'https://api.mangadex.org/manga';

interface MangaDexManga {
  id?: unknown;
  attributes?: {
    title?: Record<string, unknown>;
    originalLanguage?: unknown;
    lastChapter?: unknown;
    lastVolume?: unknown;
    status?: unknown;
    year?: unknown;
  };
  relationships?: {
    type?: unknown;
    attributes?: { name?: unknown; fileName?: unknown };
  }[];
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const positiveWhole = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
};

function publicationStatus(value: unknown): Exclude<PublicationStatus, 'unknown'> | undefined {
  if (value === 'ongoing') return 'ongoing';
  if (value === 'completed') return 'complete';
  if (value === 'hiatus') return 'hiatus';
  if (value === 'cancelled') return 'abandoned';
  return undefined;
}

/** Exported for a fixture test: network JSON is never trusted as app data. */
export function parseMangaDexManga(value: unknown): CorpusMatch | null {
  if (!value || typeof value !== 'object') return null;
  const manga = value as MangaDexManga;
  const id = text(manga.id);
  const titles = manga.attributes?.title;
  const title =
    text(titles?.['en']) ??
    text(titles?.['ja-ro']) ??
    text(titles?.['ko-ro']) ??
    text(titles?.['zh-ro']) ??
    (titles ? Object.values(titles).map(text).find(Boolean) : undefined);
  if (!id || !title) return null;

  const relationships = Array.isArray(manga.relationships) ? manga.relationships : [];
  const authors = relationships
    .filter((relationship) => relationship.type === 'author')
    .map((relationship) => text(relationship.attributes?.name))
    .filter((name): name is string => !!name)
    .filter((name, index, all) => all.indexOf(name) === index);
  const coverId = relationships
    .filter((relationship) => relationship.type === 'cover_art')
    .map((relationship) => text(relationship.attributes?.fileName))
    .find(Boolean);
  const year = positiveWhole(manga.attributes?.year);

  return {
    corpusId: `mangadex:${id}`,
    title,
    authors,
    // MangaDex catalogues comics. This is intentionally never guessed as a
    // novel even when it adapts one with the same title.
    formatHint: 'manhwa',
    coverId: coverId ? `${id}/${coverId}` : undefined,
    coverSource: coverId ? 'mangadex' : undefined,
    publicationStatus: publicationStatus(manga.attributes?.status),
    chapterCount: positiveWhole(manga.attributes?.lastChapter),
    volumeCount: positiveWhole(manga.attributes?.lastVolume),
    year,
    source: 'mangadex-live',
    mangadexId: id,
  };
}

/**
 * Called only from an explicit “Search MangaDex online” action. No background
 * crawl, pagination, or speculative request: one reader action, one bounded
 * metadata response, in keeping with MangaDex's published acceptable-use
 * policy and the project's no-tracking/no-cost contract.
 */
export async function searchMangaDex(query: string, signal?: AbortSignal): Promise<CorpusMatch[]> {
  const clean = query.trim();
  if (clean.length < 3) return [];
  const params = new URLSearchParams({
    limit: '10',
    title: clean,
    'order[relevance]': 'desc',
  });
  params.append('includes[]', 'author');
  params.append('includes[]', 'cover_art');

  const response = await fetch(`${ENDPOINT}?${params}`, {
    headers: { accept: 'application/json' },
    signal,
  });
  if (response.status === 429) {
    const wait = response.headers.get('Retry-After');
    throw new Error(
      wait ? `MangaDex asked us to wait ${wait} seconds.` : 'MangaDex asked us to wait.',
    );
  }
  if (!response.ok) throw new Error(`MangaDex search failed (${response.status}).`);
  const payload = (await response.json()) as { data?: unknown };
  if (!Array.isArray(payload.data)) throw new Error('MangaDex returned an unreadable response.');
  return payload.data.map(parseMangaDexManga).filter((match): match is CorpusMatch => !!match);
}
