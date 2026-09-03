import { describe, it, expect } from 'vitest';
import {
  anilistFormat,
  anilistStatus,
  countryOf,
  couldBeSameWork,
  foldCountry,
  mangadexStatus,
  matchKey,
  mergeWork,
  normalizeTitle,
} from '../../pipeline/normalize.ts';
import type { CorpusWork } from '../../pipeline/types.ts';

const work = (over: Partial<CorpusWork> = {}): CorpusWork => ({
  id: 'x',
  title: 'Wind Breaker',
  title_normalized: 'wind breaker',
  synonyms: '',
  authors: '',
  format_hint: 'manhwa',
  series_id: null,
  series_position: null,
  universe_id: null,
  cover_id: null,
  cover_source: null,
  publication_status: 'unknown',
  chapter_count: null,
  volume_count: null,
  year: null,
  popularity: 0,
  external_ids: '{}',
  source: 'anilist',
  ...over,
});

describe('normalisation is shared with the app', () => {
  it('produces the same key the app searches with', () => {
    // title_normalized is what the FTS5 index holds and what the app builds its
    // side of the comparison with. Two implementations would drift and search
    // would quietly stop finding things.
    expect(normalizeTitle('The Verdigris Ledger')).toBe('verdigris ledger');
    expect(normalizeTitle('Ｓｏｌｏ Ｌｅｖｅｌｉｎｇ')).toBe('solo leveling');
  });

  it('folds punctuation for matching but not for the index', () => {
    expect(matchKey('Re:Zero — Starting Life', 'Tappei')).toBe(
      matchKey('Re Zero  Starting Life', 'tappei'),
    );
    // The control: different works must not collide.
    expect(matchKey('Wind Breaker', 'Jo Yongseok')).not.toBe(
      matchKey('Wind Breaker', 'Satoru Nii'),
    );
  });
});

describe('AniList format mapping', () => {
  it('separates a light novel from a comic', () => {
    expect(anilistFormat('NOVEL', 'JP')).toBe('novel');
    expect(anilistFormat('MANGA', 'KR')).toBe('manhwa');
    expect(anilistFormat('ONE_SHOT', 'JP')).toBe('manhwa');
    expect(anilistFormat(null, 'KR')).toBeNull();
  });

  it('never calls a comic a novel', () => {
    // The trap this whole mapping exists for: AniList holds the 96-chapter
    // MANHUA of Reverend Insanity, not the 2,334-chapter novel. Labelling it
    // 'novel' would hand the reader a chapter count wrong by 24x.
    expect(anilistFormat('MANGA', 'CN')).not.toBe('novel');
  });
});

describe('publication status mapping', () => {
  it('maps both vocabularies onto the schema', () => {
    expect(anilistStatus('RELEASING')).toBe('ongoing');
    expect(anilistStatus('CANCELLED')).toBe('abandoned');
    expect(mangadexStatus('completed')).toBe('complete');
    expect(mangadexStatus('hiatus')).toBe('hiatus');
  });

  it('falls back to unknown rather than guessing', () => {
    expect(anilistStatus('SOMETHING_NEW')).toBe('unknown');
    expect(mangadexStatus(null)).toBe('unknown');
  });
});

describe('country folding', () => {
  it('reconciles AniList and MangaDex spellings of the same fact', () => {
    expect(foldCountry('KR')).toBe(foldCountry('ko'));
    expect(foldCountry('CN')).toBe(foldCountry('zh'));
    expect(foldCountry('JP')).toBe(foldCountry('ja'));
    // The control: two different origins must stay different, or the
    // same-title merge loses its only discriminator.
    expect(foldCountry('KR')).not.toBe(foldCountry('JP'));
  });

  it('reads it off a record', () => {
    expect(countryOf(work({ external_ids: '{"country":"ko"}' }))).toBe('KR');
    expect(countryOf(work({ external_ids: 'not json' }))).toBeNull();
  });
});

describe('deciding whether two same-titled records are one work', () => {
  it('never merges two records from the same source', () => {
    // Same source, same country, same format — so ONLY the same-source rule can
    // reject this pair. An earlier version of this test used differing
    // countries and passed even with the rule deleted, which made it no test at
    // all.
    //
    // The real case from the 4,000-row sample: "Toradora!" appears twice in
    // AniList, both JP, because AniList holds the light novel AND its manga
    // adaptation. Same for Shield Hero, Konosuba and Eminence in Shadow.
    // AniList already dedupes itself, so two of its rows sharing a title are
    // always two works.
    const a = work({ source: 'anilist', title: 'Toradora!', external_ids: '{"country":"JP"}' });
    const b = work({ source: 'anilist', title: 'Toradora!', external_ids: '{"country":"JP"}' });
    expect(couldBeSameWork(a, b)).toBe(false);

    // The control: change nothing but the source, and the same pair is fine.
    expect(couldBeSameWork(a, { ...b, source: 'mangadex' })).toBe(true);
  });

  it('refuses when the country is known on both and differs', () => {
    const a = work({ source: 'anilist', external_ids: '{"country":"JP"}' });
    const b = work({ source: 'mangadex', external_ids: '{"country":"ko"}' });
    expect(couldBeSameWork(a, b)).toBe(false);
  });

  it('accepts across sources when the country agrees', () => {
    const a = work({ source: 'anilist', external_ids: '{"country":"KR"}' });
    const b = work({ source: 'mangadex', external_ids: '{"country":"ko"}' });
    expect(couldBeSameWork(a, b)).toBe(true);
  });

  it('accepts when one side does not state a country', () => {
    const a = work({ source: 'anilist', external_ids: '{"country":"KR"}' });
    const b = work({ source: 'mangadex', external_ids: '{}' });
    expect(couldBeSameWork(a, b)).toBe(true);
  });

  it('refuses when the formats disagree', () => {
    // A light novel and its manga adaptation share a title and are two works.
    const a = work({ source: 'anilist', format_hint: 'novel' });
    const b = work({ source: 'mangadex', format_hint: 'manhwa' });
    expect(couldBeSameWork(a, b)).toBe(false);
  });
});

describe('merging two records of one work', () => {
  it('takes each field from the source that actually has it', () => {
    // Precedence is a tie-break, not a licence to overwrite a fact with a null.
    // Open Library often has the only cover while AniList has the only chapter
    // count; taking the whole winning record would throw one of them away.
    const low = work({
      source: 'mangadex',
      chapter_count: 214,
      cover_id: 'md/cover.jpg',
      year: 2018,
    });
    const high = work({
      source: 'anilist',
      chapter_count: null,
      cover_id: null,
      year: null,
      popularity: 80,
    });
    const m = mergeWork(low, high);
    expect(m.source).toBe('anilist');
    expect(m.chapter_count).toBe(214);
    expect(m.cover_id).toBe('md/cover.jpg');
    expect(m.year).toBe(2018);
    expect(m.popularity).toBe(80);
  });

  it('lets a higher-ranked source win a field both have', () => {
    const low = work({ source: 'openlibrary', title: 'wind breaker (2013)' });
    const high = work({ source: 'anilist', title: 'Wind Breaker' });
    expect(mergeWork(low, high).title).toBe('Wind Breaker');
  });

  it('never lets an unknown status beat a known one', () => {
    // 'unknown' is a real value AND the default, so precedence alone would let
    // a silent source overwrite a source that actually knows.
    const known = work({ source: 'mangadex', publication_status: 'ongoing' });
    const silent = work({ source: 'anilist', publication_status: 'unknown' });
    expect(mergeWork(known, silent).publication_status).toBe('ongoing');
    expect(mergeWork(silent, known).publication_status).toBe('ongoing');
  });

  it('accumulates every alternate title rather than picking one', () => {
    const a = work({ source: 'anilist', title: 'Solo Leveling', synonyms: 'Na Honjaman Level Up' });
    const b = work({ source: 'mangadex', title: 'Only I Level Up', synonyms: '나 혼자만 레벨업' });
    const lines = mergeWork(a, b).synonyms.split('\n');
    // Every spelling any source knows is another way the reader might search.
    expect(lines).toContain('Na Honjaman Level Up');
    expect(lines).toContain('나 혼자만 레벨업');
    expect(lines).toContain('Only I Level Up');
  });

  it('keeps both sides of external_ids', () => {
    const a = work({ source: 'anilist', external_ids: '{"anilist":123}' });
    const b = work({ source: 'mangadex', external_ids: '{"mangadex":"abc"}' });
    const ids = JSON.parse(mergeWork(a, b).external_ids) as Record<string, unknown>;
    expect(ids['anilist']).toBe(123);
    expect(ids['mangadex']).toBe('abc');
  });
});
