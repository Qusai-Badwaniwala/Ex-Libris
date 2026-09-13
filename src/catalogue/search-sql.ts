import { sortTitleOf } from '../db/keys.ts';
import { toFtsPrefixQuery } from './query.ts';

/** Shared by the browser worker and the post-build quality probe. */
export const CATALOGUE_SEARCH_SQL = `SELECT w.id, w.title, w.authors, w.format_hint,
                           s.name, w.series_position, u.name, w.cover_id, w.cover_source,
                           w.publication_status, w.chapter_count, w.volume_count, w.year, w.source
                      FROM corpus_work_fts
                      JOIN corpus_work w ON w.rowid = corpus_work_fts.rowid
                      LEFT JOIN corpus_series s ON s.id = w.series_id
                      LEFT JOIN corpus_universe u ON u.id = w.universe_id
                     WHERE corpus_work_fts MATCH ?
                     ORDER BY CASE
                                WHEN w.title_normalized = ? THEN 0
                                WHEN w.title_normalized LIKE ? THEN 1
                                ELSE 2
                              END,
                              bm25(corpus_work_fts, 8.0, 10.0, 4.0, 2.0),
                              w.popularity DESC,
                              w.title COLLATE NOCASE
                     LIMIT ?`;

export function catalogueSearchBindings(query: string, limit: number): Array<string | number> {
  const normalizedQuery = sortTitleOf(query);
  return [
    toFtsPrefixQuery(query),
    normalizedQuery,
    `${normalizedQuery}%`,
    Math.min(30, Math.max(1, Math.floor(limit))),
  ];
}
