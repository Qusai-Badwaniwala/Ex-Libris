import type { ProgressUnit, SpineWidthProfileSetting, Work } from '../db/schema';

export const SPINE_WIDTHS = [12, 18, 26, 36, 48] as const;
export const SPINE_GAP = 3;
export const SPINE_ROW_HEIGHT = 196;
export const SPINE_ROW_GAP = 20;
export const SPINE_ROW_SLOT = SPINE_ROW_HEIGHT + SPINE_ROW_GAP;

export type SpineThresholds = Readonly<
  Record<Exclude<ProgressUnit, 'percent'>, readonly [number, number, number, number]>
>;

/** D-027's fixed logarithmic ladder. Phase 9 keeps it as the truthful fallback
 * for small libraries, where distribution-derived thresholds would be noise. */
export const FIXED_SPINE_THRESHOLDS: SpineThresholds = {
  chapter: [40, 150, 500, 1200],
  page: [200, 400, 700, 1000],
};

export const MIN_ADAPTIVE_SPINE_SAMPLE = 40;

export type SpineWidthProfile = SpineWidthProfileSetting;

type SpineLength = Pick<Work, 'id' | 'progressCurrent' | 'progressTotal' | 'progressUnit'>;

function knownLength(work: SpineLength): number | undefined {
  if (work.progressUnit === 'percent') return undefined;
  const value = work.progressTotal ?? work.progressCurrent;
  return value && Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
}

function librarySignature(works: SpineLength[]): string {
  let hash = 2166136261;
  const rows = works
    .map((work) => `${work.id}:${work.progressUnit}:${knownLength(work) ?? ''}`)
    .sort();
  for (const character of rows.join('|')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${works.length}-${(hash >>> 0).toString(16)}`;
}

function quintileThresholds(values: number[]): [number, number, number, number] {
  const sorted = values.slice().sort((left, right) => left - right);
  const out: number[] = [];
  for (const fraction of [0.2, 0.4, 0.6, 0.8]) {
    const boundary = sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)]! + 1;
    out.push(Math.max(boundary, (out.at(-1) ?? 0) + 1));
  }
  return [out[0]!, out[1]!, out[2]!, out[3]!];
}

export function isSpineWidthProfile(value: unknown): value is SpineWidthProfile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Partial<SpineWidthProfile>;
  if (profile.version !== 1 || typeof profile.signature !== 'string' || !profile.thresholds)
    return false;
  const validLadder = (ladder: unknown) =>
    Array.isArray(ladder) &&
    ladder.length === 4 &&
    ladder.every(
      (entry, index) =>
        typeof entry === 'number' &&
        Number.isFinite(entry) &&
        entry > 0 &&
        (index === 0 || entry > ladder[index - 1]!),
    );
  return (
    validLadder(profile.thresholds.chapter) &&
    validLadder(profile.thresholds.page) &&
    Array.isArray(profile.adaptiveUnits) &&
    profile.adaptiveUnits.every((unit) => unit === 'chapter' || unit === 'page')
  );
}

/** Q-019: derive separate quintile ladders only when that unit has enough real
 * lengths to describe a distribution. The signature lets settings reuse the
 * exact profile until the library itself changes. */
export function createSpineWidthProfile(works: SpineLength[], cached?: unknown): SpineWidthProfile {
  const signature = librarySignature(works);
  if (isSpineWidthProfile(cached) && cached.signature === signature) return cached;
  const adaptiveUnits: SpineWidthProfile['adaptiveUnits'] = [];
  const thresholds: SpineWidthProfile['thresholds'] = {
    chapter: [...FIXED_SPINE_THRESHOLDS.chapter],
    page: [...FIXED_SPINE_THRESHOLDS.page],
  };
  for (const unit of ['chapter', 'page'] as const) {
    const values = works
      .filter((work) => work.progressUnit === unit)
      .map(knownLength)
      .filter((value): value is number => value !== undefined);
    if (values.length >= MIN_ADAPTIVE_SPINE_SAMPLE) {
      thresholds[unit] = quintileThresholds(values);
      adaptiveUnits.push(unit);
    }
  }
  return { version: 1, signature, thresholds, adaptiveUnits };
}

export function spineBucket(
  work: Pick<Work, 'progressCurrent' | 'progressTotal' | 'progressUnit'>,
  thresholds: SpineThresholds = FIXED_SPINE_THRESHOLDS,
): 0 | 1 | 2 | 3 | 4 {
  const amount = work.progressTotal ?? work.progressCurrent;
  // Missing length is deliberately ordinary rather than conspicuous (D-028).
  if (!amount || work.progressUnit === 'percent') return 1;
  const ladder = thresholds[work.progressUnit];
  if (amount < ladder[0]) return 0;
  if (amount < ladder[1]) return 1;
  if (amount < ladder[2]) return 2;
  if (amount < ladder[3]) return 3;
  return 4;
}

export function spineWidth(
  work: Pick<Work, 'progressCurrent' | 'progressTotal' | 'progressUnit'>,
  thresholds: SpineThresholds = FIXED_SPINE_THRESHOLDS,
): number {
  return SPINE_WIDTHS[spineBucket(work, thresholds)];
}

/** Height carries no information and must stay stable while virtual rows recycle. */
export function spineHeight(id: string): number {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) % 997;
  return 148 + (hash % 43);
}

export function packSpineRows<T extends { width: number }>(spines: T[], width: number): T[][] {
  const rows: T[][] = [];
  let row: T[] = [];
  let used = 0;
  for (const spine of spines) {
    const next = spine.width + (row.length ? SPINE_GAP : 0);
    if (row.length && used + next > width) {
      rows.push(row);
      row = [];
      used = 0;
    }
    row.push(spine);
    used += spine.width + (row.length > 1 ? SPINE_GAP : 0);
  }
  if (row.length) rows.push(row);
  return rows;
}

export interface VisibleRowRange {
  start: number;
  end: number;
}

/** Window fixed-height shelf rows. The viewport plus four rows on each side is
 * enough for a fast fling without mounting the whole library. */
export function visibleSpineRows(
  scrollTop: number,
  viewportHeight: number,
  shelfTop: number,
  rowCount: number,
  overscan = 4,
): VisibleRowRange {
  if (rowCount <= 0) return { start: 0, end: 0 };
  const localTop = Math.max(0, scrollTop - shelfTop);
  const localBottom = Math.max(0, scrollTop + viewportHeight - shelfTop);
  const start = Math.max(0, Math.floor(localTop / SPINE_ROW_SLOT) - overscan);
  const end = Math.min(rowCount, Math.ceil(localBottom / SPINE_ROW_SLOT) + overscan);
  return { start, end: Math.max(start + 1, end) };
}
