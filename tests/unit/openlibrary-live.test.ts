import { describe, expect, it, vi, afterEach } from 'vitest';
import { parseOpenLibraryResult, searchOpenLibrary } from '../../src/catalogue/openlibrary-live';

afterEach(() => vi.unstubAllGlobals());

describe('reader-initiated Open Library lookup', () => {
  it('keeps only valid work records and does not infer an edition, format adaptation, or series', () => {
    expect(parseOpenLibraryResult({ key: '/books/OL1M', title: 'An edition' })).toBeNull();
    const result = parseOpenLibraryResult({
      key: '/works/OL12W',
      title: 'A Book',
      author_name: ['A. Reader'],
      cover_i: 42,
    });
    expect(result).toMatchObject({
      corpusId: 'openlibrary:OL12W',
      formatHint: 'book',
      coverId: '42',
      authors: ['A. Reader'],
    });
    expect(result).not.toHaveProperty('seriesName');
  });

  it('makes one bounded request only after an explicit search and explains rate limits', async () => {
    const fetcher = vi.fn(
      async (_url: string) => new Response('', { status: 429, headers: { 'Retry-After': '3' } }),
    );
    vi.stubGlobal('fetch', fetcher);
    expect(await searchOpenLibrary('ab')).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(searchOpenLibrary('A Book')).rejects.toThrow('wait 3 seconds');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(url.searchParams.get('limit')).toBe('10');
    expect(url.searchParams.get('fields')).not.toBe('*');
  });
});
