import { buildBackup, type BackupFile } from '../db/backup';
import { saveSettings } from '../db/db';
import { deleteFile, listDir, opfsAvailable, readFile, writeFile } from '../storage/opfs';
import { createZip, readZip, type ZipEntry } from './zip';

const AUTO_AFTER_MS = 48 * 60 * 60 * 1000;
const AUTO_LIMIT = 10;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

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

function bytesAsBlobPart(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
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
  entries.unshift(
    { name: 'manifest.json', data: textEncoder.encode(JSON.stringify(manifest, null, 2)) },
    { name: 'data.json', data: textEncoder.encode(JSON.stringify(data, null, 2)) },
  );
  return { bytes: createZip(entries), data, manifest, filename: archiveFilename(kind) };
}

let autoRun: Promise<boolean> | null = null;

/** Creates at most one snapshot per launch and keeps the newest ten. */
export function maybeCreateAutomaticBackup(
  appVersion: string,
  lastAutoBackupAt?: string,
  force = false,
): Promise<boolean> {
  if (autoRun) return autoRun;
  autoRun = (async () => {
    const previous = lastAutoBackupAt ? new Date(lastAutoBackupAt).getTime() : 0;
    if (!force && Date.now() - previous < AUTO_AFTER_MS) return false;
    if (!(await opfsAvailable())) return false;
    const archive = await buildBackupArchive(appVersion, 'auto');
    const path = `backups/${archive.filename}`;
    await writeFile(path, bytesAsBlobPart(archive.bytes));
    const names = (await listDir('backups'))
      .filter((name) => /^ex-libris-auto-.*\.zip$/.test(name))
      .sort();
    for (const name of names.slice(0, Math.max(0, names.length - AUTO_LIMIT))) {
      await deleteFile(`backups/${name}`);
    }
    await saveSettings({ lastAutoBackupAt: archive.manifest.createdAt });
    return true;
  })().finally(() => {
    autoRun = null;
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
      const entries = readZip(await file.arrayBuffer());
      const raw = entries.get('manifest.json');
      if (!raw) continue;
      const manifest = JSON.parse(textDecoder.decode(raw)) as BackupManifest;
      if (manifest.format !== 'ex-libris-backup' || manifest.version !== 1) continue;
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
  const blob = new Blob([bytesAsBlobPart(archive.bytes)], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = archive.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  requestAnimationFrame(() => URL.revokeObjectURL(url));
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
      await writable.write(bytesAsBlobPart(archive.bytes));
    } finally {
      await writable.close();
    }
  } else {
    downloadArchive(archive);
  }
  await saveSettings({ lastManualExportAt: archive.manifest.createdAt });
  return archive;
}
