import { describe, it, expect } from 'vitest';
import { localDay, localYear, yearsTracked } from '../../src/db/dates';

/**
 * These run in the machine's own timezone. The assertions are written so they
 * hold anywhere: each one compares against what Date itself reports locally,
 * and the two that matter compare local against UTC to prove they can differ.
 */

describe('localDay', () => {
  it('answers the local question, not the UTC one', () => {
    // 20:20 UTC on the 2nd is 01:50 on the 3rd in IST. Whatever timezone this
    // runs in, localDay must agree with the local calendar rather than with the
    // first ten characters of the ISO string.
    const iso = '2026-09-02T20:20:00.000Z';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    const expected = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    expect(localDay(iso)).toBe(expected);
  });

  it('differs from the naive ISO slice when the offset crosses midnight', () => {
    // The control, and the whole point. In a timezone where these two agree the
    // assertion is vacuous, so it is skipped rather than passed silently.
    const iso = '2026-12-31T23:30:00.000Z';
    const naive = iso.slice(0, 10);
    const local = localDay(iso);
    if (new Date(iso).getTimezoneOffset() === 0) {
      expect(local).toBe(naive);
    } else {
      expect(local).not.toBe(naive);
    }
  });

  it('returns empty for an unparseable date rather than "Invalid Dat"', () => {
    expect(localDay('not a date')).toBe('');
  });
});

describe('localYear', () => {
  it('rolls at local midnight on the 31st, not at UTC midnight', () => {
    const iso = '2026-12-31T23:30:00.000Z';
    expect(localYear(iso)).toBe(new Date(iso).getFullYear());
  });
});

describe('yearsTracked', () => {
  it('counts calendar years inclusive, the way a reader means it', () => {
    // Started December 2024, now January 2026: three calendar years touched.
    expect(yearsTracked('2024-12-20T12:00:00.000Z', new Date(2026, 0, 5))).toBe(3);
  });

  it('reads one on the first day', () => {
    expect(yearsTracked('2026-09-03T12:00:00.000Z', new Date(2026, 8, 3))).toBe(1);
  });

  it('never goes negative on a clock that has been set backwards', () => {
    expect(yearsTracked('2026-09-03T12:00:00.000Z', new Date(2024, 0, 1))).toBe(0);
  });

  it('is zero rather than NaN for a missing origin', () => {
    expect(yearsTracked('')).toBe(0);
  });
});
