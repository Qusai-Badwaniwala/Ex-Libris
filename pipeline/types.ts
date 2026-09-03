/**
 * The rows the corpus ships. These mirror SCHEMA.md §10 exactly — the app
 * queries these column names in a Web Worker and nothing translates between
 * them, so a rename here is a silent breakage there.
 *
 * Everything here is READ-ONLY at runtime, is never part of a backup, and is
 * not user data. It is a shipped index of facts about published works.
 */

export type FormatHint = 'book' | 'novel' | 'manhwa';
export type PublicationStatus = 'ongoing' | 'complete' | 'hiatus' | 'abandoned' | 'unknown';

/**
 * Which source won a field, so provenance is inspectable.
 * Precedence, from the brief §6.6: wikidata > anilist > mangadex > openlibrary
 * > googlebooks. Higher number wins.
 */
export const SOURCE_RANK = {
  googlebooks: 1,
  openlibrary: 2,
  mangadex: 3,
  anilist: 4,
  wikidata: 5,
} as const;

export type SourceName = keyof typeof SOURCE_RANK;

export interface CorpusWork {
  id: string;
  title: string;
  /** NFKC-folded, article-stripped. The FTS5 column the app actually matches on. */
  title_normalized: string;
  /** Alternate titles and synonyms, newline-joined. Indexed, never displayed. */
  synonyms: string;
  /** Denormalised, comma-joined. Joining at query time costs more than the bytes. */
  authors: string;
  format_hint: FormatHint | null;
  series_id: string | null;
  series_position: number | null;
  universe_id: string | null;
  cover_id: string | null;
  /** Which CDN `cover_id` addresses. Covers are fetched on demand, never bundled. */
  cover_source: 'openlibrary' | 'anilist' | 'mangadex' | null;
  publication_status: PublicationStatus;
  chapter_count: number | null;
  volume_count: number | null;
  year: number | null;
  /** Whatever the winning source uses for popularity, normalised to 0-100. */
  popularity: number;
  external_ids: string;
  source: SourceName;
}

export interface CorpusSeries {
  id: string;
  name: string;
  universe_id: string | null;
  /**
   * Powers completion rings, so accuracy matters more than coverage. Where a
   * count is uncertain this is NULL, never a guess — the app shows no ring
   * rather than a fake denominator.
   */
  total_entries: number | null;
  source: SourceName;
}

export interface CorpusUniverse {
  id: string;
  name: string;
  description: string | null;
  source: SourceName;
}

/** What a stage reports when it finishes. Logged to PIPELINE-NOTES.md. */
export interface StageReport {
  stage: string;
  ok: boolean;
  /** Counts worth putting in front of the owner, e.g. { works: 412_000 }. */
  counts: Record<string, number>;
  notes: string[];
  seconds: number;
}
