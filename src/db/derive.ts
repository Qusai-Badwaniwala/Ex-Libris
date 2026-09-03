import type { PublicationStatus, ReadingStatus, Work } from './schema';

/**
 * Turning a stored work into the values a screen paints.
 *
 * This is a faithful port of `deco()` in design/Ex Libris.dc.html. Every rule
 * here came from the design session and several of them are load-bearing
 * decisions rather than formatting:
 *
 *   D-009  Caught up shares Reading's hue and is told apart by a SEGMENTED
 *          track, so it reads as the edge of what exists rather than as
 *          partway through.
 *   D-105  For an ongoing work, `progressTotal` is how much has been RELEASED,
 *          not a ceiling. No percentage is shown, because there is no end to be
 *          a percentage of.
 *   SCHEMA No `progressTotal` means no bar and no percentage. Never invent a
 *          denominator — for web novels the absence is the common case.
 */

export const STATUS_LABEL: Record<ReadingStatus, string> = {
  reading: 'Reading',
  caught_up: 'Caught up',
  finished: 'Finished',
  dropped: 'Dropped',
  wishlist: 'Wishlist',
};

export const STATUS_COLOR: Record<ReadingStatus, string> = {
  reading: 'var(--status-reading)',
  caught_up: 'var(--status-caughtup)',
  finished: 'var(--status-finished)',
  dropped: 'var(--status-dropped)',
  wishlist: 'var(--status-wishlist)',
};

export const PUBLICATION_LABEL: Record<PublicationStatus, string> = {
  ongoing: 'Ongoing',
  complete: 'Complete',
  hiatus: 'On hiatus',
  abandoned: 'Abandoned',
  unknown: 'Publication unknown',
};

const num = (v: number) => v.toLocaleString('en-US');

export interface WorkDisplay {
  id: string;
  title: string;
  /** "Author unknown" is a real part in a list of candidates — the absence is
   *  information. On the detail screen the line is omitted instead. */
  authorLine: string;
  hasAuthor: boolean;
  coverColor: string;
  coverInk: string;
  statusLabel: string;
  statusColor: string;
  publicationLabel: string;
  /** "Chapter 412 / 1,140" */
  progressLabel: string;
  /** "412 / 1,140" — the list-row form */
  shortProgress: string;
  /** CSS width for the bar fill. Always 0–100%. */
  barWidth: string;
  /** "34%" or empty. Empty for an ongoing work: there is no end to be a
   *  percentage of, and showing one invents a ceiling. */
  percentLabel: string;
  showBar: boolean;
  trackBackground: string;
  fillBackground: string;
  canLogSession: boolean;
  sessionCta: string;
  positionLabel: string;
}

/** The one place that decides whether a work is caught up with what exists. */
function isAtPublishedEdge(w: Work): boolean {
  if (w.status === 'caught_up') return true;
  return (
    w.progressTotal !== undefined &&
    w.publicationStatus === 'ongoing' &&
    w.progressCurrent >= w.progressTotal
  );
}

export function displayWork(w: Work, authorName?: string): WorkDisplay {
  const unitWord = w.progressUnit === 'page' ? 'Page' : 'Chapter';
  const caught = isAtPublishedEdge(w);

  let progressLabel: string;
  let shortProgress: string;
  let barWidth = '0%';
  let percentLabel = '';
  let showBar = w.status !== 'wishlist';

  if (w.status === 'wishlist') {
    progressLabel = 'Not started';
    shortProgress = '—';
    showBar = false;
  } else if (caught) {
    progressLabel = `${unitWord} ${num(w.progressCurrent)} published`;
    shortProgress = 'Caught up';
    barWidth = '100%';
  } else if (w.progressTotal !== undefined) {
    const ratio = w.progressTotal > 0 ? w.progressCurrent / w.progressTotal : 0;
    // Clamped because the total is user-editable (A4): correcting a total
    // downward can legitimately leave the position past it, and a 140%-wide
    // fill would overflow its own track.
    const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
    progressLabel = `${unitWord} ${num(w.progressCurrent)} / ${num(w.progressTotal)}`;
    shortProgress = `${num(w.progressCurrent)} / ${num(w.progressTotal)}`;
    barWidth = `${pct}%`;
    percentLabel = `${pct}%`;
  } else {
    progressLabel = `${unitWord} ${num(w.progressCurrent)}`;
    shortProgress = `${unitWord.toLowerCase()} ${num(w.progressCurrent)}`;
    // No denominator, so no bar. This has to look deliberate, not broken.
    showBar = false;
  }

  const segmented = 'repeating-linear-gradient(90deg, VAR 0 5px, transparent 5px 8px)';

  return {
    id: w.id,
    title: w.title,
    authorLine: authorName?.trim() || 'Author unknown',
    hasAuthor: !!authorName?.trim(),
    coverColor: w.coverDominantColor ?? 'var(--cover-fallback)',
    coverInk: w.coverTextColor === 'dark' ? 'var(--surface-base)' : 'var(--text-primary)',
    statusLabel: STATUS_LABEL[w.status],
    statusColor: STATUS_COLOR[w.status],
    publicationLabel: PUBLICATION_LABEL[w.publicationStatus],
    progressLabel,
    shortProgress,
    barWidth,
    percentLabel,
    showBar,
    trackBackground: caught ? segmented.replace('VAR', 'var(--hairline)') : 'var(--hairline)',
    fillBackground: caught
      ? segmented.replace('VAR', 'var(--status-caughtup)')
      : STATUS_COLOR[w.status],
    // A caught-up serial is waiting for chapters, not mid-read, so the control
    // says what the action means there (D-104).
    canLogSession: w.status === 'reading' || w.status === 'caught_up',
    sessionCta: w.status === 'caught_up' ? 'New chapters' : 'Log a session',
    positionLabel: w.seriesPosition !== undefined ? `#${w.seriesPosition}` : '',
  };
}

/**
 * The ceiling the session stepper may reach.
 *
 * For an ongoing work there is none — capping at `progressTotal` would make a
 * caught-up serial unloggable the day new chapters land, which is the most
 * ordinary thing that happens in this library (D-105).
 */
export function sessionCeiling(w: Work): number {
  if (w.publicationStatus === 'ongoing') return Number.MAX_SAFE_INTEGER;
  return w.progressTotal ?? Number.MAX_SAFE_INTEGER;
}
