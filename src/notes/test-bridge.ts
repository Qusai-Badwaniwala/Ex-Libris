import { db } from '../db/db';
import * as repo from '../db/repo';
import { nav } from '../router/router';

interface Phase7Fixture {
  firstWorkId: string;
  secondWorkId: string;
  looseNoteId: string;
}

interface Phase7TestBridge {
  seed(): Promise<Phase7Fixture>;
  openNotes(): void;
  openDetail(id: string): void;
  openSearch(): void;
  openTrash(): void;
  createLinkedNote(workIds: string[]): Promise<string>;
  failNextNoteUpdate(): void;
  purgeWork(id: string): Promise<void>;
}

declare global {
  interface Window {
    __EXL_PHASE7_TEST__?: Phase7TestBridge;
  }
}

window.__EXL_PHASE7_TEST__ = {
  async seed() {
    const firstWork = await repo.createWork({
      title: 'The Glass Archive',
      authorName: 'Mira Vale',
      format: 'book',
      status: 'reading',
      publicationStatus: 'complete',
    });
    const secondWork = await repo.createWork({
      title: 'A River of Margins',
      authorName: 'I. Rowan',
      format: 'novel',
      status: 'finished',
      publicationStatus: 'complete',
    });
    const looseNote = await repo.createNote({ body: 'An older loose thought.' });
    return {
      firstWorkId: firstWork.id,
      secondWorkId: secondWork.id,
      looseNoteId: looseNote.id,
    };
  },

  openNotes() {
    nav.reset({ screen: 'notes' });
  },

  openDetail(id) {
    nav.reset({ screen: 'detail', id });
  },

  openSearch() {
    nav.reset({ screen: 'search' });
  },

  openTrash() {
    nav.reset({ screen: 'trash' });
  },

  async createLinkedNote(workIds) {
    const note = await repo.createNote({
      title: 'Surviving note',
      body: 'The writing remains mine.',
      workIds,
    });
    return note.id;
  },

  failNextNoteUpdate() {
    const fail = () => {
      db.note.hook('updating').unsubscribe(fail);
      throw new Error('Synthetic storage failure.');
    };
    db.note.hook('updating').subscribe(fail);
  },

  purgeWork(id) {
    return repo.purgeWork(id);
  },
};
