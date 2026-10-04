import { db, defaultSettings } from '../db/db';
import { type Settings, type Tag, type Work } from '../db/schema';
import { normalizeTag, newId } from '../db/keys';
import { deleteFile, opfsAvailable, writeFile } from '../storage/opfs';
import { createSafetyBackup } from './backup';
import type { PreparedBackup } from './archive-format';
import { archiveBuffer, decodeArchive, validateArchiveData } from './archive-client';
export type { PreparedBackup } from './archive-format';

export type RestoreMode = 'merge' | 'replace';

export async function readBackupFile(file: File): Promise<PreparedBackup> {
  return decodeArchive(file.name, await file.arrayBuffer());
}

function restoredSettings(
  imported: Settings | null,
  current: Settings | undefined,
  appVersion: string,
  mode: RestoreMode,
): Settings {
  const defaults = defaultSettings(appVersion);
  const settings: Settings = {
    ...defaults,
    ...(imported ?? {}),
    ...(mode === 'merge' ? (current ?? {}) : {}),
    id: 'singleton',
    appVersion,
    defaultView: { book: 'list', novel: 'list', manhwa: 'list' },
  };
  delete settings.spineWidthProfile;
  // These describe bytes or secrets on this device, not portable library
  // data. Importing their flags without their OPFS files or credential would
  // make the restored Settings screen claim resources that are not present.
  const localOnly = [
    'corpusVersion',
    'corpusInstalledAt',
    'lastAutoBackupAt',
    'lastManualExportAt',
    'aiApiKey',
  ] as const;
  for (const key of localOnly) {
    if (current?.[key] !== undefined) settings[key] = current[key] as never;
    else delete settings[key];
  }
  return settings;
}

function remapTagIds(works: Work[], tags: Tag[], current: Tag[]) {
  const canonical = new Map(current.map((tag) => [tag.normalizedName, tag]));
  const idMap = new Map<string, string>();
  const merged = [...current];
  for (const tag of tags) {
    const normalizedName = normalizeTag(tag.name);
    const existing = canonical.get(normalizedName);
    if (existing) idMap.set(tag.id, existing.id);
    else {
      const clean = { ...tag, normalizedName };
      canonical.set(normalizedName, clean);
      idMap.set(tag.id, tag.id);
      merged.push(clean);
    }
  }
  const mapIds = (ids: string[]) => [...new Set(ids.map((id) => idMap.get(id) ?? id))];
  return {
    works: works.map((work) => ({ ...work, tagIds: mapIds(work.tagIds) })),
    tags: merged,
    mapIds,
  };
}

export async function restoreBackup(
  prepared: PreparedBackup,
  mode: RestoreMode,
  appVersion: string,
): Promise<void> {
  await validateArchiveData(prepared.data);
  const currentWorks = await db.work.toArray();
  let currentSettings = await db.settings.get('singleton');
  const hasCurrentData = (
    await Promise.all(
      db.tables.filter((table) => table.name !== 'settings').map((table) => table.count()),
    )
  ).some((count) => count > 0);
  if (hasCurrentData && (mode === 'replace' || (await restoreCollisions(prepared)).total > 0)) {
    await createSafetyBackup(appVersion);
    currentSettings = await db.settings.get('singleton');
  }
  if (prepared.coverBytes.size && !(await opfsAvailable())) {
    throw new Error(
      'This browser cannot restore the user covers in that backup. Nothing was changed.',
    );
  }

  const writtenPaths: string[] = [];
  const coverPathByWork = new Map<string, string>();
  try {
    for (const [workId, bytes] of prepared.coverBytes) {
      const meta = prepared.manifest?.covers.find((cover) => cover.workId === workId);
      const extension =
        meta?.filename
          .split('.')
          .at(-1)
          ?.replace(/[^a-zA-Z0-9]/g, '') || 'webp';
      const path = `covers/user/${encodeURIComponent(workId)}/restore-${newId()}.${extension}`;
      const content = archiveBuffer(bytes);
      await writeFile(path, content);
      writtenPaths.push(path);
      coverPathByWork.set(workId, path);
    }

    const importedWorks = prepared.data.data.works.map((work) => {
      const coverPath = coverPathByWork.get(work.id);
      if (work.coverSource === 'user' && coverPath) return { ...work, coverPath };
      if (work.coverSource === 'user')
        throw new Error(`The user cover for ${work.title} is absent.`);
      return work;
    });
    const currentTags = mode === 'merge' ? await db.tag.toArray() : [];
    const remapped = remapTagIds(importedWorks, prepared.data.data.tags, currentTags);
    const importedNotes = prepared.data.data.notes.map((note) => ({
      ...note,
      tagIds: remapped.mapIds(note.tagIds),
    }));
    const settings = restoredSettings(
      prepared.data.data.settings,
      currentSettings,
      appVersion,
      mode,
    );

    await db.transaction('rw', db.tables, async () => {
      if (mode === 'replace') await Promise.all(db.tables.map((table) => table.clear()));
      const write = mode === 'replace' ? 'bulkAdd' : 'bulkPut';
      await db.author[write](prepared.data.data.authors);
      await db.universe[write](prepared.data.data.universes);
      await db.series[write](prepared.data.data.series);
      await db.tag.bulkPut(remapped.tags);
      await db.work[write](remapped.works);
      await db.axisRating[write](prepared.data.data.axisRatings);
      await db.note[write](importedNotes);
      await db.noteLink[write](prepared.data.data.noteLinks);
      await db.readingSession[write](prepared.data.data.readingSessions);
      await db.readingOrder[write](prepared.data.data.readingOrders);
      await db.readingOrderEntry[write](prepared.data.data.readingOrderEntries);
      await db.settings.put(settings);
    });
  } catch (error) {
    await Promise.all(writtenPaths.map((path) => deleteFile(path)));
    throw error;
  }

  const newPaths = new Set(coverPathByWork.values());
  for (const work of currentWorks) {
    if (
      work.coverSource === 'user' &&
      work.coverPath &&
      !newPaths.has(work.coverPath) &&
      (mode === 'replace' || coverPathByWork.has(work.id))
    ) {
      await deleteFile(work.coverPath);
    }
  }
}

/** Incoming records retain precedence. Preview makes every overwrite visible. */
export async function restoreCollisions(
  prepared: PreparedBackup,
): Promise<{ total: number; works: string[]; notes: number }> {
  const data = prepared.data.data;
  const mappings = [
    [db.work, data.works.map((row) => row.id)],
    [db.author, data.authors.map((row) => row.id)],
    [db.series, data.series.map((row) => row.id)],
    [db.universe, data.universes.map((row) => row.id)],
    [db.note, data.notes.map((row) => row.id)],
    [db.tag, data.tags.map((row) => row.id)],
    [db.axisRating, data.axisRatings.map((row) => row.workId)],
    [db.noteLink, data.noteLinks.map((row) => [row.noteId, row.workId])],
    [db.readingOrder, data.readingOrders.map((row) => row.id)],
    [db.readingOrderEntry, data.readingOrderEntries.map((row) => row.id)],
    [db.readingSession, data.readingSessions.map((row) => row.id)],
  ] as const;
  const matches = await Promise.all(
    mappings.map(
      async ([table, keys]) =>
        (
          await (table.bulkGet as (keys: Array<string | string[]>) => Promise<unknown[]>)([...keys])
        ).filter(Boolean).length,
    ),
  );
  const existing = new Set(
    (await db.work.bulkGet(data.works.map((work) => work.id)))
      .filter(Boolean)
      .map((work) => work!.id),
  );
  return {
    total: matches.reduce((sum, count) => sum + count, 0),
    works: data.works.filter((work) => existing.has(work.id)).map((work) => work.title),
    notes: matches[4] ?? 0,
  };
}
