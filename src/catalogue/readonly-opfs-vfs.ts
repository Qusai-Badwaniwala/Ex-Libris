import * as SQLite from '@journeyapps/wa-sqlite';
import { Base } from '@journeyapps/wa-sqlite/src/VFS.js';

function normalizedPath(name: string): string {
  return decodeURIComponent(new URL(name, 'http://localhost/').pathname).replace(/^\/+/, '');
}

async function accessHandleFor(path: string): Promise<FileSystemSyncAccessHandle> {
  const pieces = path.split('/').filter(Boolean);
  const filename = pieces.pop();
  if (!filename) throw new Error('The catalogue path has no filename.');

  let directory = await navigator.storage.getDirectory();
  for (const piece of pieces) directory = await directory.getDirectoryHandle(piece);
  const file = await directory.getFileHandle(filename);
  if (typeof file.createSyncAccessHandle !== 'function') {
    throw new Error('This browser cannot open the on-device catalogue efficiently.');
  }
  return file.createSyncAccessHandle();
}

/**
 * A deliberately narrow VFS for one prebuilt immutable database.
 *
 * The general wa-sqlite OPFS example crosses Asyncify for every page read. A
 * typeahead query then spends more time crossing the async boundary than in
 * FTS5. Phase 3 already downloads and writes through the File System API, so
 * the worker only needs synchronous random reads from the promoted file.
 */
export class ReadonlyOpfsVFS extends Base {
  readonly name = 'ex-libris-opfs-readonly';
  override mxPathName = 1024;
  readonly path: string;
  readonly #access: FileSystemSyncAccessHandle;
  readonly #files = new Set<number>();

  private constructor(path: string, access: FileSystemSyncAccessHandle) {
    super();
    this.path = path;
    this.#access = access;
  }

  static async create(path: string): Promise<ReadonlyOpfsVFS> {
    return new ReadonlyOpfsVFS(path, await accessHandleFor(path));
  }

  close(): void {
    this.#files.clear();
    this.#access.close();
  }

  override xOpen(name: string | null, fileId: number, flags: number, pOutFlags: DataView): number {
    if (!name || !(flags & SQLite.SQLITE_OPEN_MAIN_DB) || normalizedPath(name) !== this.path) {
      return SQLite.SQLITE_CANTOPEN;
    }
    this.#files.add(fileId);
    pOutFlags.setInt32(0, flags, true);
    return SQLite.SQLITE_OK;
  }

  override xClose(fileId: number): number {
    this.#files.delete(fileId);
    return SQLite.SQLITE_OK;
  }

  override xRead(fileId: number, data: Uint8Array, offset: number): number {
    if (!this.#files.has(fileId)) return SQLite.SQLITE_IOERR;
    const bytesRead = this.#access.read(data, { at: offset });
    if (bytesRead < data.byteLength) {
      data.fill(0, bytesRead);
      return SQLite.SQLITE_IOERR_SHORT_READ;
    }
    return SQLite.SQLITE_OK;
  }

  override xFileSize(fileId: number, size: DataView): number {
    if (!this.#files.has(fileId)) return SQLite.SQLITE_IOERR;
    size.setBigInt64(0, BigInt(this.#access.getSize()), true);
    return SQLite.SQLITE_OK;
  }

  override xAccess(name: string, _flags: number, result: DataView): number {
    result.setInt32(0, normalizedPath(name) === this.path ? 1 : 0, true);
    return SQLite.SQLITE_OK;
  }

  override xSectorSize(_fileId: number): number {
    return 4096;
  }

  override xDeviceCharacteristics(_fileId: number): number {
    return SQLite.SQLITE_IOCAP_IMMUTABLE;
  }
}
