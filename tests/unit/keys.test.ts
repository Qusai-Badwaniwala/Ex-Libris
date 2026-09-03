import { describe, it, expect } from 'vitest';
import { sortTitleOf, sortNameOf, normalizeTag } from '../../src/db/keys';

describe('sortTitleOf', () => {
  it('strips a leading article so the title files under its first real word', () => {
    expect(sortTitleOf('The Verdigris Ledger')).toBe('verdigris ledger');
    expect(sortTitleOf('A Cartography of Debts')).toBe('cartography of debts');
    expect(sortTitleOf('An Empty Shelf')).toBe('empty shelf');
  });

  it('keeps an article that is part of the first word', () => {
    // The control. Without it, a prefix match would file "Theodore" under
    // "odore" and the test above would pass for the wrong reason.
    expect(sortTitleOf('Theodore Rex')).toBe('theodore rex');
    expect(sortTitleOf('Anchorage')).toBe('anchorage');
  });

  it('does not strip an article that is the whole title', () => {
    expect(sortTitleOf('The')).toBe('the');
  });

  it('normalises unicode so two titles that look alike sort alike', () => {
    // Full-width characters come out of AniList; composed and decomposed
    // accents come out of Open Library. Both must reach one key.
    expect(sortTitleOf('Ｓａｌｔｂｏｕｎｄ')).toBe('saltbound');
    expect(sortTitleOf('Inés')).toBe(sortTitleOf('Inés'));
  });

  it('folds curly quotes, which the catalogue and the keyboard disagree about', () => {
    expect(sortTitleOf('The Cartographer’s Debt')).toBe("cartographer's debt");
  });
});

describe('sortNameOf', () => {
  it('inverts a personal name', () => {
    expect(sortNameOf('Pierce Brown')).toBe('Brown, Pierce');
    expect(sortNameOf('Yun Hae-won')).toBe('Hae-won, Yun');
  });

  it('leaves a single-token name alone', () => {
    // Manhwa credits studios and mononyms constantly. "Baekdu, Studio" is wrong
    // and would sort a publisher under a first name.
    expect(sortNameOf('Baekdu')).toBe('Baekdu');
  });

  it('keeps middle names with the forename', () => {
    expect(sortNameOf('H. P. Lovecraft')).toBe('Lovecraft, H. P.');
  });

  it('returns empty for empty, rather than a stray comma', () => {
    expect(sortNameOf('   ')).toBe('');
  });
});

describe('normalizeTag', () => {
  it('collapses the cases SCHEMA §7 says must merge', () => {
    expect(normalizeTag('LitRPG')).toBe(normalizeTag('litrpg'));
    expect(normalizeTag('  Dark  Fantasy ')).toBe('dark fantasy');
  });

  it('does not merge tags that are genuinely different', () => {
    // The control: without it, an over-eager normaliser that stripped
    // everything would pass the assertion above.
    expect(normalizeTag('Dark Fantasy')).not.toBe(normalizeTag('Grimdark'));
  });
});
