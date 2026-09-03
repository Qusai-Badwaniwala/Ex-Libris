import { describe, it, expect } from 'vitest';
import {
  GENRES,
  GENRE_NAMES,
  ALL_TAGS,
  TAG_GROUP_MEMBERSHIP,
  isWarningOnly,
  visibleTags,
  genreIndexByName,
} from '../../src/data/taxonomy';

describe('the twelve genres', () => {
  it('are indexed by their colour, with no gaps', () => {
    // A work stores the index. If GENRES ever stops being ordered by
    // colorIndex, every lookup by position silently returns the wrong genre and
    // the whole library recolours without a single error.
    expect(GENRES).toHaveLength(12);
    GENRES.forEach((g, i) => expect(g.colorIndex).toBe(i));
  });

  it('put Progression & Cultivation on the accent hue, deliberately', () => {
    // D-095. The one non-obvious assignment in the table, and the one most
    // likely to be "tidied" by someone alphabetising the list.
    expect(genreIndexByName('Progression & Cultivation')).toBe(1);
    expect(GENRE_NAMES[4]).toBe('Fantasy');
  });
});

describe('the seeded vocabulary', () => {
  it('holds 242 tags', () => {
    expect(ALL_TAGS).toHaveLength(242);
  });

  it('records both groups for a string that genuinely sits in two', () => {
    expect(TAG_GROUP_MEMBERSHIP.get('Body Horror')).toEqual(['Subgenre', 'Content warnings']);
    expect(TAG_GROUP_MEMBERSHIP.get('Slavery')).toEqual(['Themes', 'Content warnings']);
  });
});

describe('content warnings, off by default', () => {
  it('hides a tag whose only group is Content warnings', () => {
    expect(isWarningOnly('Gore')).toBe(true);
    expect(isWarningOnly('Torture')).toBe(true);
    expect(visibleTags(['Xianxia', 'Gore'], false)).toEqual(['Xianxia']);
  });

  it('keeps a warning string that also earns its place as a subgenre or theme', () => {
    // Q-016, settled 2026-09-03. Hiding "Body Horror" as a warning also removed
    // it as a legitimate subgenre, which is correct by the letter of the rule
    // and wrong in spirit. Membership in a second group is what saves it.
    expect(isWarningOnly('Body Horror')).toBe(false);
    expect(isWarningOnly('Slavery')).toBe(false);
    expect(visibleTags(['Body Horror', 'Gore'], false)).toEqual(['Body Horror']);
  });

  it('shows everything when the toggle is on', () => {
    expect(visibleTags(['Body Horror', 'Gore'], true)).toEqual(['Body Horror', 'Gore']);
  });

  it('leaves a tag outside the seed vocabulary alone', () => {
    // A tag the reader invented has no group membership. It must never be
    // treated as a warning by default — silence is not a warning.
    expect(isWarningOnly('Something I Made Up')).toBe(false);
    expect(visibleTags(['Something I Made Up'], false)).toEqual(['Something I Made Up']);
  });
});
