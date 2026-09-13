import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import {
  db as appDb,
  ExLibrisDB,
  loadSettings,
  MIGRATIONS,
  defaultSettings,
} from '../../src/db/db';
import { newId, nowIso, normalizeTag } from '../../src/db/keys';
import type { Tag, Work } from '../../src/db/schema';

let db: ExLibrisDB;
let name: string;

beforeEach(async () => {
  name = `exl-test-${crypto.randomUUID()}`;
  db = new ExLibrisDB(name);
  await db.open();
});

afterEach(async () => {
  db.close();
  await Dexie.delete(name);
});

function makeWork(patch: Partial<Work> = {}): Work {
  return {
    id: newId(),
    title: 'The Verdigris Ledger',
    sortTitle: 'verdigris ledger',
    format: 'novel',
    authorIds: [],
    status: 'reading',
    publicationStatus: 'ongoing',
    progressUnit: 'chapter',
    progressCurrent: 412,
    coverSource: 'none',
    tagIds: [],
    genres: [1, 4],
    isTranslated: false,
    dateAdded: nowIso(),
    externalIds: {},
    isManualEntry: false,
    updatedAt: nowIso(),
    ...patch,
  };
}

function makeTag(nameIn: string): Tag {
  return {
    id: newId(),
    name: nameIn,
    normalizedName: normalizeTag(nameIn),
    source: 'user',
    groups: ['Subgenre'],
    usageCount: 0,
  };
}

describe('the store', () => {
  it('opens at the version the migration list declares', () => {
    expect(db.verno).toBe(MIGRATIONS[MIGRATIONS.length - 1]!.version);
  });

  it('round-trips a work with every field the contract defines', async () => {
    const w = makeWork({ progressTotal: 1140, seriesPosition: 1.5 });
    await db.work.add(w);
    expect(await db.work.get(w.id)).toEqual(w);
  });

  it('finds works on the compound [format+status] index the format screen uses', async () => {
    await db.work.bulkAdd([
      makeWork({ format: 'novel', status: 'reading' }),
      makeWork({ format: 'novel', status: 'finished' }),
      makeWork({ format: 'manhwa', status: 'reading' }),
    ]);
    const hits = await db.work.where('[format+status]').equals(['novel', 'reading']).toArray();
    expect(hits).toHaveLength(1);
    expect(hits[0]!.format).toBe('novel');
  });

  it('finds works by a single genre without scanning, via the multi-entry index', async () => {
    await db.work.bulkAdd([
      makeWork({ genres: [1, 4] }),
      makeWork({ genres: [8] }),
      makeWork({ genres: [] }),
    ]);
    expect(await db.work.where('genres').equals(4).count()).toBe(1);
    expect(await db.work.where('genres').equals(8).count()).toBe(1);
    // The control: a genre nothing carries must return nothing, not everything.
    expect(await db.work.where('genres').equals(11).count()).toBe(0);
  });

  it('refuses a second tag with the same normalised name', async () => {
    // SCHEMA §7 says tags merge on normalizedName collision. The unique index
    // makes writing the duplicate impossible rather than leaving every call
    // site to remember the rule.
    await db.tag.add(makeTag('LitRPG'));
    await expect(db.tag.add(makeTag('litrpg'))).rejects.toThrow();
    expect(await db.tag.count()).toBe(1);
  });

  it('allows two tags that genuinely differ', async () => {
    await db.tag.add(makeTag('Dark Fantasy'));
    await db.tag.add(makeTag('Grimdark'));
    expect(await db.tag.count()).toBe(2);
  });

  it('treats a note and a work as one link however often it is attached', async () => {
    const link = { noteId: 'n1', workId: 'w1', createdAt: nowIso() };
    await db.noteLink.put(link);
    await db.noteLink.put({ ...link, createdAt: nowIso() });
    expect(await db.noteLink.count()).toBe(1);
  });
});

describe('the migration harness', () => {
  it('carries data across an added version and fills the new field for existing rows', async () => {
    // There is only one shipped version, so this exercises the harness with a
    // throwaway version 2 rather than asserting nothing. The rule it proves is
    // the one that matters on a device with no server: an existing row must
    // come out of an upgrade with the behaviour that user already had, decided
    // in one upgrade function rather than at every read site.
    const w = makeWork();
    await db.work.add(w);
    db.close();

    const upgraded = new Dexie(name);
    for (const m of MIGRATIONS) upgraded.version(m.version).stores(m.stores);
    upgraded
      .version(MIGRATIONS[MIGRATIONS.length - 1]!.version + 1)
      .stores({ work: `${MIGRATIONS[0]!.stores['work']}, shelfNote` })
      .upgrade(async (tx) => {
        await tx
          .table('work')
          .toCollection()
          .modify((row: Work & { shelfNote?: string }) => {
            row.shelfNote = 'migrated';
          });
      });
    await upgraded.open();

    expect(upgraded.verno).toBe(MIGRATIONS[MIGRATIONS.length - 1]!.version + 1);
    const after = await upgraded.table('work').get(w.id);
    expect(after.title).toBe('The Verdigris Ledger');
    expect(after.shelfNote).toBe('migrated');
    upgraded.close();
  });
});

describe('default settings', () => {
  it('serializes simultaneous first loads into one singleton row', async () => {
    appDb.close();
    await Dexie.delete('ex-libris');
    // close() disables Dexie's automatic reopen. A real fresh app starts with
    // an unopened database, so explicitly reopen that same state here.
    await appDb.open();
    const [first, second] = await Promise.all([loadSettings('0.1.0'), loadSettings('0.1.0')]);

    expect(first.id).toBe('singleton');
    expect(second.id).toBe('singleton');
    expect(await appDb.settings.count()).toBe(1);

    appDb.close();
    await Dexie.delete('ex-libris');
  });

  it('ships with the model off and content warnings off', () => {
    const s = defaultSettings('0.0.0');
    expect(s.aiEnabled).toBe(false);
    expect(s.contentWarningsOn).toBe(false);
    expect(s.aiDailyCap).toBe(50);
  });

  it('does not stamp firstTrackedAt — only the first real load does', () => {
    expect(defaultSettings('0.0.0').firstTrackedAt).toBeUndefined();
  });
});
