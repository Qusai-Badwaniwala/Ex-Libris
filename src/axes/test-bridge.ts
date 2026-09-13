import { db } from '../db/db';
import * as repo from '../db/repo';
import { nav } from '../router/router';

interface Phase6Fixture {
  targetId: string;
  recommendationId: string;
}

interface Phase6TestBridge {
  seed(): Promise<Phase6Fixture>;
  seedSessionFinish(): Promise<string>;
  openDetail(id: string): void;
  failNextAxisWrite(): void;
}

declare global {
  interface Window {
    __EXL_PHASE6_TEST__?: Phase6TestBridge;
  }
}

window.__EXL_PHASE6_TEST__ = {
  async seed() {
    const target = await repo.createWork({
      title: 'The Night Archive',
      authorName: 'Mira Vale',
      format: 'book',
      status: 'reading',
      publicationStatus: 'complete',
      progressCurrent: 388,
      progressTotal: 388,
    });
    const recommendation = await repo.createWork({
      title: 'A Compass of Salt',
      authorName: 'Mira Vale',
      format: 'book',
      status: 'finished',
      publicationStatus: 'complete',
      progressCurrent: 416,
      progressTotal: 416,
    });
    const distant = await repo.createWork({
      title: 'The Patient Orchard',
      authorName: 'I. Rowan',
      format: 'book',
      status: 'finished',
      publicationStatus: 'complete',
    });
    await repo.saveAxisRating(recommendation.id, {
      protagonist: 5,
      powerSystem: 5,
      world: 5,
      pacing: 1,
      prose: 1,
      ending: 4,
      translation: 1,
    });
    await repo.saveAxisRating(distant.id, {
      protagonist: 1,
      powerSystem: 1,
      world: 1,
      pacing: 5,
      prose: 5,
      ending: 1,
      translation: 5,
    });
    return { targetId: target.id, recommendationId: recommendation.id };
  },

  async seedSessionFinish() {
    const work = await repo.createWork({
      title: 'The Last Waystone',
      authorName: 'N. Orr',
      format: 'book',
      status: 'reading',
      publicationStatus: 'complete',
      progressCurrent: 7,
      progressTotal: 8,
    });
    return work.id;
  },

  openDetail(id) {
    nav.push({ screen: 'detail', id });
  },

  failNextAxisWrite() {
    const fail = () => {
      db.axisRating.hook('creating').unsubscribe(fail);
      throw new Error('Synthetic storage failure.');
    };
    db.axisRating.hook('creating').subscribe(fail);
  },
};
