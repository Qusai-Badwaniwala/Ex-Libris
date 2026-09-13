import type {
  CorpusRelationshipEvidence,
  CorpusRelationshipEntry,
  CorpusSeriesEvidence,
  CorpusUniverseEvidence,
} from './types';

/**
 * Relationship lookup is deliberately by the immutable corpus id, never by a
 * title search. A text result can be close; a series suggestion changes how a
 * reader's library is grouped and therefore needs exact source provenance.
 */
export const CATALOGUE_RELATIONSHIP_SQL = `SELECT w.id, w.title, w.authors, w.format_hint,
       w.series_position, w.cover_id, w.cover_source, w.publication_status,
       w.chapter_count, w.volume_count, w.year, w.source,
       s.id, s.name, s.total_entries, s.source,
       u.id, u.name, u.description, u.source
  FROM corpus_work w
  LEFT JOIN corpus_series s ON s.id = w.series_id
  LEFT JOIN corpus_universe u ON u.id = COALESCE(w.universe_id, s.universe_id)
 WHERE w.id = ?
 LIMIT 1`;

export const CATALOGUE_SERIES_ENTRIES_SQL = `SELECT w.id, w.title, w.authors, w.format_hint,
       w.series_position, w.cover_id, w.cover_source, w.publication_status,
       w.chapter_count, w.volume_count, w.year, w.source
  FROM corpus_work w
 WHERE w.series_id = ?
 ORDER BY w.series_position IS NULL, w.series_position, w.year IS NULL, w.year,
          w.title COLLATE NOCASE`;

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;

const number = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

function authors(value: unknown): string[] {
  return (
    text(value)
      ?.split(',')
      .map((name) => name.trim())
      .filter(Boolean) ?? []
  );
}

export function rowToRelationshipEntry(row: unknown[]): CorpusRelationshipEntry {
  const publicationStatus = text(row[7]);
  return {
    corpusId: String(row[0]),
    title: String(row[1]),
    authors: authors(row[2]),
    formatHint: row[3] === 'book' || row[3] === 'novel' || row[3] === 'manhwa' ? row[3] : undefined,
    seriesPosition: number(row[4]),
    coverId: text(row[5]),
    coverSource:
      row[6] === 'openlibrary' || row[6] === 'anilist' || row[6] === 'mangadex'
        ? row[6]
        : undefined,
    publicationStatus:
      publicationStatus === 'ongoing' ||
      publicationStatus === 'complete' ||
      publicationStatus === 'hiatus' ||
      publicationStatus === 'abandoned'
        ? publicationStatus
        : undefined,
    chapterCount: number(row[8]),
    volumeCount: number(row[9]),
    year: number(row[10]),
    source: String(row[11]),
  };
}

export function rowsToRelationshipEvidence(
  rootRows: unknown[][],
  entryRows: unknown[][],
): CorpusRelationshipEvidence | undefined {
  const root = rootRows[0];
  if (!root) return undefined;

  const work = rowToRelationshipEntry(root);
  const seriesId = text(root[12]);
  let series: CorpusSeriesEvidence | undefined;
  if (seriesId) {
    series = {
      corpusSeriesId: seriesId,
      name: text(root[13]) ?? seriesId,
      totalEntriesKnown: number(root[14]),
      source: text(root[15]) ?? 'unknown',
      entries: entryRows.map(rowToRelationshipEntry),
    };
  }

  const universeId = text(root[16]);
  let universe: CorpusUniverseEvidence | undefined;
  if (universeId) {
    universe = {
      corpusUniverseId: universeId,
      name: text(root[17]) ?? universeId,
      description: text(root[18]),
      source: text(root[19]) ?? 'unknown',
    };
  }

  return { work, series, universe };
}
