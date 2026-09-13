import { deleteFile, readFile, writeFile } from '../storage/opfs';
import type { CoverSource } from '../db/schema';
import type { ProcessedCover } from './image';

export type StoredCoverSource = Exclude<CoverSource, 'none'>;

export interface CoverBinaryStore {
  write(source: StoredCoverSource, workId: string, cover: ProcessedCover): Promise<string>;
  read(path: string): Promise<Blob | null>;
  delete(path: string): Promise<boolean>;
}

function safeSegment(value: string): string {
  const clean = value.trim();
  if (!clean) throw new Error('A cover cannot be stored without a work identifier.');
  return encodeURIComponent(clean).replaceAll('%', '_');
}

export function coverStoragePath(
  source: StoredCoverSource,
  workId: string,
  nonce: string,
  extension: ProcessedCover['extension'],
): string {
  return `covers/${source}/${safeSegment(workId)}/${safeSegment(nonce)}.${extension}`;
}

/**
 * Each write gets a new path. The OPFS writable commits on close; only after
 * that promise resolves may Dexie point at the file. A failed write can never
 * replace the cover path that was already visible to the app.
 */
export function createOpfsCoverStore(randomId = () => crypto.randomUUID()): CoverBinaryStore {
  return {
    async write(source, workId, cover) {
      const path = coverStoragePath(source, workId, randomId(), cover.extension);
      try {
        await writeFile(path, cover.blob);
        return path;
      } catch (error) {
        await deleteFile(path);
        throw error;
      }
    },
    async read(path) {
      return readFile(path);
    },
    delete(path) {
      return deleteFile(path);
    },
  };
}

export const opfsCoverStore = createOpfsCoverStore();
