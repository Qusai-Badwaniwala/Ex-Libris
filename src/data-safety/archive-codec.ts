import type { BackupFile } from '../db/backup';
import {
  assertBackupData,
  parseBackupBuffer,
  type BackupManifest,
  type PreparedBackup,
} from './archive-format';
import { createZip, type ZipEntry } from './zip';

export type ArchiveRequest =
  | { type: 'build'; data: BackupFile; manifest: BackupManifest; entries: ZipEntry[] }
  | { type: 'read'; filename: string; buffer: ArrayBuffer }
  | { type: 'verify'; filename: string; buffer: ArrayBuffer; expected?: ArrayBuffer }
  | { type: 'validate'; data: BackupFile };

export interface VerifiedArchive {
  buffer: ArrayBuffer;
  manifest: BackupManifest;
}

export type ArchiveResult = Uint8Array | PreparedBackup | VerifiedArchive | undefined;

/** Pure archive work only: no IndexedDB, OPFS, network or DOM in this module. */
export function processArchiveTask(request: ArchiveRequest): ArchiveResult {
  switch (request.type) {
    case 'build': {
      assertBackupData(request.data);
      const encoder = new TextEncoder();
      return createZip([
        { name: 'manifest.json', data: encoder.encode(JSON.stringify(request.manifest, null, 2)) },
        { name: 'data.json', data: encoder.encode(JSON.stringify(request.data, null, 2)) },
        ...request.entries,
      ]);
    }
    case 'read':
      return parseBackupBuffer(request.filename, request.buffer);
    case 'verify': {
      if (request.expected) {
        const stored = new Uint8Array(request.buffer);
        const expected = new Uint8Array(request.expected);
        if (
          stored.length !== expected.length ||
          stored.some((value, index) => value !== expected[index])
        ) {
          throw new Error('The safety backup verification failed. Nothing was changed.');
        }
      }
      const prepared = parseBackupBuffer(request.filename, request.buffer);
      if (!prepared.manifest) throw new Error('A retained snapshot must be a complete ZIP backup.');
      return { buffer: request.buffer, manifest: prepared.manifest };
    }
    case 'validate':
      assertBackupData(request.data);
      return;
  }
}

export function archiveResultTransfers(result: ArchiveResult): ArrayBuffer[] {
  if (!result) return [];
  if (result instanceof Uint8Array) return [result.buffer as ArrayBuffer];
  if ('buffer' in result) return [result.buffer];
  return [...new Set([...result.coverBytes.values()].map((bytes) => bytes.buffer as ArrayBuffer))];
}
