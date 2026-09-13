import { listAutomaticBackups, maybeCreateAutomaticBackup } from './backup';
import { db, saveSettings } from '../db/db';
import * as repo from '../db/repo';
import { nav } from '../router/router';
import { deleteFile, listDir } from '../storage/opfs';
import { APP_VERSION } from '../ui/store';

interface Phase8Fixture {
  workId: string;
  noteId: string;
}

interface Phase8TestBridge {
  seed(): Promise<Phase8Fixture>;
  openBackup(): void;
  forceAutomaticBackup(): Promise<number>;
  clearAutomaticBackups(): Promise<void>;
  counts(): Promise<{ works: number; notes: number }>;
}

declare global {
  interface Window {
    __EXL_PHASE8_TEST__?: Phase8TestBridge;
  }
}

window.__EXL_PHASE8_TEST__ = {
  async seed() {
    const work = await repo.createWork({
      title: 'The Glass Backup',
      authorName: 'Mira Vale',
      format: 'book',
      status: 'reading',
      publicationStatus: 'complete',
      tagNames: ['Memory'],
    });
    const note = await repo.createNote({
      title: 'What must survive',
      body: 'A note linked to the archived work.',
      workIds: [work.id],
      tagNames: ['Memory'],
    });
    return { workId: work.id, noteId: note.id };
  },

  openBackup() {
    nav.reset({ screen: 'backup' });
  },

  async forceAutomaticBackup() {
    await maybeCreateAutomaticBackup(APP_VERSION, undefined, true);
    return (await listAutomaticBackups()).length;
  },

  async clearAutomaticBackups() {
    // If the app-open snapshot is still being assembled, join it before
    // clearing the test fixture so it cannot race back into the empty state.
    await maybeCreateAutomaticBackup(APP_VERSION, new Date().toISOString());
    const names = await listDir('backups');
    await Promise.all(names.map((name) => deleteFile(`backups/${name}`)));
    // Keep the timestamp current while the files are absent. Writing
    // `undefined` would immediately trigger App's 48-hour effect and race a
    // new snapshot into the deliberate empty-state fixture.
    await saveSettings({ lastAutoBackupAt: new Date().toISOString() });
  },

  async counts() {
    return { works: await db.work.count(), notes: await db.note.count() };
  },
};
