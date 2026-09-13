import { type BackupFile } from '../db/backup';
import { db, defaultSettings } from '../db/db';
import { SCHEMA_VERSION, type Settings, type Tag, type Work } from '../db/schema';
import { normalizeTag, newId } from '../db/keys';
import { deleteFile, opfsAvailable, writeFile } from '../storage/opfs';
import { maybeCreateAutomaticBackup, type BackupManifest } from './backup';
import { readZip } from './zip';

const decoder = new TextDecoder();

export type RestoreMode = 'merge' | 'replace';

export interface PreparedBackup {
  filename: string;
  data: BackupFile;
  manifest: BackupManifest | null;
  coverBytes: Map<string, Uint8Array>;
}

const arrays = [
  'works',
  'axisRatings',
  'series',
  'universes',
  'authors',
  'notes',
  'noteLinks',
  'readingOrders',
  'readingOrderEntries',
  'tags',
  'readingSessions',
] as const;

function normalizeOlderBackup(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const backup = value as {
    schemaVersion?: number;
    counts?: Record<string, number>;
    data?: Record<string, unknown>;
  };
  if (backup.schemaVersion === 1 && backup.data) {
    backup.data.readingOrders ??= [];
    backup.data.readingOrderEntries ??= [];
    if (backup.counts) backup.counts.readingOrders ??= 0;
  }
  return value;
}

function assertBackup(value: unknown): asserts value is BackupFile {
  if (!value || typeof value !== 'object') throw new Error('The backup does not contain data.');
  const backup = value as Partial<BackupFile>;
  if (typeof backup.schemaVersion !== 'number' || backup.schemaVersion > SCHEMA_VERSION) {
    throw new Error('This backup was written by a newer Ex Libris data format.');
  }
  if (!backup.data || typeof backup.data !== 'object')
    throw new Error('The backup data is missing.');
  for (const key of arrays) {
    if (!Array.isArray(backup.data[key])) throw new Error(`The backup is missing ${key}.`);
  }
  if (!Array.isArray(backup.userCovers)) throw new Error('The backup cover list is missing.');
  if (!backup.counts || typeof backup.counts !== 'object') {
    throw new Error('The backup counts are missing.');
  }
  const expectedCounts = {
    works: backup.data.works.length,
    notes: backup.data.notes.length,
    series: backup.data.series.length,
    universes: backup.data.universes.length,
    readingOrders: backup.data.readingOrders.length,
  };
  for (const [key, count] of Object.entries(expectedCounts)) {
    if (backup.counts[key as keyof typeof expectedCounts] !== count) {
      throw new Error(`The backup ${key} count does not match its data.`);
    }
  }
  const ids = <T extends { id: string }>(rows: T[], label: string) => {
    const values = rows.map((row) => row?.id);
    if (values.some((id) => typeof id !== 'string' || !id))
      throw new Error(`${label} has an invalid id.`);
    if (new Set(values).size !== values.length) throw new Error(`${label} contains duplicate ids.`);
    return new Set(values);
  };
  const workIds = ids(backup.data.works, 'Works');
  const authorIds = ids(backup.data.authors, 'Authors');
  const noteIds = ids(backup.data.notes, 'Notes');
  const seriesIds = ids(backup.data.series, 'Series');
  const universeIds = ids(backup.data.universes, 'Universes');
  const tagIds = ids(backup.data.tags, 'Tags');
  const orderIds = ids(backup.data.readingOrders, 'Reading orders');
  const normalizedTags = backup.data.tags.map((tag) => normalizeTag(tag.name));
  if (new Set(normalizedTags).size !== normalizedTags.length) {
    throw new Error('The backup contains the same tag more than once.');
  }
  for (const work of backup.data.works) {
    if (!work.title?.trim()) throw new Error('A backed-up work has no title.');
    if (!['book', 'novel', 'manhwa'].includes(work.format))
      throw new Error('A work has an invalid format.');
    if (!work.authorIds.every((id) => authorIds.has(id)))
      throw new Error('A work refers to a missing author.');
    if (work.seriesId && !seriesIds.has(work.seriesId))
      throw new Error('A work refers to a missing series.');
    if (work.universeId && !universeIds.has(work.universeId))
      throw new Error('A work refers to a missing universe.');
    if (!work.tagIds.every((id) => tagIds.has(id)))
      throw new Error('A work refers to a missing tag.');
  }
  for (const note of backup.data.notes) {
    if (!note.tagIds.every((id) => tagIds.has(id)))
      throw new Error('A note refers to a missing tag.');
  }
  for (const link of backup.data.noteLinks) {
    if (!noteIds.has(link.noteId) || !workIds.has(link.workId)) {
      throw new Error('A note attachment refers to a missing record.');
    }
  }
  for (const rating of backup.data.axisRatings) {
    if (!workIds.has(rating.workId)) throw new Error('An axis profile refers to a missing work.');
  }
  for (const session of backup.data.readingSessions) {
    if (!workIds.has(session.workId))
      throw new Error('A reading session refers to a missing work.');
  }
  for (const order of backup.data.readingOrders) {
    if (!['series', 'universe'].includes(order.contextType)) {
      throw new Error('A reading order has an invalid context type.');
    }
    const valid =
      order.contextType === 'series'
        ? seriesIds.has(order.contextId)
        : universeIds.has(order.contextId);
    if (!valid) throw new Error('A reading order refers to a missing context.');
  }
  for (const entry of backup.data.readingOrderEntries) {
    if (!orderIds.has(entry.orderId))
      throw new Error('A reading-order entry refers to a missing order.');
    if (entry.workId && !workIds.has(entry.workId))
      throw new Error('A reading-order entry refers to a missing work.');
    if (entry.seriesId && !seriesIds.has(entry.seriesId))
      throw new Error('A reading-order entry refers to a missing series.');
  }
}

export async function readBackupFile(file: File): Promise<PreparedBackup> {
  const buffer = await file.arrayBuffer();
  if (file.name.toLowerCase().endsWith('.json')) {
    const data = normalizeOlderBackup(JSON.parse(decoder.decode(buffer))) as unknown;
    assertBackup(data);
    if (data.userCovers.length) {
      throw new Error('That older JSON backup names user covers but cannot contain their files.');
    }
    return { filename: file.name, data, manifest: null, coverBytes: new Map() };
  }
  const entries = readZip(buffer);
  const rawData = entries.get('data.json');
  const rawManifest = entries.get('manifest.json');
  if (!rawData || !rawManifest) throw new Error('The ZIP is missing data.json or manifest.json.');
  const data = normalizeOlderBackup(JSON.parse(decoder.decode(rawData))) as unknown;
  const manifest = JSON.parse(decoder.decode(rawManifest)) as BackupManifest;
  assertBackup(data);
  if (manifest.format !== 'ex-libris-backup' || manifest.version !== 1) {
    throw new Error('That ZIP is not an Ex Libris backup.');
  }
  if (manifest.schemaVersion !== data.schemaVersion || manifest.createdAt !== data.createdAt) {
    throw new Error('The backup manifest does not match its data.');
  }
  const coverWorkIds = manifest.covers.map((cover) => cover.workId);
  const coverPaths = manifest.covers.map((cover) => cover.archivePath);
  if (
    new Set(coverWorkIds).size !== coverWorkIds.length ||
    new Set(coverPaths).size !== coverPaths.length
  ) {
    throw new Error('The backup cover manifest contains duplicates.');
  }
  const coverBytes = new Map<string, Uint8Array>();
  for (const cover of manifest.covers) {
    const bytes = entries.get(cover.archivePath);
    if (!bytes) throw new Error(`The backup is missing the cover for ${cover.workId}.`);
    if (!data.data.works.some((work) => work.id === cover.workId && work.coverSource === 'user')) {
      throw new Error('A cover does not belong to a user-covered work.');
    }
    coverBytes.set(cover.workId, bytes);
  }
  const expected = data.data.works.filter((work) => work.coverSource === 'user').length;
  if (coverBytes.size !== expected)
    throw new Error('The backup does not include every user cover.');
  return { filename: file.name, data, manifest, coverBytes };
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
    defaultView: {
      ...defaults.defaultView,
      ...(imported?.defaultView ?? {}),
      ...(mode === 'merge' ? (current?.defaultView ?? {}) : {}),
    },
  };
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
  const currentWorks = await db.work.toArray();
  let currentSettings = await db.settings.get('singleton');
  const hasCurrentData = (
    await Promise.all(
      db.tables.filter((table) => table.name !== 'settings').map((table) => table.count()),
    )
  ).some((count) => count > 0);
  if (mode === 'replace' && hasCurrentData) {
    const safety = await maybeCreateAutomaticBackup(
      appVersion,
      currentSettings?.lastAutoBackupAt,
      true,
    );
    if (!safety)
      throw new Error('A safety snapshot could not be created, so nothing was replaced.');
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
      const content = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
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
