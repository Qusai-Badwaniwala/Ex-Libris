import { describe, expect, it } from 'vitest';
import {
  FIXED_SPINE_THRESHOLDS,
  SPINE_ROW_SLOT,
  createSpineWidthProfile,
  packSpineRows,
  spineBucket,
  spineHeight,
  spineWidth,
  visibleSpineRows,
} from '../../src/spine/layout';

describe('Phase 9 spine layout', () => {
  it('keeps the approved separate chapter and page ladders', () => {
    expect(spineWidth({ progressCurrent: 39, progressUnit: 'chapter' })).toBe(12);
    expect(spineWidth({ progressCurrent: 40, progressUnit: 'chapter' })).toBe(18);
    expect(spineWidth({ progressCurrent: 699, progressUnit: 'page' })).toBe(26);
    expect(spineWidth({ progressCurrent: 1000, progressUnit: 'page' })).toBe(48);
  });

  it('keeps the fixed ladder until a unit has forty known lengths', () => {
    const profile = createSpineWidthProfile(
      Array.from({ length: 39 }, (_, index) => ({
        id: `work-${index}`,
        progressCurrent: index + 1,
        progressUnit: 'chapter' as const,
      })),
    );
    expect(profile.thresholds).toEqual(FIXED_SPINE_THRESHOLDS);
    expect(profile.adaptiveUnits).toEqual([]);
  });

  it('uses deterministic per-unit quintiles once the approved sample is large enough', () => {
    const profile = createSpineWidthProfile(
      Array.from({ length: 40 }, (_, index) => ({
        id: `work-${index}`,
        progressCurrent: index + 1,
        progressUnit: 'chapter' as const,
      })),
    );
    expect(profile.thresholds.chapter).toEqual([9, 17, 25, 33]);
    expect(profile.thresholds.page).toEqual(FIXED_SPINE_THRESHOLDS.page);
    expect(profile.adaptiveUnits).toEqual(['chapter']);
  });

  it('reuses an exact cached profile and invalidates it when the library changes', () => {
    const works = Array.from({ length: 40 }, (_, index) => ({
      id: `work-${index}`,
      progressCurrent: index + 1,
      progressUnit: 'chapter' as const,
    }));
    const first = createSpineWidthProfile(works);
    expect(createSpineWidthProfile(works, first)).toBe(first);
    const next = createSpineWidthProfile([
      ...works,
      { id: 'work-40', progressCurrent: 41, progressUnit: 'chapter' as const },
    ]);
    expect(next.signature).not.toBe(first.signature);
  });

  it('ignores malformed caches and keeps tied values as a strict ladder', () => {
    const profile = createSpineWidthProfile(
      Array.from({ length: 40 }, (_, index) => ({
        id: `work-${index}`,
        progressCurrent: 10,
        progressUnit: 'page' as const,
      })),
      { version: 1, signature: 'wrong', thresholds: { chapter: [1], page: [1] } },
    );
    expect(profile.thresholds.page).toEqual([11, 12, 13, 14]);
    expect(profile.adaptiveUnits).toEqual(['page']);
  });

  it('uses the modal width when length is absent or is only a percentage', () => {
    expect(spineBucket({ progressCurrent: 0, progressUnit: 'chapter' })).toBe(1);
    expect(spineBucket({ progressCurrent: 45, progressTotal: 100, progressUnit: 'percent' })).toBe(
      1,
    );
  });

  it('gives a work the same non-semantic height every time', () => {
    expect(spineHeight('work-42')).toBe(spineHeight('work-42'));
    expect(spineHeight('work-42')).toBeGreaterThanOrEqual(148);
    expect(spineHeight('work-42')).toBeLessThanOrEqual(190);
  });

  it('packs complete shelf rows without crossing the measured budget', () => {
    const rows = packSpineRows(
      [{ width: 48 }, { width: 48 }, { width: 48 }, { width: 48 }, { width: 48 }],
      150,
    );
    expect(rows.map((row) => row.length)).toEqual([3, 2]);
  });

  it('mounts only the viewport and bounded overscan at either end', () => {
    expect(visibleSpineRows(0, 800, 100, 100)).toEqual({ start: 0, end: 8 });
    const middle = visibleSpineRows(40 * SPINE_ROW_SLOT, 800, 100, 100);
    expect(middle.start).toBe(35);
    expect(middle.end).toBe(48);
    expect(visibleSpineRows(100 * SPINE_ROW_SLOT, 800, 100, 100)).toEqual({
      start: 95,
      end: 100,
    });
  });
});
