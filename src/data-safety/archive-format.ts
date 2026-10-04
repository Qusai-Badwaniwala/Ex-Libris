import type { BackupFile } from '../db/backup';
import { SCHEMA_VERSION } from '../db/schema';
import { normalizeTag } from '../db/keys';
import { readZip } from './zip';
import { validateRecordShapes } from './validate';

const decoder = new TextDecoder();

export interface BackupManifest {
  format: 'ex-libris-backup';
  version: 1;
  schemaVersion: number;
  dbVersion: number;
  appVersion: string;
  createdAt: string;
  kind: 'auto' | 'manual';
  counts: BackupFile['counts'];
  covers: { workId: string; archivePath: string; filename: string; mediaType: string }[];
}

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

export function assertBackupData(value: unknown): asserts value is BackupFile {
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
  validateRecordShapes(backup as BackupFile);
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
  const coveredIds = backup.userCovers.map((cover) => cover.workId);
  if (
    new Set(coveredIds).size !== coveredIds.length ||
    backup.data.works.filter((work) => work.coverSource === 'user').length !== coveredIds.length ||
    backup.userCovers.some(
      (cover) =>
        !backup.data!.works.some(
          (work) => work.id === cover.workId && work.coverSource === 'user' && !!work.coverPath,
        ),
    )
  )
    throw new Error('The backup user-cover list does not match its works.');
  const authorIds = ids(backup.data.authors, 'Authors');
  const noteIds = ids(backup.data.notes, 'Notes');
  const seriesIds = ids(backup.data.series, 'Series');
  const universeIds = ids(backup.data.universes, 'Universes');
  const tagIds = ids(backup.data.tags, 'Tags');
  const orderIds = ids(backup.data.readingOrders, 'Reading orders');
  ids(backup.data.readingOrderEntries, 'Reading-order entries');
  ids(backup.data.readingSessions, 'Reading sessions');
  const unique = (values: string[], label: string) => {
    if (new Set(values).size !== values.length)
      throw new Error(`${label} contains duplicate keys.`);
  };
  unique(
    backup.data.axisRatings.map((row) => row.workId),
    'Axis profiles',
  );
  unique(
    backup.data.noteLinks.map((row) => JSON.stringify([row.noteId, row.workId])),
    'Note attachments',
  );
  unique(
    backup.data.readingOrderEntries.map((row) => JSON.stringify([row.orderId, row.position])),
    'Reading-order positions',
  );
  for (const series of backup.data.series)
    if (series.universeId && !universeIds.has(series.universeId))
      throw new Error('A series refers to a missing world.');
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

export function parseBackupBuffer(filename: string, buffer: ArrayBuffer): PreparedBackup {
  if (filename.toLowerCase().endsWith('.json')) {
    const data = normalizeOlderBackup(JSON.parse(decoder.decode(buffer))) as unknown;
    assertBackupData(data);
    if (data.userCovers.length) {
      throw new Error('That older JSON backup names user covers but cannot contain their files.');
    }
    return { filename: filename, data, manifest: null, coverBytes: new Map() };
  }
  const entries = readZip(buffer);
  const rawData = entries.get('data.json');
  const rawManifest = entries.get('manifest.json');
  if (!rawData || !rawManifest) throw new Error('The ZIP is missing data.json or manifest.json.');
  const data = normalizeOlderBackup(JSON.parse(decoder.decode(rawData))) as unknown;
  const manifest = JSON.parse(decoder.decode(rawManifest)) as BackupManifest;
  assertBackupData(data);
  if (
    !manifest ||
    typeof manifest !== 'object' ||
    manifest.format !== 'ex-libris-backup' ||
    manifest.version !== 1
  ) {
    throw new Error('That ZIP is not an Ex Libris backup.');
  }
  if (
    !Array.isArray(manifest.covers) ||
    manifest.covers.some(
      (cover) =>
        !cover ||
        typeof cover.workId !== 'string' ||
        typeof cover.archivePath !== 'string' ||
        !/^covers\/[^/]+$/.test(cover.archivePath) ||
        typeof cover.filename !== 'string' ||
        typeof cover.mediaType !== 'string',
    )
  )
    throw new Error('The backup cover manifest is invalid.');
  if (
    manifest.schemaVersion !== data.schemaVersion ||
    manifest.createdAt !== data.createdAt ||
    manifest.dbVersion !== data.dbVersion ||
    manifest.kind !== data.kind ||
    manifest.appVersion !== data.appVersion ||
    !manifest.counts ||
    Object.entries(data.counts).some(
      ([key, count]) => manifest.counts[key as keyof typeof data.counts] !== count,
    )
  ) {
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
  return { filename: filename, data, manifest, coverBytes };
}
