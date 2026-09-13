import { db, saveSettings } from '../db/db';
import * as repo from '../db/repo';
import { nav } from '../router/router';

interface Phase10TestBridge {
  seedTags(): Promise<void>;
  openSettings(): void;
  openAbout(): void;
  setLongOwnerName(): Promise<void>;
  getTheme(): Promise<string | undefined>;
  failNextSettingsUpdate(): void;
  failNextTagUpdate(): void;
  clearTags(): Promise<void>;
}

declare global {
  interface Window {
    __EXL_PHASE10_TEST__?: Phase10TestBridge;
  }
}

window.__EXL_PHASE10_TEST__ = {
  async seedTags() {
    const darkFantasy = await repo.tagByName('Dark fantasy');
    const grimdark = await repo.tagByName('Grimdark');
    const unused = await repo.tagByName('Unused label');
    const trashTag = await repo.tagByName('Only in Trash');
    await repo.createWork({
      title: 'The Shadow Ledger',
      format: 'novel',
      status: 'reading',
      publicationStatus: 'complete',
      tagIds: [darkFantasy.id],
    });
    await repo.createNote({ body: 'A second spelling.', tagNames: [grimdark.name] });
    const trashed = await repo.createWork({
      title: 'The Archived Label',
      format: 'book',
      status: 'finished',
      publicationStatus: 'complete',
      tagIds: [trashTag.id],
    });
    await repo.softDeleteWork(trashed.id);
    await repo.refreshTagCounts();
    // Keep the intentionally unused row explicit for the journey.
    await db.tag.put({ ...unused, usageCount: 0 });
  },

  openSettings() {
    nav.reset({ screen: 'settings' });
  },

  openAbout() {
    nav.reset({ screen: 'about' });
  },

  setLongOwnerName() {
    return saveSettings({ ownerName: 'Qusai of the Very Long Marginal Archive' });
  },

  async getTheme() {
    return (await db.settings.get('singleton'))?.theme;
  },

  failNextSettingsUpdate() {
    const fail = (changes: Record<string, unknown>) => {
      // Automatic-backup bookkeeping can update the same settings row after
      // startup. Keep the synthetic failure reserved for the theme write this
      // journey is exercising instead of letting that background write consume it.
      if (!Object.hasOwn(changes, 'theme')) return;
      db.settings.hook('updating').unsubscribe(fail);
      throw new Error('Synthetic settings failure.');
    };
    db.settings.hook('updating').subscribe(fail);
  },

  failNextTagUpdate() {
    const fail = () => {
      db.tag.hook('updating').unsubscribe(fail);
      throw new Error('Synthetic tag failure.');
    };
    db.tag.hook('updating').subscribe(fail);
  },

  clearTags() {
    return db.transaction('rw', db.work, db.note, db.tag, async () => {
      await Promise.all([db.work.clear(), db.note.clear(), db.tag.clear()]);
    });
  },
};
