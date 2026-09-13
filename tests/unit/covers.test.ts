import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../src/db/db';
import * as repo from '../../src/db/repo';
import {
  contrastTextForColor,
  dominantColorFromPixels,
  fetchCoverBlob,
  fittedCoverDimensions,
  InvalidCoverImage,
} from '../../src/covers';
import { dexieCoverRepository } from '../../src/covers/repository';
import { createCoverService } from '../../src/covers/service';
import { coverStoragePath } from '../../src/covers/storage';
import type { CoverImageProcessor, ProcessedCover } from '../../src/covers/image';
import type { CoverBinaryStore } from '../../src/covers/storage';

const processed: ProcessedCover = {
  blob: new Blob(['processed'], { type: 'image/webp' }),
  mimeType: 'image/webp',
  extension: 'webp',
  width: 600,
  height: 900,
  dominantColor: '#285078',
  textColor: 'light',
};

function processor(onProcess?: () => void): CoverImageProcessor {
  return {
    async process() {
      onProcess?.();
      return processed;
    },
  };
}

function binaryStore() {
  const files = new Map<string, Blob>();
  let next = 0;
  const store: CoverBinaryStore = {
    async write(source, workId, cover) {
      const path = `covers/${source}/${workId}/${++next}.${cover.extension}`;
      files.set(path, cover.blob);
      return path;
    },
    async read(path) {
      return files.get(path) ?? null;
    },
    async delete(path) {
      return files.delete(path);
    },
  };
  return { store, files };
}

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map((table) => table.clear()));
});

afterEach(() => {
  db.close();
});

describe('cover image facts', () => {
  it('fits to 600px without upscaling and keeps the aspect ratio', () => {
    expect(fittedCoverDimensions(1200, 1800)).toEqual({ width: 600, height: 900 });
    expect(fittedCoverDimensions(320, 480)).toEqual({ width: 320, height: 480 });
    expect(fittedCoverDimensions(600, 6000)).toEqual({ width: 268, height: 2683 });
  });

  it('extracts a deterministic quantised winner and ignores transparent pixels', () => {
    const data = new Uint8ClampedArray([
      250, 10, 12, 255, 246, 14, 10, 255, 10, 20, 250, 255, 0, 0, 0, 0,
    ]);
    expect(dominantColorFromPixels({ data, width: 2, height: 2 })).toBe('#F80C0B');
    expect(dominantColorFromPixels({ data: new Uint8ClampedArray(4), width: 1, height: 1 })).toBe(
      '#000000',
    );
  });

  it('chooses the stronger light or dark text contrast', () => {
    expect(contrastTextForColor('#101820')).toBe('light');
    expect(contrastTextForColor('#F7EFD9')).toBe('dark');
    expect(contrastTextForColor('not-a-colour')).toBe('light');
  });

  it('rejects non-images before decode and accepts a bounded image response', async () => {
    const htmlFetcher = vi.fn(
      async () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } }),
    );
    await expect(
      fetchCoverBlob('https://example.test/not-image', { fetcher: htmlFetcher }),
    ).rejects.toThrow('did not return an image');

    const imageFetcher = vi.fn(
      async () =>
        new Response(new Uint8Array([1, 2, 3, 4]), {
          headers: { 'content-type': 'image/jpeg' },
        }),
    );
    const image = await fetchCoverBlob('https://example.test/cover.jpg', {
      fetcher: imageFetcher,
    });
    expect(image.size).toBe(4);
    expect(image.type).toBe('image/jpeg');
    await expect(fetchCoverBlob('data:image/png;base64,AAAA')).rejects.toBeInstanceOf(
      InvalidCoverImage,
    );
  });
});

describe('cover storage and precedence', () => {
  it('keeps user and API files in physically separate namespaces', () => {
    expect(coverStoragePath('user', 'work-1', 'one', 'webp')).toBe('covers/user/work-1/one.webp');
    expect(coverStoragePath('api', 'work-1', 'one', 'webp')).toBe('covers/api/work-1/one.webp');
  });

  it('stores a user cover and removes the superseded API file only after commit', async () => {
    const work = await repo.createWork({
      title: 'Piranesi',
      format: 'book',
      status: 'reading',
    });
    await db.work.update(work.id, {
      coverSource: 'api',
      coverPath: 'covers/api/old.webp',
      coverRemoteUrl: 'https://example.test/old.jpg',
    });
    const binaries = binaryStore();
    binaries.files.set('covers/api/old.webp', new Blob(['old']));
    const covers = createCoverService({
      records: dexieCoverRepository,
      binaries: binaries.store,
      processor: processor(),
      fetcher: fetch,
    });

    const result = await covers.selectUserCover(work.id, new Blob(['new'], { type: 'image/jpeg' }));

    expect(result.outcome).toBe('stored');
    expect(result.work.coverSource).toBe('user');
    expect(result.work.coverPath).toMatch(/^covers\/user\//);
    expect(result.work.coverRemoteUrl).toBe('https://example.test/old.jpg');
    expect(result.work.coverDominantColor).toBe('#285078');
    expect(binaries.files.has('covers/api/old.webp')).toBe(false);
  });

  it('does not even fetch when a user cover already owns the record', async () => {
    const work = await repo.createWork({ title: 'Circe', format: 'book', status: 'wishlist' });
    await db.work.update(work.id, { coverSource: 'user', coverPath: 'covers/user/current.webp' });
    const binaries = binaryStore();
    const fetcher = vi.fn<typeof fetch>();
    const covers = createCoverService({
      records: dexieCoverRepository,
      binaries: binaries.store,
      processor: processor(),
      fetcher,
    });

    const result = await covers.fetchApiCover(work.id, 'https://example.test/api.jpg');

    expect(result.outcome).toBe('skipped-user-cover');
    expect(fetcher).not.toHaveBeenCalled();
    expect(binaries.files.size).toBe(0);
  });

  it('rechecks user precedence after a late API response and discards that response', async () => {
    const work = await repo.createWork({ title: 'Dune', format: 'book', status: 'reading' });
    const binaries = binaryStore();
    const fetcher = vi.fn(async () => {
      await db.work.update(work.id, {
        coverSource: 'user',
        coverPath: 'covers/user/won-the-race.webp',
      });
      return new Response(new Uint8Array([1, 2, 3, 4]), {
        headers: { 'content-type': 'image/jpeg' },
      });
    });
    const covers = createCoverService({
      records: dexieCoverRepository,
      binaries: binaries.store,
      processor: processor(),
      fetcher,
    });

    const result = await covers.fetchApiCover(work.id, 'https://example.test/api.jpg');

    expect(result.outcome).toBe('skipped-user-cover');
    expect(result.work.coverPath).toBe('covers/user/won-the-race.webp');
    expect(binaries.files.size).toBe(0);
  });

  it('can replace, remove and later retry an API cover without losing its source URL', async () => {
    const work = await repo.createWork({
      title: 'The Spear Cuts Through Water',
      format: 'book',
      status: 'reading',
    });
    const binaries = binaryStore();
    const fetcher = vi.fn(
      async () =>
        new Response(new Uint8Array([1, 2, 3, 4]), {
          headers: { 'content-type': 'image/jpeg' },
        }),
    );
    const covers = createCoverService({
      records: dexieCoverRepository,
      binaries: binaries.store,
      processor: processor(),
      fetcher,
    });

    const first = await covers.fetchApiCover(work.id, 'https://example.test/one.jpg');
    const second = await covers.fetchApiCover(work.id, 'https://example.test/two.jpg');
    const removed = await covers.removeCover(work.id);

    expect(first.outcome).toBe('stored');
    expect(second.outcome).toBe('stored');
    expect(first.work.coverPath).not.toBe(second.work.coverPath);
    expect(removed.outcome).toBe('removed');
    expect(removed.work.coverSource).toBe('none');
    expect(removed.work.coverRemoteUrl).toBe('https://example.test/two.jpg');
    expect(binaries.files.size).toBe(0);
  });

  it('leaves the record and old file untouched when processing fails', async () => {
    const work = await repo.createWork({
      title: 'A Memory Called Empire',
      format: 'book',
      status: 'wishlist',
    });
    await db.work.update(work.id, { coverSource: 'user', coverPath: 'covers/user/original.webp' });
    const binaries = binaryStore();
    binaries.files.set('covers/user/original.webp', new Blob(['old']));
    const covers = createCoverService({
      records: dexieCoverRepository,
      binaries: binaries.store,
      processor: {
        process: async () => {
          throw new Error('decode failed');
        },
      },
      fetcher: fetch,
    });

    await expect(
      covers.replaceUserCover(work.id, new Blob(['bad'], { type: 'image/jpeg' })),
    ).rejects.toThrow('decode failed');
    expect((await db.work.get(work.id))?.coverPath).toBe('covers/user/original.webp');
    expect(binaries.files.has('covers/user/original.webp')).toBe(true);
  });
});
