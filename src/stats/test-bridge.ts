import { db, saveSettings } from '../db/db';
import { sortTitleOf } from '../db/keys';
import type { Author, ReadingSession, Series, Work } from '../db/schema';
import { nav } from '../router/router';

interface Phase9TestBridge {
  seedStats(): Promise<void>;
  seedSpines(count: number): Promise<void>;
  openStats(): void;
  openSpine(): void;
}

declare global {
  interface Window {
    __EXL_PHASE9_TEST__?: Phase9TestBridge;
  }
}

const iso = (year: number, month = 5, day = 15) => new Date(year, month, day, 12).toISOString();

const baseWork = (id: string, title: string, over: Partial<Work> = {}): Work => ({
  id,
  title,
  sortTitle: sortTitleOf(title),
  format: 'novel',
  authorIds: [],
  status: 'reading',
  publicationStatus: 'complete',
  progressUnit: 'chapter',
  progressCurrent: 0,
  coverSource: 'none',
  tagIds: [],
  genres: [],
  isTranslated: false,
  dateAdded: iso(2024),
  externalIds: {},
  isManualEntry: true,
  updatedAt: iso(2026),
  ...over,
});

window.__EXL_PHASE9_TEST__ = {
  async seedStats() {
    const authors: Author[] = [
      { id: 'author:a', name: 'A. Marchetti', sortName: 'marchetti a', externalIds: {} },
      { id: 'author:b', name: 'B. Vale', sortName: 'vale b', externalIds: {} },
      { id: 'author:c', name: 'C. Reed', sortName: 'reed c', externalIds: {} },
    ];
    const series: Series[] = [
      {
        id: 'series:complete',
        name: 'The Complete Ledger',
        sortName: 'complete ledger',
        totalEntriesKnown: 2,
        source: 'user',
        externalIds: {},
        updatedAt: iso(2026),
      },
      {
        id: 'series:near',
        name: 'The Near Ledger',
        sortName: 'near ledger',
        totalEntriesKnown: 3,
        source: 'user',
        externalIds: {},
        updatedAt: iso(2026),
      },
    ];
    const works: Work[] = [
      baseWork('stats:f1', 'The Verdigris Ledger', {
        authorIds: ['author:a'],
        status: 'finished',
        dateFinished: iso(2026, 1),
        seriesId: 'series:complete',
        genres: [0, 1],
      }),
      baseWork('stats:f2', 'Nine Winters of Ash', {
        authorIds: ['author:a'],
        status: 'finished',
        dateFinished: iso(2026, 3),
        seriesId: 'series:complete',
        genres: [0, 2],
      }),
      baseWork('stats:f3', 'The Glass Province', {
        authorIds: ['author:b'],
        status: 'finished',
        dateFinished: iso(2025),
        seriesId: 'series:near',
        genres: [3],
      }),
      baseWork('stats:f4', 'A Crown of Quiet Machinery', {
        authorIds: ['author:b'],
        status: 'finished',
        dateFinished: iso(2024),
        seriesId: 'series:near',
        genres: [4],
      }),
      baseWork('stats:r1', 'Open at the Margins', {
        authorIds: ['author:c'],
        progressCurrent: 410,
        progressTotal: 1200,
        genres: [1, 5],
      }),
      baseWork('stats:c1', 'Waiting for the Next Chapter', {
        authorIds: ['author:a'],
        status: 'caught_up',
        publicationStatus: 'ongoing',
        progressCurrent: 880,
        progressTotal: 880,
        genres: [6],
      }),
      baseWork('stats:d1', 'Set Aside', {
        authorIds: ['author:c'],
        status: 'dropped',
        dateDropped: iso(2026, 4),
        genres: [7],
      }),
      baseWork('stats:w1', 'For Later', {
        authorIds: ['author:c'],
        status: 'wishlist',
        genres: [8],
      }),
    ];
    const sessions: ReadingSession[] = [
      {
        id: 'session:1',
        workId: 'stats:r1',
        from: 0,
        to: 410,
        delta: 410,
        unit: 'chapter',
        at: iso(2026),
      },
      {
        id: 'session:2',
        workId: 'stats:f1',
        from: 0,
        to: 92,
        delta: 92,
        unit: 'chapter',
        at: iso(2026),
      },
    ];
    await db.transaction('rw', db.work, db.author, db.series, db.readingSession, async () => {
      await Promise.all([
        db.work.clear(),
        db.author.clear(),
        db.series.clear(),
        db.readingSession.clear(),
      ]);
      await db.author.bulkPut(authors);
      await db.series.bulkPut(series);
      await db.work.bulkPut(works);
      await db.readingSession.bulkPut(sessions);
    });
    await saveSettings({ firstTrackedAt: iso(2024) });
  },

  async seedSpines(count) {
    const works = Array.from({ length: count }, (_, index) => {
      const number = index + 1;
      return baseWork(`spine:${number}`, `Volume ${number}: The Long Archive of Quiet Stars`, {
        status: number % 11 === 0 ? 'finished' : 'reading',
        progressCurrent: number * 3,
        progressTotal: 20 + ((number * 97) % 2400),
        coverDominantColor: `hsl(${(number * 37) % 360} 34% 38%)`,
        coverTextColor: 'light',
      });
    });
    await db.transaction('rw', db.work, db.author, db.series, db.readingSession, async () => {
      await Promise.all([
        db.work.clear(),
        db.author.clear(),
        db.series.clear(),
        db.readingSession.clear(),
      ]);
      await db.work.bulkPut(works);
    });
  },

  openStats() {
    nav.reset({ screen: 'stats' });
  },

  openSpine() {
    nav.reset({ screen: 'spine', format: 'novel' });
  },
};
