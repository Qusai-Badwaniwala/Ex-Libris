import type { Series, Work } from '../db/schema';

export interface SeriesCompletionFacts {
  owned: number;
  finished: number;
  totalEntriesKnown?: number;
  /** Absent when the catalogue does not state a trustworthy denominator. */
  ring?: { value: number; total: number };
}

/**
 * The approved ring is finished / known total, not merely present / total.
 * Wishlist and deleted rows are not owned, and no total means no ring.
 */
export function seriesCompletionFacts(series: Series, works: Work[]): SeriesCompletionFacts {
  const present = works.filter(
    (work) => work.seriesId === series.id && !work.deletedAt && work.status !== 'wishlist',
  );
  const finished = present.filter((work) => work.status === 'finished').length;
  return {
    owned: present.length,
    finished,
    totalEntriesKnown: series.totalEntriesKnown,
    ring:
      series.totalEntriesKnown === undefined
        ? undefined
        : { value: Math.min(finished, series.totalEntriesKnown), total: series.totalEntriesKnown },
  };
}
