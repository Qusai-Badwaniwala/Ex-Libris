import { db, DB_VERSION } from './db';
import { SCHEMA_VERSION } from './schema';
import type {
  AxisRating,
  Author,
  Note,
  NoteLink,
  ReadingSession,
  Series,
  Settings,
  Tag,
  Universe,
  Work,
} from './schema';

/**
 * Export.
 *
 * SCHEMA §11 describes the finished shape: a .zip carrying data.json, the
 * user-supplied covers, and a manifest. Phase 8 builds that. What is here is
 * data.json on its own, and today that is the WHOLE library — there is no cover
 * pipeline until Phase 4, so there are no user covers to leave out. The screen
 * says so rather than implying a partial backup.
 *
 * This exists in Phase 1 rather than Phase 8 because the design's Settings has
 * an "Export a copy" row with no handler behind it, and that is the wrong row
 * to leave inert: it is the only protection against losing the device.
 */

export interface BackupFile {
  schemaVersion: number;
  dbVersion: number;
  appVersion: string;
  createdAt: string;
  kind: 'auto' | 'manual';
  counts: { works: number; notes: number; series: number; universes: number };
  data: {
    works: Work[];
    axisRatings: AxisRating[];
    series: Series[];
    universes: Universe[];
    authors: Author[];
    notes: Note[];
    noteLinks: NoteLink[];
    tags: Tag[];
    readingSessions: ReadingSession[];
    settings: Settings | null;
  };
  /** Empty until Phase 4 gives covers somewhere to live. */
  userCovers: { workId: string; filename: string }[];
}

export async function buildBackup(
  appVersion: string,
  kind: 'auto' | 'manual' = 'manual',
): Promise<BackupFile> {
  const [
    works,
    axisRatings,
    series,
    universes,
    authors,
    notes,
    noteLinks,
    tags,
    readingSessions,
    settingsRow,
  ] = await Promise.all([
    db.work.toArray(),
    db.axisRating.toArray(),
    db.series.toArray(),
    db.universe.toArray(),
    db.author.toArray(),
    db.note.toArray(),
    db.noteLink.toArray(),
    db.tag.toArray(),
    db.readingSession.toArray(),
    db.settings.get('singleton'),
  ]);

  // SCHEMA §11: the API key is EXCLUDED. A backup is a file the reader may put
  // anywhere — a cloud drive, a chat to themselves — and a credential inside it
  // travels wherever the file does.
  let settings: Settings | null = null;
  if (settingsRow) {
    settings = { ...settingsRow };
    delete settings.aiApiKey;
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    dbVersion: DB_VERSION,
    appVersion,
    createdAt: new Date().toISOString(),
    kind,
    counts: {
      works: works.length,
      notes: notes.length,
      series: series.length,
      universes: universes.length,
    },
    data: {
      works,
      axisRatings,
      series,
      universes,
      authors,
      notes,
      noteLinks,
      tags,
      readingSessions,
      settings,
    },
    userCovers: [],
  };
}

/** `ex-libris-2026-09-03.json`. The date is the reader's, not UTC's. */
export function backupFilename(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `ex-libris-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

/**
 * Hands the file to the browser. Uses a blob URL and a synthetic click, which
 * is the only method that works everywhere this app runs; the File System
 * Access API gets a proper "save as" and is Phase 8's job.
 *
 * The object URL is revoked on the next frame rather than immediately —
 * revoking in the same tick cancels the download in some builds of Chrome.
 */
export function downloadBackup(file: BackupFile): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFilename();
  document.body.appendChild(a);
  a.click();
  a.remove();
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}
