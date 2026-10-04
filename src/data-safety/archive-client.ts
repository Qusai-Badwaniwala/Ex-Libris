import type { BackupFile } from '../db/backup';
import type { BackupManifest, PreparedBackup } from './archive-format';
import type { ArchiveRequest, VerifiedArchive } from './archive-codec';
import type { ZipEntry } from './zip';

interface Pending {
  resolve(value: unknown): void;
  reject(cause: Error): void;
}

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, Pending>();

function stopWorker(message: string) {
  worker?.terminate();
  worker = null;
  for (const job of pending.values()) job.reject(new Error(message));
  pending.clear();
}

function archiveWorker(): Worker {
  if (worker) return worker;
  if (typeof Worker === 'undefined') {
    throw new Error(
      'This browser cannot process backup archives in a worker. Nothing was changed.',
    );
  }
  worker = new Worker(new URL('./archive-worker.ts', import.meta.url), {
    type: 'module',
    name: 'Ex Libris archives',
  });
  worker.onmessage = (event: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
    const job = pending.get(event.data.id);
    if (!job) return;
    pending.delete(event.data.id);
    if (event.data.error) job.reject(new Error(event.data.error));
    else job.resolve(event.data.result);
  };
  worker.onerror = (event) => {
    event.preventDefault();
    stopWorker('Archive processing stopped. Try again; no library changes were made.');
  };
  worker.onmessageerror = () =>
    stopWorker('The archive worker could not return its result. Nothing was changed.');
  return worker;
}

/** One lazy worker stays dormant between jobs. Buffer ownership moves rather
 * than duplicating cover archives between threads. A failed worker is discarded;
 * the next reader action starts a fresh one, never a blocking main-thread fallback. */
function requestArchive<T>(request: ArchiveRequest, buffers: ArrayBuffer[] = []): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    try {
      const target = archiveWorker();
      pending.set(id, { resolve: (value) => resolve(value as T), reject });
      target.postMessage({ id, request }, [...new Set(buffers)]);
    } catch (cause) {
      pending.delete(id);
      reject(cause);
    }
  });
}

export function archiveBuffer(bytes: Uint8Array): ArrayBuffer {
  if (
    bytes.buffer instanceof ArrayBuffer &&
    bytes.byteOffset === 0 &&
    bytes.byteLength === bytes.buffer.byteLength
  )
    return bytes.buffer;
  return bytes.slice().buffer as ArrayBuffer;
}

export function encodeArchive(
  data: BackupFile,
  manifest: BackupManifest,
  entries: ZipEntry[],
): Promise<Uint8Array> {
  return requestArchive(
    { type: 'build', data, manifest, entries },
    entries.map((entry) => entry.data.buffer as ArrayBuffer),
  );
}

export function decodeArchive(filename: string, buffer: ArrayBuffer): Promise<PreparedBackup> {
  return requestArchive({ type: 'read', filename, buffer }, [buffer]);
}

export function verifyArchive(
  filename: string,
  buffer: ArrayBuffer,
  expected?: ArrayBuffer,
): Promise<VerifiedArchive> {
  return requestArchive(
    { type: 'verify', filename, buffer, expected },
    expected ? [buffer, expected] : [buffer],
  );
}

export function validateArchiveData(data: BackupFile): Promise<void> {
  return requestArchive({ type: 'validate', data });
}
