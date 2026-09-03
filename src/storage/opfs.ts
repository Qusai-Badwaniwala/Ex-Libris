/**
 * Origin Private File System wrapper. Everything binary lives here: covers,
 * backups, and eventually the corpus database.
 *
 * OPFS needs a secure context. On a plain http:// LAN address — which is
 * exactly how this app gets opened on a phone during development —
 * `navigator.storage` is undefined and every call below would throw. So
 * availability is checked once and the whole module degrades to "unavailable"
 * rather than to a stack trace. A caller that cannot store a cover still has a
 * working app; a caller that gets an exception does not.
 */

let cached: FileSystemDirectoryHandle | null = null;
let probed = false;
let available = false;

export async function opfsAvailable(): Promise<boolean> {
  if (probed) return available;
  probed = true;
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) {
      available = false;
      return false;
    }
    cached = await navigator.storage.getDirectory();
    available = true;
  } catch {
    available = false;
  }
  return available;
}

async function root(): Promise<FileSystemDirectoryHandle> {
  if (!(await opfsAvailable()) || !cached) throw new OpfsUnavailable();
  return cached;
}

export class OpfsUnavailable extends Error {
  constructor() {
    super('The origin private file system is not available in this context.');
    this.name = 'OpfsUnavailable';
  }
}

/** 'covers/user/abc.webp' -> ['covers', 'user'] + 'abc.webp' */
function split(path: string): { dirs: string[]; file: string } {
  const parts = path.split('/').filter(Boolean);
  const file = parts.pop() ?? '';
  return { dirs: parts, file };
}

async function dirFor(dirs: string[], create: boolean): Promise<FileSystemDirectoryHandle> {
  let handle = await root();
  for (const d of dirs) {
    handle = await handle.getDirectoryHandle(d, { create });
  }
  return handle;
}

export async function writeFile(path: string, data: Blob | ArrayBuffer | string): Promise<void> {
  const { dirs, file } = split(path);
  const dir = await dirFor(dirs, true);
  const handle = await dir.getFileHandle(file, { create: true });
  const w = await handle.createWritable();
  try {
    await w.write(data);
  } finally {
    // close() commits. Without the finally, a write that throws mid-stream
    // leaves a zero-byte file behind that reads as "the cover is cached".
    await w.close();
  }
}

export async function readFile(path: string): Promise<File | null> {
  const { dirs, file } = split(path);
  try {
    const dir = await dirFor(dirs, false);
    const handle = await dir.getFileHandle(file);
    return await handle.getFile();
  } catch {
    return null;
  }
}

export async function fileExists(path: string): Promise<boolean> {
  return (await readFile(path)) !== null;
}

export async function deleteFile(path: string): Promise<boolean> {
  const { dirs, file } = split(path);
  try {
    const dir = await dirFor(dirs, false);
    await dir.removeEntry(file);
    return true;
  } catch {
    return false;
  }
}

export async function listDir(path: string): Promise<string[]> {
  const dirs = path.split('/').filter(Boolean);
  try {
    const dir = await dirFor(dirs, false);
    const names: string[] = [];
    // @ts-expect-error - keys() is present on FileSystemDirectoryHandle at
    // runtime in every browser that ships OPFS, but is not yet in the DOM lib.
    for await (const name of dir.keys()) names.push(name as string);
    return names.sort();
  } catch {
    return [];
  }
}

export interface StorageUsage {
  usedBytes: number;
  quotaBytes: number;
  persisted: boolean;
}

/** Feeds the Settings storage row. Zeroes when the browser will not say. */
export async function storageUsage(): Promise<StorageUsage> {
  let usedBytes = 0;
  let quotaBytes = 0;
  let persisted = false;
  try {
    const est = await navigator.storage?.estimate?.();
    usedBytes = est?.usage ?? 0;
    quotaBytes = est?.quota ?? 0;
  } catch {
    /* the browser declined to estimate; zeroes are honest here */
  }
  try {
    persisted = (await navigator.storage?.persisted?.()) ?? false;
  } catch {
    persisted = false;
  }
  return { usedBytes, quotaBytes, persisted };
}
