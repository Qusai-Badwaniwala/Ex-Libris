import { sortTitleOf } from '../src/db/keys.ts';
import type { CorpusWork, FormatHint, PublicationStatus, SourceName } from './types.ts';
import { SOURCE_RANK } from './types.ts';

/**
 * Normalisation, shared with the app on purpose.
 *
 * `title_normalized` is what the app's FTS5 query matches against, and the app
 * builds its side of that comparison with `sortTitleOf` from src/db/keys.ts. If
 * the pipeline had its own copy, the two would drift and search would quietly
 * stop finding things — the exact failure the "one source of truth" rule exists
 * to prevent. So the pipeline imports the app's function rather than
 * reimplementing it.
 */
export function normalizeTitle(title: string): string {
  return sortTitleOf(title);
}

/**
 * A key for matching the same work across sources. Deliberately lossier than
 * `title_normalized`: punctuation and spacing differ constantly between Open
 * Library, AniList and MangaDex for what is plainly one work.
 */
export function matchKey(title: string, author?: string): string {
  const t = normalizeTitle(title)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  const a = (author ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  return a ? `${t}::${a}` : t;
}

/* ── AniList's vocabulary, mapped to ours ───────────────────────────────── */

/**
 * The single most consequential mapping in the pipeline, and the one that was
 * nearly wrong.
 *
 * AniList's `type: MANGA` covers manga, manhwa, manhua AND light novels, so the
 * format has to come from `format` plus `countryOfOrigin`. Getting this wrong
 * does not produce a missing record — it produces a confidently mislabelled
 * one, which is worse.
 *
 * Verified against the live API on 2026-09-03: searching AniList for "Reverend
 * Insanity" returns the MANHUA ADAPTATION — 96 chapters, CANCELLED — and no
 * entry at all for the 2,334-chapter novel. Same for Lord of the Mysteries (65
 * chapters, the comic). So a MANGA-format record must never be presented as a
 * match for a web novel, and `format_hint` carries what the record ACTUALLY is
 * so the add flow can show it. See PIPELINE-NOTES.md.
 */
export function anilistFormat(
  format: string | null | undefined,
  // Kept in the signature deliberately. It is the field that tells manhwa from
  // manga from manhua, and the day this app distinguishes them the caller
  // should not have to be changed too.
  _country: string | null | undefined,
): FormatHint | null {
  if (format === 'NOVEL') return 'novel';
  if (format === 'MANGA' || format === 'ONE_SHOT') {
    // Korean and Chinese comics are manhwa and manhua; Japanese are manga. The
    // owner reads all three off the same shelf and calls it manhwa, which is
    // what `format` means in this app: how it is READ, not what it is.
    return 'manhwa';
  }
  return null;
}

export function anilistStatus(status: string | null | undefined): PublicationStatus {
  switch (status) {
    case 'FINISHED':
      return 'complete';
    case 'RELEASING':
      return 'ongoing';
    case 'HIATUS':
      return 'hiatus';
    case 'CANCELLED':
      return 'abandoned';
    case 'NOT_YET_RELEASED':
      return 'unknown';
    default:
      return 'unknown';
  }
}

export function mangadexStatus(status: string | null | undefined): PublicationStatus {
  switch (status) {
    case 'completed':
      return 'complete';
    case 'ongoing':
      return 'ongoing';
    case 'hiatus':
      return 'hiatus';
    case 'cancelled':
      return 'abandoned';
    default:
      return 'unknown';
  }
}

/* ── merging ────────────────────────────────────────────────────────────── */

/**
 * Combines two records of what is believed to be the same work.
 *
 * Field by field rather than record by record: Open Library often has the only
 * cover while AniList has the only chapter count, and taking the whole winning
 * record would throw away the loser's unique fields. A higher-ranked source
 * wins a field only when it actually HAS one — precedence is a tie-break, not a
 * licence to overwrite a fact with a null.
 */
export function mergeWork(a: CorpusWork, b: CorpusWork): CorpusWork {
  const [low, high] = SOURCE_RANK[a.source] >= SOURCE_RANK[b.source] ? [b, a] : [a, b];
  const pick = <K extends keyof CorpusWork>(k: K): CorpusWork[K] => {
    const hv = high[k];
    const lv = low[k];
    return hv === null || hv === undefined || hv === '' ? lv : hv;
  };

  return {
    id: high.id,
    title: pick('title'),
    title_normalized: pick('title_normalized'),
    // Synonyms accumulate rather than being picked: every alternate spelling
    // any source knows is another way the reader might search for it.
    synonyms: dedupeLines([high.synonyms, low.synonyms, low.title]),
    authors: pick('authors'),
    format_hint: pick('format_hint'),
    series_id: pick('series_id'),
    series_position: pick('series_position'),
    universe_id: pick('universe_id'),
    cover_id: pick('cover_id'),
    cover_source: pick('cover_source'),
    // 'unknown' is a real value but it is also the default, so it must never
    // beat a source that actually knows.
    publication_status:
      high.publication_status !== 'unknown' ? high.publication_status : low.publication_status,
    chapter_count: pick('chapter_count'),
    volume_count: pick('volume_count'),
    year: pick('year'),
    popularity: Math.max(high.popularity, low.popularity),
    external_ids: mergeIds(high.external_ids, low.external_ids),
    source: high.source,
  };
}

function dedupeLines(parts: (string | null | undefined)[]): string {
  const seen = new Set<string>();
  for (const part of parts) {
    for (const line of (part ?? '').split('\n')) {
      const t = line.trim();
      if (t) seen.add(t);
    }
  }
  return [...seen].join('\n');
}

function mergeIds(highJson: string, lowJson: string): string {
  const parse = (s: string): Record<string, unknown> => {
    try {
      return JSON.parse(s || '{}') as Record<string, unknown>;
    } catch {
      return {};
    }
  };
  return JSON.stringify({ ...parse(lowJson), ...parse(highJson) });
}

/** Stable ids, so re-running the pipeline does not renumber the whole corpus
 *  and invalidate every `corpusId` already stored against a reader's work. */
export function stableId(source: SourceName, key: string): string {
  return `${source}:${key}`;
}

/* ── country, across two vocabularies ───────────────────────────────────── */

/**
 * AniList says KR / CN / JP; MangaDex says ko / zh / ja. Same fact, two
 * spellings. Folding them is what lets the second merge pass tell the Korean
 * "Wind Breaker" from the Japanese one — which are genuinely two different
 * works that happen to share a title.
 */
export function foldCountry(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (v.startsWith('ko') || v === 'kr') return 'KR';
  if (v.startsWith('zh') || v === 'cn' || v === 'tw' || v === 'hk') return 'CN';
  if (v.startsWith('ja') || v === 'jp') return 'JP';
  if (v.startsWith('en')) return 'EN';
  return v.toUpperCase().slice(0, 2);
}

export function countryOf(w: CorpusWork): string | null {
  try {
    const ids = JSON.parse(w.external_ids || '{}') as { country?: string };
    return foldCountry(ids.country);
  } catch {
    return null;
  }
}

/**
 * Whether two records of the same title are plausibly the same work.
 *
 * Measured on a real 4,000-row sample: matching on title AND author left 256
 * duplicate title groups — 6.5% of the corpus — because AniList takes its
 * author from the "Story" staff credit and MangaDex from an author
 * relationship, and the two romanise names differently. So a second pass
 * matches on title, and needs a different discriminator.
 *
 * Two rules, both learned from the data rather than assumed:
 *
 *  1. NEVER merge two records from the same source. AniList already dedupes
 *     itself, so two AniList rows titled "Wind Breaker" are two different works
 *     — the Korean manhwa and the Japanese manga. The sample contains exactly
 *     that case.
 *  2. Country must agree where both are known. It is the one field that
 *     separates same-titled works from different traditions.
 */
export function couldBeSameWork(a: CorpusWork, b: CorpusWork): boolean {
  if (a.source === b.source) return false;
  if (a.format_hint && b.format_hint && a.format_hint !== b.format_hint) return false;
  const ca = countryOf(a);
  const cb = countryOf(b);
  if (ca && cb && ca !== cb) return false;
  return true;
}
