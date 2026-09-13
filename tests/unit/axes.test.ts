import { describe, expect, it } from 'vitest';
import { matchedAxesSentence, moreLikeThis } from '../../src/axes/axes';
import type { AxisRating, Work } from '../../src/db/schema';

const work = (id: string, over: Partial<Work> = {}): Work => ({
  id,
  title: id,
  sortTitle: id,
  format: 'book',
  authorIds: [],
  status: 'finished',
  publicationStatus: 'complete',
  progressUnit: 'page',
  progressCurrent: 1,
  genres: [],
  tagIds: [],
  dateAdded: '2026-09-08T00:00:00.000Z',
  coverSource: 'none',
  externalIds: {},
  isManualEntry: true,
  isTranslated: false,
  updatedAt: '2026-09-08T00:00:00.000Z',
  ...over,
});

const rating = (workId: string, over: Partial<AxisRating> = {}): AxisRating => ({
  workId,
  protagonist: 5,
  powerSystem: 4,
  world: 5,
  pacing: 3,
  prose: 4,
  ending: 5,
  ...over,
});

describe('explainable axis matching', () => {
  it('requires three honestly shared axes and never recommends Wishlist entries', () => {
    const target = rating('target');
    const tooSparse = rating('sparse', {
      world: undefined,
      pacing: undefined,
      prose: undefined,
      ending: undefined,
    });
    expect(
      moreLikeThis('target', target, [
        { work: work('sparse'), rating: tooSparse },
        { work: work('wish', { status: 'wishlist' }), rating: rating('wish') },
      ]),
    ).toEqual([]);
  });

  it('uses the six approved axes and ignores Translation when ranking', () => {
    const target = rating('target', { translation: 1 });
    const rows = moreLikeThis('target', target, [
      { work: work('a'), rating: rating('a', { translation: 5 }) },
      { work: work('b'), rating: rating('b', { translation: 1, pacing: 1 }) },
    ]);
    expect(rows.map(({ work: row }) => row.id)).toEqual(['a', 'b']);
    expect(rows[0]?.sharedAxes).not.toContain('translation');
  });

  it('explains exact shared stops with their words and never exposes the score', () => {
    const target = rating('target');
    const [match] = moreLikeThis('target', target, [
      { work: work('match'), rating: rating('match', { prose: 2, ending: 3 }) },
    ]);
    expect(match?.matchedAxes).toEqual(['protagonist', 'powerSystem', 'world']);
    expect(matchedAxesSentence(match!.matchedAxes, match!.rating)).toBe(
      'Matched on Monstrous, Codified and Merciless.',
    );
  });
});
