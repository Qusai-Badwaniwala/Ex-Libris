import { buildBackupArchive, listAutomaticBackups, maybeCreateAutomaticBackup } from './backup';
import { readBackupFile, restoreBackup } from './restore';
import { db, saveSettings } from '../db/db';
import * as repo from '../db/repo';
import { nav } from '../router/router';
import { deleteFile, listDir, readFile, writeFile } from '../storage/opfs';
import { APP_VERSION } from '../ui/store';

interface Phase8Fixture {
  workId: string;
  noteId: string;
}

interface Phase8TestBridge {
  seed(): Promise<Phase8Fixture>;
  stressArchive(): Promise<{
    bytes: number;
    covers: number;
    elapsedMs: number;
    frames: number;
    longestFrameMs: number;
    longestTaskMs: number;
    coverDigestsMatch: boolean;
  }>;
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
  async stressArchive() {
    const expected = new Map<string, string>();
    const digest = async (buffer: ArrayBuffer) =>
      [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    // Deliberately synthetic binary fixtures: no downloaded or reader covers.
    for (const [index, value] of [37, 219].entries()) {
      const work = await repo.createWork({
        title: `Archive stress cover ${index + 1}`,
        format: 'book',
        status: 'reading',
      });
      const buffer = new ArrayBuffer(8 * 1024 * 1024);
      const bytes = new Uint8Array(buffer);
      bytes.fill(value);
      bytes[bytes.length - 1] = index;
      const path = `covers/user/${work.id}/stress.webp`;
      await writeFile(path, buffer);
      await db.work.update(work.id, { coverSource: 'user', coverPath: path });
      expected.set(work.id, await digest(buffer));
    }
    const frameTimes: number[] = [];
    const longTasks: number[] = [];
    const observer = new PerformanceObserver((list) => {
      longTasks.push(...list.getEntries().map((entry) => entry.duration));
    });
    if (PerformanceObserver.supportedEntryTypes.includes('longtask'))
      observer.observe({ type: 'longtask' });
    let frame = 0;
    const tick = (at: number) => {
      frameTimes.push(at);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const started = performance.now();
    try {
      const archive = await buildBackupArchive(APP_VERSION);
      const byteLength = archive.bytes.byteLength;
      const prepared = await readBackupFile(
        new File([archive.bytes.buffer as ArrayBuffer], archive.filename, {
          type: 'application/zip',
        }),
      );
      // This includes the verified safety copy before replacing the disposable
      // test library, then writes the transferred cover payloads back to OPFS.
      await restoreBackup(prepared, 'replace', APP_VERSION);
      let coverDigestsMatch = true;
      for (const [id, expectedDigest] of expected) {
        const work = await db.work.get(id);
        const file = work?.coverPath ? await readFile(work.coverPath) : null;
        if (!file || (await digest(await file.arrayBuffer())) !== expectedDigest)
          coverDigestsMatch = false;
      }
      longTasks.push(...observer.takeRecords().map((entry) => entry.duration));
      const times = [started, ...frameTimes, performance.now()];
      return {
        bytes: byteLength,
        covers: prepared.coverBytes.size,
        elapsedMs: performance.now() - started,
        frames: frameTimes.length,
        longestFrameMs: Math.max(...times.slice(1).map((at, index) => at - times[index]!)),
        longestTaskMs: Math.max(0, ...longTasks),
        coverDigestsMatch,
      };
    } finally {
      cancelAnimationFrame(frame);
      observer.disconnect();
    }
  },

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
