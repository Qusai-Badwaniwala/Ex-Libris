import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Dexie from 'dexie';
import { db, defaultSettings, ExLibrisDB, MIGRATIONS } from '../../src/db/db';
import * as repo from '../../src/db/repo';
import type { Work } from '../../src/db/schema';
import { codexSections, membership, readRelationships } from '../../src/relationships/library';
import { mergeGroups, organiseWork, saveGroup } from '../../src/relationships/organise';

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map((table) => table.clear()));
});
afterEach(() => {
  vi.restoreAllMocks();
  db.close();
});
const work = (id: string, patch: Partial<Work> = {}): Work => ({
  id,
  title: id,
  sortTitle: id,
  format: 'book',
  authorIds: [],
  status: 'reading',
  publicationStatus: 'complete',
  progressUnit: 'page',
  progressCurrent: 12,
  coverSource: 'none',
  tagIds: [],
  genres: [],
  isTranslated: false,
  dateAdded: '2026-09-20T00:00:00Z',
  externalIds: {},
  isManualEntry: true,
  updatedAt: '2026-09-20T00:00:00Z',
  ...patch,
});

describe('adopted library organisation', () => {
  it('removes deleted series references from other named orders without creating false missing books', async () => {
    const source = await repo.seriesByName('Removed series');
    const world = await repo.universeByName('World');
    const remaining = await repo.seriesByName('Remaining series');
    const { order } = await repo.createReadingOrder(
      { contextType: 'universe', contextId: world.id, name: 'Recommended' },
      [
        { kind: 'series', label: source.name, seriesId: source.id },
        { kind: 'series', label: remaining.name, seriesId: remaining.id },
      ],
    );
    await repo.deleteSeries(source.id);
    const entries = await db.readingOrderEntry.where('orderId').equals(order.id).toArray();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ seriesId: remaining.id, position: 1 });
  });
  it('upgrades a deployed v2 database without changing books, conflicts or completed onboarding', async () => {
    const name = 'adoption-upgrade-rehearsal';
    await Dexie.delete(name);
    const old = new Dexie(name);
    for (const migration of MIGRATIONS.filter((m) => m.version <= 2))
      old.version(migration.version).stores(migration.stores);
    await old.open();
    const settings = {
      ...defaultSettings('old'),
      welcomeSeenAt: '2026-09-01T00:00:00Z',
      tourCompletedAt: '2026-09-01T00:00:00Z',
      defaultView: { book: 'spine', novel: 'spine', manhwa: 'list' },
      spineWidthProfile: { old: true },
    };
    const historical = work('historical', { seriesId: 'series', universeId: 'conflicting-world' });
    await old.table('settings').put(settings);
    await old.table('work').put(historical);
    old.close();
    const upgraded = new ExLibrisDB(name);
    try {
      await upgraded.open();
      expect(await upgraded.work.get('historical')).toEqual(historical);
      const next = await upgraded.settings.get('singleton');
      expect(next).toMatchObject({
        welcomeSeenAt: settings.welcomeSeenAt,
        tourCompletedAt: settings.tourCompletedAt,
        defaultView: { book: 'list', novel: 'list', manhwa: 'list' },
      });
      expect(next?.spineWidthProfile).toBeUndefined();
    } finally {
      upgraded.close();
      await Dexie.delete(name);
    }
  });

  it('rejects a concurrent membership edit even when the group itself has not changed', async () => {
    const series = await repo.seriesByName('Series');
    await db.work.add(work('one', { seriesId: series.id }));
    const expectedOrganisation = (await readRelationships()).revision;
    await repo.setSeries('one', {});
    await expect(
      saveGroup({
        kind: 'series',
        id: series.id,
        name: series.name,
        workIds: ['one'],
        seriesIds: [],
        positions: {},
        expectedRevision: series.updatedAt,
        expectedOrganisation,
      }),
    ).rejects.toThrow('changed');
    expect((await db.work.get('one'))?.seriesId).toBeUndefined();
  });

  it('preserves Trash membership and unresolved legacy worlds during ordinary group editing', async () => {
    const series = await repo.seriesByName('Series');
    const legacy = await repo.universeByName('Legacy');
    await db.work.bulkAdd([
      work('one', { seriesId: series.id, universeId: legacy.id }),
      work('trashed', { seriesId: series.id, deletedAt: '2026-09-20T00:00:00Z' }),
    ]);
    await saveGroup({
      kind: 'series',
      id: series.id,
      name: series.name,
      workIds: ['one'],
      seriesIds: [],
      positions: { one: 2 },
      expectedRevision: series.updatedAt,
      expectedOrganisation: (await readRelationships()).revision,
    });
    expect((await db.work.get('trashed'))?.seriesId).toBe(series.id);
    expect((await db.work.get('one'))?.universeId).toBe(legacy.id);
    expect((await db.work.get('one'))?.seriesPosition).toBe(2);
  });

  it('rolls back the session when the progress write fails', async () => {
    await db.work.add(work('session'));
    vi.spyOn(db.work, 'update').mockRejectedValueOnce(new Error('Storage failure'));
    await expect(repo.logSession('session', 20)).rejects.toThrow('Storage failure');
    expect(await db.readingSession.count()).toBe(0);
    expect((await db.work.get('session'))?.progressCurrent).toBe(12);
  });

  it('serializes concurrent session submissions without double-counting progress', async () => {
    await db.work.add(work('session'));
    await Promise.all([repo.logSession('session', 20), repo.logSession('session', 20)]);
    expect(await db.readingSession.count()).toBe(1);
    expect((await db.readingSession.toArray())[0]?.delta).toBe(8);
  });

  it('rejects non-finite reading positions without persisting a session', async () => {
    await db.work.add(work('session'));
    await expect(repo.logSession('session', NaN)).rejects.toThrow('finite');
    await expect(repo.logSession('session', Infinity)).rejects.toThrow('finite');
    expect(await db.readingSession.count()).toBe(0);
  });
  it('inherits a series world and retains it on leaving or deleting the series', async () => {
    const series = await repo.seriesByName('Earthsea');
    const world = await repo.universeByName('Earthsea world');
    await repo.linkSeriesToUniverse(series.id, world.id);
    await db.work.bulkAdd([work('one'), work('two')]);
    await repo.setSeries('one', { seriesId: series.id, seriesPosition: 1 });
    await repo.setSeries('two', { seriesId: series.id, seriesPosition: 2 });
    const graph = await readRelationships();
    expect(graph.worldWorks(world.id)).toHaveLength(2);
    expect((await db.work.get('one'))?.universeId).toBeUndefined();
    await repo.setSeries('one', {});
    expect((await db.work.get('one'))?.universeId).toBe(world.id);
    await repo.deleteSeries(series.id);
    expect((await db.work.get('two'))?.universeId).toBe(world.id);
    expect((await db.work.get('two'))?.progressCurrent).toBe(12);
  });

  it('rolls back new group creation and world changes when an entry is invalid', async () => {
    await db.work.add(work('one'));
    await expect(
      organiseWork('one', { seriesName: 'New series', worldName: 'New world', position: -1 }),
    ).rejects.toThrow('positive');
    expect(await db.series.count()).toBe(0);
    expect(await db.universe.count()).toBe(0);
    expect((await db.work.get('one'))?.seriesId).toBeUndefined();
  });

  it('preserves contradictory legacy worlds until that work is explicitly organised', async () => {
    const series = await repo.seriesByName('A series');
    const before = await repo.universeByName('Before');
    const after = await repo.universeByName('After');
    const conflicting = await repo.universeByName('Legacy');
    await repo.linkSeriesToUniverse(series.id, before.id);
    await db.work.add(work('one', { seriesId: series.id, universeId: conflicting.id }));
    await repo.linkSeriesToUniverse(series.id, after.id);
    const stored = (await db.work.get('one'))!;
    expect(stored.universeId).toBe(conflicting.id);
    expect(membership(stored, await db.series.get(series.id))).toEqual({
      universeId: after.id,
      conflict: true,
    });
    await organiseWork('one', { seriesName: series.name, worldName: after.name });
    expect((await db.work.get('one'))?.universeId).toBeUndefined();
  });

  it('merges series without losing works, progress or named orders', async () => {
    const source = await repo.seriesByName('Duplicate');
    const target = await repo.seriesByName('Keep');
    await db.work.add(work('one', { seriesId: source.id, seriesPosition: 1 }));
    await db.readingOrder.add({
      id: 'order',
      contextType: 'series',
      contextId: source.id,
      name: 'Publication',
      source: 'user',
      updatedAt: source.updatedAt,
    });
    await mergeGroups('series', source.id, target.id);
    expect((await db.work.get('one'))?.seriesId).toBe(target.id);
    expect((await db.work.get('one'))?.progressCurrent).toBe(12);
    expect((await db.readingOrder.get('order'))?.contextId).toBe(target.id);
    expect(await db.series.get(source.id)).toBeUndefined();
  });

  it('rejects a stale group edit instead of overwriting another tab', async () => {
    const series = await repo.seriesByName('Original');
    await db.series.update(series.id, {
      updatedAt: '2026-09-21T00:00:00Z',
      name: 'Changed elsewhere',
    });
    await expect(
      saveGroup({
        kind: 'series',
        id: series.id,
        name: 'Overwrite',
        workIds: [],
        seriesIds: [],
        positions: {},
        expectedRevision: series.updatedAt,
        expectedOrganisation: (await readRelationships()).revision,
      }),
    ).rejects.toThrow('changed');
    expect((await db.series.get(series.id))?.name).toBe('Changed elsewhere');
  });

  it('places 500 works once, excludes Wishlist/Trash and preserves filtered group counts', async () => {
    const series = await repo.seriesByName('Red Rising');
    const works = Array.from({ length: 500 }, (_, index) =>
      work(`work-${index}`, {
        seriesId: index < 6 ? series.id : undefined,
        seriesPosition: index < 6 ? 6 - index : undefined,
      }),
    );
    works.push(
      work('wish', { status: 'wishlist' }),
      work('trash', { deletedAt: '2026-09-20T00:00:00Z' }),
    );
    const sections = codexSections(works, works, [series], []);
    const ids = sections.flatMap((section) => section.works.map((work) => work.id));
    expect(ids).toHaveLength(500);
    expect(new Set(ids).size).toBe(500);
    const filtered = codexSections([works[0]!], works, [series], []);
    expect(filtered[0]?.total).toBe(6);
    expect(sections.find((section) => section.series)?.works[0]?.seriesPosition).toBe(1);
  });
});
