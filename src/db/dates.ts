/**
 * Dates the reader experiences, as opposed to instants the database records.
 *
 * Everything is STORED as a UTC ISO 8601 instant, per SCHEMA's conventions —
 * that is unambiguous and survives a device changing timezone. But every
 * question the app actually asks is a local one: "finished this year", "years
 * tracked", "added today". Slicing an ISO string to get a day answers the UTC
 * question instead, and this owner reads at night in IST, so a book finished at
 * 01:00 IST is stamped with the previous UTC day — and on the 1st of January,
 * with the previous YEAR. "Finished in 2026" would quietly lose a book.
 *
 * Found by opening Phase 0's diagnostics panel and noticing that "first
 * tracked" read 2026-09-02 at ten to two in the morning on the 3rd.
 *
 * So: nothing anywhere may slice an ISO string to get a day or a year. These
 * three functions are the only way to ask.
 */

/** Local calendar day, as YYYY-MM-DD. */
export function localDay(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local calendar year. This is the number "finished in 2026" counts. */
export function localYear(iso: string | Date): number {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return Number.isNaN(d.getTime()) ? NaN : d.getFullYear();
}

/**
 * Whole local years between two instants, floored. Stats' "years tracked".
 * Counts calendar years elapsed rather than 365-day blocks, because a reader
 * who started in December 2024 has been tracking "two years" by January 2026 in
 * every sense they mean it.
 */
export function yearsTracked(fromIso: string, now: Date = new Date()): number {
  const from = new Date(fromIso);
  if (Number.isNaN(from.getTime())) return 0;
  return Math.max(0, now.getFullYear() - from.getFullYear() + 1);
}
