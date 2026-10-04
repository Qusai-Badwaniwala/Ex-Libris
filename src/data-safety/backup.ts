import { buildBackup, type BackupFile } from '../db/backup';
import { saveSettings } from '../db/db';
import { deleteFile, listDir, opfsAvailable, readFile, writeFile } from '../storage/opfs';
import type { ZipEntry } from './zip';
import type { BackupManifest } from './archive-format';
import { archiveBuffer, encodeArchive, verifyArchive } from './archive-client';
export type { BackupManifest } from './archive-format';

const AUTO_AFTER_MS = 48 * 60 * 60 * 1000;
const AUTO_LIMIT = 10;
export interface BackupArchive {
  bytes: Uint8Array;
  data: BackupFile;
  manifest: BackupManifest;
  filename: string;
}

export interface BackupHistoryItem {
  path: string;
  createdAt: string;
  kind: 'auto' | 'manual';
  counts: BackupFile['counts'];
}

export interface BackupHistoryResult {
  items: BackupHistoryItem[];
  unreadable: number;
  available: boolean;
}

const safeFilename = (value: string) => value.replace(/[^a-zA-Z0-9._-]+/g, '-');

export function archiveFilename(kind: 'auto' | 'manual', at = new Date()): string {
  const local = new Date(at.getTime() - at.getTimezoneOffset() * 60_000)
    .toISOString()
    .replace(/Z$/, '')
    .replace(/:/g, '-');
  return `ex-libris-${kind}-${local}.zip`;
}

export async function buildBackupArchive(
  appVersion: string,
  kind: 'auto' | 'manual' = 'manual',
): Promise<BackupArchive> {
  const data = await buildBackup(appVersion, kind);
  const entries: ZipEntry[] = [];
  const covers: BackupManifest['covers'] = [];

  for (const [index, cover] of data.userCovers.entries()) {
    const file = await readFile(cover.path);
    if (!file) {
      throw new Error(`The user cover for ${cover.workId} is missing. Nothing was exported.`);
    }
    const archivePath = `covers/${index}-${safeFilename(cover.filename)}`;
    const mediaType = file.type || 'application/octet-stream';
    covers.push({ workId: cover.workId, archivePath, filename: cover.filename, mediaType });
    entries.push({ name: archivePath, data: new Uint8Array(await file.arrayBuffer()) });
  }

  data.userCovers = data.userCovers.map((cover) => {
    const archived = covers.find((item) => item.workId === cover.workId)!;
    return { ...cover, archivePath: archived.archivePath, mediaType: archived.mediaType };
  });
  const manifest: BackupManifest = {
    format: 'ex-libris-backup',
    version: 1,
    schemaVersion: data.schemaVersion,
    dbVersion: data.dbVersion,
    appVersion,
    createdAt: data.createdAt,
    kind,
    counts: data.counts,
    covers,
  };
  const bytes = await encodeArchive(data, manifest, entries);
  return { bytes, data, manifest, filename: archiveFilename(kind) };
}

let autoRun: Promise<boolean> | null = null;
let automaticStatus: { active: boolean; error?: string } = { active: false };
const automaticListeners = new Set<() => void>();
const publishAutomatic = (next: typeof automaticStatus) => {
  automaticStatus = next;
  for (const listener of automaticListeners) listener();
};
export const automaticBackupStore = {
  getSnapshot: () => automaticStatus,
  subscribe(listener: () => void) {
    automaticListeners.add(listener);
    return () => automaticListeners.delete(listener);
  },
};

/** Fresh, read-back-verified archive before a destructive group operation.
 * This deliberately cannot reuse an unrelated in-flight automatic snapshot. */
export async function createSafetyBackup(appVersion: string): Promise<void> {
  if (!(await opfsAvailable())) throw new Error('Storage is unavailable; nothing was changed.');
  const archive = await buildBackupArchive(appVersion, 'auto');
  const path = `backups/${archive.filename.replace('.zip', `-${crypto.randomUUID()}.zip`)}`;
  await writeFile(path, archiveBuffer(archive.bytes));
  const stored = await readFile(path);
  if (!stored) throw new Error('The safety backup could not be read back. Nothing was changed.');
  await verifyArchive(archive.filename, await stored.arrayBuffer(), archiveBuffer(archive.bytes));
  await saveSettings({ lastAutoBackupAt: archive.manifest.createdAt });
}

/** Creates at most one snapshot per launch and keeps the newest ten. */
export function maybeCreateAutomaticBackup(
  appVersion: string,
  lastAutoBackupAt?: string,
  force = false,
): Promise<boolean> {
  if (autoRun) return autoRun;
  publishAutomatic({ active: true });
  autoRun = (async () => {
    const previous = lastAutoBackupAt ? new Date(lastAutoBackupAt).getTime() : 0;
    if (!force && Date.now() - previous < AUTO_AFTER_MS) return false;
    if (!(await opfsAvailable())) return false;
    const archive = await buildBackupArchive(appVersion, 'auto');
    const path = `backups/${archive.filename}`;
    await writeFile(path, archiveBuffer(archive.bytes));
    const names = (await listDir('backups'))
      .filter((name) => /^ex-libris-auto-.*\.zip$/.test(name))
      .sort();
    for (const name of names.slice(0, Math.max(0, names.length - AUTO_LIMIT))) {
      await deleteFile(`backups/${name}`);
    }
    await saveSettings({ lastAutoBackupAt: archive.manifest.createdAt });
    return true;
  })()
    .catch((cause: unknown) => {
      publishAutomatic({
        active: true,
        error: cause instanceof Error ? cause.message : 'The automatic backup could not be saved.',
      });
      throw cause;
    })
    .finally(() => {
      autoRun = null;
      publishAutomatic({ ...automaticStatus, active: false });
    });
  return autoRun;
}

export async function inspectAutomaticBackups(): Promise<BackupHistoryResult> {
  if (!(await opfsAvailable())) return { items: [], unreadable: 0, available: false };
  const names = (await listDir('backups'))
    .filter((name) => /^ex-libris-auto-.*\.zip$/.test(name))
    .sort()
    .reverse();
  const history: BackupHistoryItem[] = [];
  let unreadable = 0;
  for (const name of names) {
    const file = await readFile(`backups/${name}`);
    if (!file) continue;
    try {
      const { manifest } = await verifyArchive(name, await file.arrayBuffer());
      history.push({
        path: `backups/${name}`,
        createdAt: manifest.createdAt,
        kind: manifest.kind,
        counts: manifest.counts,
      });
    } catch {
      // Never present a broken file as healthy; the caller also gets the count
      // so the failure cannot masquerade as an empty history.
      unreadable++;
    }
  }
  return { items: history, unreadable, available: true };
}

export async function listAutomaticBackups(): Promise<BackupHistoryItem[]> {
  return (await inspectAutomaticBackups()).items;
}

type SavePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<FileSystemFileHandle>;
};

function downloadArchive(archive: BackupArchive): void {
  const blob = new Blob([archiveBuffer(archive.bytes)], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = archive.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}

/** Export the retained snapshot itself, not a newly assembled current library. */
export async function exportStoredBackup(path: string): Promise<void> {
  if (!/^backups\/ex-libris-auto-[a-zA-Z0-9._-]+\.zip$/.test(path))
    throw new Error('Invalid snapshot path.');
  const picker = (window as SavePickerWindow).showSaveFilePicker;
  const filename = path.split('/').at(-1)!;
  let handle: FileSystemFileHandle | null = null;
  if (picker) {
    try {
      handle = await picker({
        suggestedName: filename,
        types: [{ description: 'Ex Libris backup', accept: { 'application/zip': ['.zip'] } }],
      });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      throw cause;
    }
  }
  const file = await readFile(path);
  if (!file) throw new Error('This snapshot is no longer on this device.');
  const { buffer } = await verifyArchive(filename, await file.arrayBuffer());
  if (handle) {
    const writable = await handle.createWritable();
    try {
      await writable.write(buffer);
      await writable.close();
    } catch (cause) {
      await writable.abort().catch(() => {});
      throw cause;
    }
  } else {
    const url = URL.createObjectURL(new Blob([buffer], { type: 'application/zip' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    requestAnimationFrame(() => URL.revokeObjectURL(url));
  }
}

/** The picker is requested before archive assembly so Chrome keeps user activation. */
export async function exportManualBackup(appVersion: string): Promise<BackupArchive | null> {
  const picker = (window as SavePickerWindow).showSaveFilePicker;
  let handle: FileSystemFileHandle | null = null;
  if (picker) {
    try {
      handle = await picker({
        suggestedName: archiveFilename('manual'),
        types: [{ description: 'Ex Libris backup', accept: { 'application/zip': ['.zip'] } }],
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return null;
      throw error;
    }
  }
  const archive = await buildBackupArchive(appVersion, 'manual');
  if (handle) {
    const writable = await handle.createWritable();
    try {
      await writable.write(archiveBuffer(archive.bytes));
      await writable.close();
    } catch (cause) {
      await writable.abort().catch(() => {});
      throw cause;
    }
  } else {
    downloadArchive(archive);
  }
  await saveSettings({ lastManualExportAt: archive.manifest.createdAt });
  return archive;
}
