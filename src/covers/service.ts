import type { Work } from '../db/schema';
import { browserCoverImageProcessor, fetchCoverBlob, type CoverImageProcessor } from './image';
import { dexieCoverRepository, type CoverRecordRepository, type CoverRemoval } from './repository';
import { opfsCoverStore, type CoverBinaryStore } from './storage';

export type CoverWriteResult =
  { outcome: 'stored'; work: Work } | { outcome: 'skipped-user-cover'; work: Work };

export interface CoverService {
  selectUserCover(workId: string, file: Blob): Promise<CoverWriteResult>;
  replaceUserCover(workId: string, file: Blob): Promise<CoverWriteResult>;
  fetchApiCover(workId: string, remoteUrl: string, signal?: AbortSignal): Promise<CoverWriteResult>;
  removeUserCover(workId: string): Promise<CoverRemoval>;
  removeCover(workId: string): Promise<CoverRemoval>;
  read(work: Pick<Work, 'coverPath'>): Promise<Blob | null>;
}

export interface CoverServiceDependencies {
  records: CoverRecordRepository;
  binaries: CoverBinaryStore;
  processor: CoverImageProcessor;
  fetcher: typeof fetch;
}

async function discardReplacedCover(
  binaries: CoverBinaryStore,
  nextPath: string,
  previousPath?: string,
): Promise<void> {
  if (previousPath && previousPath !== nextPath) await binaries.delete(previousPath);
}

export function createCoverService(dependencies: CoverServiceDependencies): CoverService {
  const { records, binaries, processor, fetcher } = dependencies;

  const storeUserCover = async (workId: string, file: Blob): Promise<CoverWriteResult> => {
    const processed = await processor.process(file);
    const path = await binaries.write('user', workId, processed);
    try {
      const result = await records.commit(workId, {
        path,
        source: 'user',
        dominantColor: processed.dominantColor,
        textColor: processed.textColor,
      });
      if (result.outcome === 'stored') {
        await discardReplacedCover(binaries, path, result.previousPath);
      }
      return { outcome: result.outcome, work: result.work };
    } catch (error) {
      await binaries.delete(path);
      throw error;
    }
  };

  const remove = async (workId: string, expectedSource?: 'api' | 'user'): Promise<CoverRemoval> => {
    const result = await records.remove(workId, expectedSource);
    if (result.outcome === 'removed') await binaries.delete(result.removedPath);
    return result;
  };

  return {
    selectUserCover: storeUserCover,
    replaceUserCover: storeUserCover,
    async fetchApiCover(workId, remoteUrl, signal) {
      const before = await records.get(workId);
      if (!before) throw new Error(`Work ${workId} does not exist.`);
      if (before.coverSource === 'user') {
        return { outcome: 'skipped-user-cover', work: before };
      }

      const downloaded = await fetchCoverBlob(remoteUrl, { fetcher, signal });
      const processed = await processor.process(downloaded);
      const path = await binaries.write('api', workId, processed);
      try {
        const result = await records.commit(workId, {
          path,
          source: 'api',
          remoteUrl,
          dominantColor: processed.dominantColor,
          textColor: processed.textColor,
        });
        if (result.outcome === 'skipped-user-cover') {
          await binaries.delete(path);
        } else {
          await discardReplacedCover(binaries, path, result.previousPath);
        }
        return { outcome: result.outcome, work: result.work };
      } catch (error) {
        await binaries.delete(path);
        throw error;
      }
    },
    removeUserCover(workId) {
      return remove(workId, 'user');
    },
    removeCover(workId) {
      return remove(workId);
    },
    read(work) {
      return work.coverPath ? binaries.read(work.coverPath) : Promise.resolve(null);
    },
  };
}

export const coverService = createCoverService({
  records: dexieCoverRepository,
  binaries: opfsCoverStore,
  processor: browserCoverImageProcessor,
  fetcher: fetch,
});
