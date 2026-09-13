import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db, defaultSettings } from '../../src/db/db';
import * as repo from '../../src/db/repo';
import type { Series, Work } from '../../src/db/schema';

const NOW = new Date(2026, 8, 12, 12);
const atLocalNoon = (year: number) => new Date(year, 5, 15, 12).toISOString();

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map((table) => table.clear()));
  await db.settings.put({
    ...defaultSettings('test'),
    firstTrackedAt: atLocalNoon(2024),
  });
});

afterEach(() => db.close());

async function work(title: string, over: Partial<repo.NewWorkInput> = {}): Promise<Work> {
  return repo.createWork({
    title,
    authorName: 'A. Marchetti',
    format: 'novel',
    status: 'reading',
    publicationStatus: 'complete',
    progressCurrent: 0,
    ...over,
  });
}

async function finish(item: Work, year: number, seriesId?: string) {
  await db.work.update(item.id, {
    status: 'finished',
    dateFinished: atLocalNoon(year),
    ...(seriesId ? { seriesId } : {}),
  });
}

async function series(id: string, totalEntriesKnown?: number): Promise<Series> {
  const row: Series = {
    id,
    name: id,
    sortName: id,
    source: 'user',
    externalIds: {},
    updatedAt: atLocalNoon(2026),
    ...(totalEntriesKnown === undefined ? {} : { totalEntriesKnown }),
  };
  await db.series.add(row);
  return row;
}

describe('Phase 9 statistics', () => {
  it('keeps wishlist, trash, and page sessions out of library and chapter figures', async () => {
    const finished = await work('Finished', { genres: [0] });
    await finish(finished, 2026);
    const chapterWork = await work('Chapter work', { genres: [1] });
    await repo.logSession(chapterWork.id, 12);
    const pageWork = await work('Page work', { format: 'book', genres: [1] });
    await repo.logSession(pageWork.id, 80);
    await work('Later', { status: 'wishlist', genres: [2] });
    const removed = await work('In the bin', { genres: [3] });
    await repo.softDeleteWork(removed.id);

    const stats = await repo.libraryStats(NOW);

    expect(stats.libraryTotal).toBe(3);
    expect(stats.wishlistTotal).toBe(1);
    expect(stats.finishedThisYear).toBe(1);
    expect(stats.chaptersRead).toBe(12);
    expect(await repo.chaptersRead()).toBe(12);
    expect(stats.yearsTracked).toBe(3);
    expect(stats.genres.all.map((genre) => genre.name)).not.toContain('Horror');
  });

  it('derives series completion from finished entries and known totals only', async () => {
    await series('complete-series', 2);
    await series('one-away', 3);
    await series('unknown-total');
    for (const [title, seriesId, isFinished] of [
      ['Complete one', 'complete-series', true],
      ['Complete two', 'complete-series', true],
      ['Near one', 'one-away', true],
      ['Near two', 'one-away', true],
      ['Unknown one', 'unknown-total', true],
    ] as const) {
      const item = await work(title);
      await db.work.update(item.id, { seriesId });
      if (isFinished) await finish(item, 2026, seriesId);
    }

    const stats = await repo.libraryStats(NOW);
    expect(stats.seriesStarted).toBe(3);
    expect(stats.seriesCompleted).toBe(1);
    expect(stats.seriesOneAway).toBe(1);
  });

  it('uses finished works for most-read author and reports all represented authors', async () => {
    const first = await work('First');
    const second = await work('Second');
    const other = await work('Other', { authorName: 'B. Vale' });
    const open = await work('Open', { authorName: 'C. Reed' });
    await finish(first, 2026);
    await finish(second, 2025);
    await finish(other, 2026);
    expect(open.status).toBe('reading');

    const stats = await repo.libraryStats(NOW);
    expect(stats.mostReadAuthor).toEqual({ name: 'A. Marchetti', count: 2 });
    expect(stats.authorsInLibrary).toBe(3);
    expect(stats.priorYears).toEqual([{ year: 2025, finished: 1 }]);
  });

  it('returns an integer finishing split that remains exactly one hundred percent', async () => {
    const done = await work('Done');
    await finish(done, 2026);
    await work('Dropped', { status: 'dropped' });
    await work('Open');

    const finishing = (await repo.libraryStats(NOW)).finishing;
    expect(finishing).toEqual({ finished: 34, dropped: 33, open: 33 });
    expect(finishing!.finished + finishing!.dropped + finishing!.open).toBe(100);
  });
});
