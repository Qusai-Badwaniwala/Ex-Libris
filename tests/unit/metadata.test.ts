import { describe, expect, it, vi } from 'vitest';
import {
  catalogueCoverUrl,
  normalizeOpenLibraryCoverId,
  openLibraryCoverUrl,
} from '../../src/metadata/cover-urls';
import {
  lookupOpenLibraryMetadata,
  normalizeOpenLibraryEditionId,
  normalizeOpenLibraryWorkId,
  parseOpenLibraryEdition,
  parseOpenLibraryWork,
} from '../../src/metadata/openlibrary';

describe('catalogue cover addresses', () => {
  it('derives the documented Open Library CoverID address used by the production index', () => {
    expect(normalizeOpenLibraryCoverId(' 12547191 ')).toBe('12547191');
    expect(openLibraryCoverUrl('12547191')).toBe(
      'https://covers.openlibrary.org/b/id/12547191-L.jpg?default=false',
    );
    expect(catalogueCoverUrl({ coverId: '12547191', coverSource: 'openlibrary' })).toBe(
      'https://covers.openlibrary.org/b/id/12547191-L.jpg?default=false',
    );
  });

  it('refuses malformed, missing and unsupported source identifiers', () => {
    expect(openLibraryCoverUrl('-1')).toBeUndefined();
    expect(openLibraryCoverUrl('OL123W')).toBeUndefined();
    expect(
      catalogueCoverUrl({ coverId: 'https://other.test/x.jpg', coverSource: 'anilist' }),
    ).toBeUndefined();
    expect(
      catalogueCoverUrl({ coverId: 'too/many/parts', coverSource: 'mangadex' }),
    ).toBeUndefined();
  });

  it('derives the existing bounded MangaDex live-cover address', () => {
    expect(catalogueCoverUrl({ coverId: 'manga-id/cover.jpg', coverSource: 'mangadex' })).toBe(
      'https://uploads.mangadex.org/covers/manga-id/cover.jpg.512.jpg',
    );
  });
});

describe('Open Library metadata', () => {
  it('normalises only identifiers of the requested entity kind', () => {
    expect(normalizeOpenLibraryWorkId('/works/ol15626917w')).toBe('OL15626917W');
    expect(normalizeOpenLibraryEditionId('https://openlibrary.org/books/OL7353617M.json')).toBe(
      'OL7353617M',
    );
    expect(normalizeOpenLibraryWorkId('OL7353617M')).toBeUndefined();
  });

  it('parses only real positive facts and never invents an edition page count', () => {
    expect(
      parseOpenLibraryWork({
        title: 'Piranesi',
        subtitle: 'A Novel',
        description: { value: 'A house without end.' },
        first_publish_date: '2020',
        covers: [-1, 123],
        authors: [{ author: { key: '/authors/OL1A' } }],
      }),
    ).toEqual({
      title: 'Piranesi',
      subtitle: 'A Novel',
      description: 'A house without end.',
      firstPublishYear: 2020,
      coverId: '123',
      authorIds: ['OL1A'],
    });
    expect(
      parseOpenLibraryEdition({ number_of_pages: 'unknown', covers: [-1] }).pageCount,
    ).toBeUndefined();
    expect(parseOpenLibraryEdition({ number_of_pages: 272 }).pageCount).toBe(272);
  });

  it('uses an exact edition for page count and cover, while retaining work-level facts', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/works/OL1W.json')) {
        return Response.json({
          title: 'The Work Title',
          description: 'Known work description.',
          first_publish_date: '2001',
          covers: [100],
          authors: [{ author: { key: '/authors/OL2A' } }],
        });
      }
      if (url.endsWith('/books/OL3M.json')) {
        return Response.json({
          title: 'The Edition Title',
          number_of_pages: 416,
          covers: [200],
          isbn_13: ['9780000000002'],
        });
      }
      return new Response(null, { status: 404 });
    });

    const metadata = await lookupOpenLibraryMetadata(
      { workId: 'OL1W', editionId: 'OL3M' },
      { fetcher },
    );

    expect(metadata).toEqual({
      source: 'openlibrary',
      workId: 'OL1W',
      editionId: 'OL3M',
      title: 'The Edition Title',
      authorIds: ['OL2A'],
      description: 'Known work description.',
      firstPublishYear: 2001,
      pageCount: 416,
      coverId: '200',
      coverUrl: 'https://covers.openlibrary.org/b/id/200-L.jpg?default=false',
      isbn13: '9780000000002',
    });
  });

  it('reports invalid ids, rate limits and unreadable payloads instead of empty success', async () => {
    await expect(lookupOpenLibraryMetadata({ workId: 'not-an-id' })).rejects.toThrow(
      'identifier is invalid',
    );
    const limited = vi.fn(
      async () => new Response(null, { status: 429, headers: { 'Retry-After': '5' } }),
    );
    await expect(
      lookupOpenLibraryMetadata({ workId: 'OL1W' }, { fetcher: limited }),
    ).rejects.toThrow('wait 5 seconds');
    const unreadable = vi.fn(async () => Response.json([]));
    await expect(
      lookupOpenLibraryMetadata({ workId: 'OL1W' }, { fetcher: unreadable }),
    ).rejects.toThrow('unreadable metadata');
  });
});
