import { db, DB_VERSION } from './db';
import { SCHEMA_VERSION } from './schema';
import type {
  AxisRating,
  Author,
  Note,
  NoteLink,
  ReadingOrder,
  ReadingOrderEntry,
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
 * This is the schema-versioned data.json inside Phase 8's ZIP. It remains a
 * separate function because automatic snapshots, manual exports, and restore
 * validation all need exactly the same record set and credential redaction.
 */

export interface BackupFile {
  schemaVersion: number;
  dbVersion: number;
  appVersion: string;
  createdAt: string;
  kind: 'auto' | 'manual';
  counts: {
    works: number;
    notes: number;
    series: number;
    universes: number;
    readingOrders: number;
  };
  data: {
    works: Work[];
    axisRatings: AxisRating[];
    series: Series[];
    universes: Universe[];
    authors: Author[];
    notes: Note[];
    noteLinks: NoteLink[];
    readingOrders: ReadingOrder[];
    readingOrderEntries: ReadingOrderEntry[];
    tags: Tag[];
    readingSessions: ReadingSession[];
    settings: Settings | null;
  };
  userCovers: {
    workId: string;
    /** Existing device path, used only while the archive is assembled. */
    path: string;
    filename: string;
    archivePath?: string;
    mediaType?: string;
  }[];
}

export async function buildBackup(
  appVersion: string,
  kind: 'auto' | 'manual' = 'manual',
): Promise<BackupFile> {
  return db.transaction('r', db.tables, async () => {
    const [
      works,
      axisRatings,
      series,
      universes,
      authors,
      notes,
      noteLinks,
      readingOrders,
      readingOrderEntries,
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
      db.readingOrder.toArray(),
      db.readingOrderEntry.toArray(),
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

    const safeWorks = works.map((work) => {
      if (work.coverSource !== 'api') return work;
      // API covers are replaceable and intentionally absent from the archive.
      // A restored record therefore cannot point at a file that was never sent.
      const copy = { ...work, coverSource: 'none' as const };
      delete copy.coverPath;
      return copy;
    });

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
        readingOrders: readingOrders.length,
      },
      data: {
        works: safeWorks,
        axisRatings,
        series,
        universes,
        authors,
        notes,
        noteLinks,
        readingOrders,
        readingOrderEntries,
        tags,
        readingSessions,
        settings,
      },
      userCovers: works.flatMap((work) =>
        work.coverSource === 'user' && work.coverPath
          ? [
              {
                workId: work.id,
                path: work.coverPath,
                filename: work.coverPath.split('/').at(-1) ?? `${work.id}.webp`,
              },
            ]
          : [],
      ),
    };
  });
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
