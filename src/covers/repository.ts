import { db } from '../db/db';
import { nowIso } from '../db/keys';
import type { CoverSource, TextColor, Work } from '../db/schema';

export interface CoverFacts {
  path: string;
  source: Exclude<CoverSource, 'none'>;
  remoteUrl?: string;
  dominantColor: string;
  textColor: TextColor;
}

export type CoverCommit =
  | { outcome: 'stored'; work: Work; previousPath?: string }
  | { outcome: 'skipped-user-cover'; work: Work };

export type CoverRemoval =
  { outcome: 'removed'; work: Work; removedPath: string } | { outcome: 'unchanged'; work: Work };

export interface CoverRecordRepository {
  get(workId: string): Promise<Work | undefined>;
  commit(workId: string, facts: CoverFacts): Promise<CoverCommit>;
  remove(workId: string, expectedSource?: Exclude<CoverSource, 'none'>): Promise<CoverRemoval>;
}

async function requireWork(workId: string): Promise<Work> {
  const work = await db.work.get(workId);
  if (!work) throw new Error(`Work ${workId} does not exist.`);
  return work;
}

export const dexieCoverRepository: CoverRecordRepository = {
  get(workId) {
    return db.work.get(workId);
  },
  commit(workId, facts) {
    return db.transaction('rw', db.work, async () => {
      const current = await requireWork(workId);
      // The fetch and image decode happen outside this transaction. Rechecking
      // here is what prevents a late API response from replacing a user cover.
      if (facts.source === 'api' && current.coverSource === 'user') {
        return { outcome: 'skipped-user-cover', work: current };
      }

      const previousPath = current.coverPath;
      await db.work.update(workId, {
        coverSource: facts.source,
        coverPath: facts.path,
        coverRemoteUrl: facts.source === 'api' ? facts.remoteUrl : current.coverRemoteUrl,
        coverDominantColor: facts.dominantColor,
        coverTextColor: facts.textColor,
        updatedAt: nowIso(),
      });
      const work = await requireWork(workId);
      return { outcome: 'stored', work, previousPath };
    });
  },
  remove(workId, expectedSource) {
    return db.transaction('rw', db.work, async () => {
      const current = await requireWork(workId);
      if (!current.coverPath || (expectedSource && current.coverSource !== expectedSource)) {
        return { outcome: 'unchanged', work: current };
      }
      const removedPath = current.coverPath;
      await db.work.update(workId, {
        coverSource: 'none',
        coverPath: undefined,
        coverDominantColor: undefined,
        coverTextColor: undefined,
        // Keep coverRemoteUrl. It is the honest route to an explicit API retry
        // after a local cover is removed or an API cover is lost.
        updatedAt: nowIso(),
      });
      const work = await requireWork(workId);
      return { outcome: 'removed', work, removedPath };
    });
  },
};
