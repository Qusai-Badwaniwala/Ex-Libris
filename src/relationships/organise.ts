import { db } from '../db/db';
import * as repo from '../db/repo';
import { nowIso, sortTitleOf } from '../db/keys';
import { organisationRevision } from './library';

export interface GroupEdit {
  kind: 'series' | 'universe';
  id: string;
  name: string;
  worldId?: string;
  workIds: string[];
  seriesIds: string[];
  positions: Record<string, number | undefined>;
  startingPoint?: string;
  expectedRevision: string;
  expectedOrganisation: string;
}

export async function assertOrganisation(expected: string) {
  const [works, series, worlds] = await Promise.all([
    db.work.toArray(),
    db.series.toArray(),
    db.universe.toArray(),
  ]);
  if (organisationRevision(works, series, worlds) !== expected)
    throw new Error(
      'Your organisation changed while you were editing. Reopen the organiser to review its latest state.',
    );
}

export async function saveGroup(input: GroupEdit) {
  return db.transaction('rw', db.work, db.series, db.universe, async () => {
    await assertOrganisation(input.expectedOrganisation);
    const group =
      input.kind === 'series' ? await db.series.get(input.id) : await db.universe.get(input.id);
    if (!group || group.updatedAt !== input.expectedRevision)
      throw new Error(
        'This group changed while you were editing. Reopen the organiser to review its latest state.',
      );
    if (input.kind === 'series') {
      await repo.updateSeries(input.id, { name: input.name });
      await repo.linkSeriesToUniverse(input.id, input.worldId);
      const current = await db.work.where('seriesId').equals(input.id).toArray();
      for (const work of current)
        if (!work.deletedAt && !input.workIds.includes(work.id)) await repo.setSeries(work.id, {});
      for (const id of input.workIds) {
        const work = await db.work.get(id);
        if (!work || work.deletedAt) throw new Error('A selected work is no longer available.');
        const position = input.positions[id];
        if (position !== undefined && (!Number.isFinite(position) || position <= 0))
          throw new Error('Entry numbers must be positive, or empty.');
        if (work.seriesId === input.id) {
          // Ordering an existing member is not consent to discard a legacy world conflict.
          await db.work.update(id, { seriesPosition: position, updatedAt: nowIso() });
        } else await repo.setSeries(id, { seriesId: input.id, seriesPosition: position });
      }
    } else {
      await repo.updateUniverse(input.id, {
        name: input.name,
        readingOrderNote: input.startingPoint,
      });
      const currentSeries = await db.series.where('universeId').equals(input.id).toArray();
      for (const series of currentSeries)
        if (!input.seriesIds.includes(series.id))
          await repo.linkSeriesToUniverse(series.id, undefined);
      for (const id of input.seriesIds) await repo.linkSeriesToUniverse(id, input.id);
      const current = await db.work.where('universeId').equals(input.id).toArray();
      for (const work of current)
        if (!work.deletedAt && !work.seriesId && !input.workIds.includes(work.id))
          await repo.setUniverse(work.id, undefined);
      for (const id of input.workIds) {
        const work = await db.work.get(id);
        if (!work || work.deletedAt) throw new Error('A selected work is no longer available.');
        if (work.seriesId)
          throw new Error('Move this work’s series as a whole, or first make the work standalone.');
        await repo.setUniverse(id, input.id);
      }
    }
  });
}

/** All fields and group-wide effects commit together, including newly named groups. */
export async function organiseWork(
  id: string,
  input: {
    seriesName: string;
    worldName: string;
    position?: number;
    expectedOrganisation?: string;
  },
) {
  return db.transaction('rw', db.work, db.series, db.universe, async () => {
    if (input.expectedOrganisation) await assertOrganisation(input.expectedOrganisation);
    if (!(await db.work.get(id))) throw new Error('This work no longer exists.');
    const series = input.seriesName.trim()
      ? await repo.seriesByName(input.seriesName.trim())
      : undefined;
    const world = input.worldName.trim()
      ? await repo.universeByName(input.worldName.trim())
      : undefined;
    if (series) await repo.linkSeriesToUniverse(series.id, world?.id);
    await repo.setSeries(id, {
      seriesId: series?.id,
      seriesPosition: series ? input.position : undefined,
    });
    if (!series) await repo.setUniverse(id, world?.id);
  });
}

/** An explicit one-tap start for a world; a series name is a proposal, not source evidence. */
export async function startWorldForSeries(seriesId: string, expectedOrganisation: string) {
  return db.transaction('rw', db.work, db.series, db.universe, async () => {
    await assertOrganisation(expectedOrganisation);
    const series = await db.series.get(seriesId);
    if (!series) throw new Error('This series no longer exists.');
    if (series.universeId) throw new Error('This series already belongs to a world.');
    const world =
      (await db.universe.toArray()).find(
        (candidate) => sortTitleOf(candidate.name) === sortTitleOf(series.name),
      ) ?? (await repo.universeByName(series.name));
    await repo.linkSeriesToUniverse(seriesId, world.id);
    return world;
  });
}

/** A merge preserves IDs of works and named orders; no reading history is replaced. */
export async function mergeGroups(kind: 'series' | 'universe', sourceId: string, targetId: string) {
  if (sourceId === targetId) throw new Error('Choose a different destination.');
  await db.transaction(
    'rw',
    db.work,
    db.series,
    db.universe,
    db.readingOrder,
    db.readingOrderEntry,
    async () => {
      const table = kind === 'series' ? db.series : db.universe;
      const [source, target] = await Promise.all([table.get(sourceId), table.get(targetId)]);
      if (!source || !target) throw new Error('One of these groups no longer exists.');
      const now = nowIso();
      if (kind === 'series') {
        const original = await db.series.get(sourceId);
        const destination = await db.series.get(targetId);
        await db.work
          .where('seriesId')
          .equals(sourceId)
          .modify((work) => {
            work.seriesId = targetId;
            if (work.universeId === original?.universeId) work.universeId = undefined;
            work.updatedAt = now;
          });
        await db.readingOrderEntry
          .where('seriesId')
          .equals(sourceId)
          .modify({ seriesId: targetId });
        // Different catalogue totals cannot truthfully be added together after a manual merge.
        await db.series.update(targetId, {
          totalEntriesKnown: undefined,
          universeId: destination?.universeId,
          updatedAt: now,
        });
      } else {
        await db.series
          .where('universeId')
          .equals(sourceId)
          .modify({ universeId: targetId, updatedAt: now });
        await db.work
          .where('universeId')
          .equals(sourceId)
          .modify({ universeId: targetId, updatedAt: now });
      }
      await db.readingOrder
        .where('[contextType+contextId]')
        .equals([kind, sourceId])
        .modify({ contextId: targetId, updatedAt: now });
      await table.delete(sourceId);
    },
  );
}
