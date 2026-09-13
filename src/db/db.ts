import Dexie, { type Table, type Transaction } from 'dexie';
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
import { nowIso } from './keys';

/**
 * The migration harness.
 *
 * Every schema version is one entry in this array and nowhere else. Dexie
 * applies them in order for any user arriving from any older version, so the
 * only rule is: APPEND, never edit a shipped entry. Editing version 1 after it
 * ships means a device that already ran version 1 never sees the change.
 *
 * The data lives on the user's device with no server and no way to reach them,
 * so a migration may only ADD. A missing field must resolve to the behaviour
 * that user already had, never to the new default — do that in the `upgrade`
 * function, in one place, not at every read site.
 */
interface Migration {
  version: number;
  stores: Record<string, string | null>;
  upgrade?: (tx: Transaction) => Promise<void> | void;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    stores: {
      // The compound [format+status] serves the format screens; *genres and
      // *tagIds are multi-entry so filtering never scans the table.
      work: 'id, status, format, seriesId, universeId, sortTitle, dateAdded, dateFinished, deletedAt, [format+status], *genres, *tagIds',
      axisRating: 'workId',
      series: 'id, sortName, universeId, source',
      universe: 'id, name, source',
      author: 'id, sortName, name',
      note: 'id, updatedAt, pinned, deletedAt, *tagIds',
      // The pair is the identity: attaching the same note to the same work
      // twice is not a second link.
      noteLink: '[noteId+workId], noteId, workId',
      // &normalizedName is unique on purpose. SCHEMA §7 says tags merge on
      // collision; a unique index makes the duplicate impossible to write
      // rather than something every call site has to remember to check.
      tag: 'id, &normalizedName, usageCount, *groups',
      readingSession: 'id, workId, at',
      settings: 'id',
    },
  },
  {
    version: 2,
    stores: {
      readingOrder: 'id, [contextType+contextId], contextId, source',
      readingOrderEntry: 'id, orderId, [orderId+position], workId, seriesId, corpusId',
    },
  },
];

export class ExLibrisDB extends Dexie {
  work!: Table<Work, string>;
  axisRating!: Table<AxisRating, string>;
  series!: Table<Series, string>;
  universe!: Table<Universe, string>;
  author!: Table<Author, string>;
  note!: Table<Note, string>;
  noteLink!: Table<NoteLink, [string, string]>;
  readingOrder!: Table<ReadingOrder, string>;
  readingOrderEntry!: Table<ReadingOrderEntry, string>;
  tag!: Table<Tag, string>;
  readingSession!: Table<ReadingSession, string>;
  settings!: Table<Settings, string>;

  constructor(name = 'ex-libris') {
    super(name);
    for (const m of MIGRATIONS) {
      const v = this.version(m.version).stores(m.stores);
      if (m.upgrade) v.upgrade(m.upgrade);
    }
  }
}

export const db = new ExLibrisDB();

/** The version this build writes. Backups carry it; restore checks it. */
export const DB_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version;

export function defaultSettings(appVersion: string): Settings {
  return {
    id: 'singleton',
    theme: 'system',
    defaultView: { book: 'list', novel: 'list', manhwa: 'list' },
    // D-004: the threshold is only the value written at first run. Below eight
    // sections, collapsing hides the whole library behind taps.
    seriesSectionsDefaultOpen: true,
    contentWarningsOn: false,
    genreFilterMode: 'any',
    aiEnabled: false,
    aiCallsToday: 0,
    aiDailyCap: 50,
    appVersion,
  };
}

/**
 * Reads the settings row, creating it on first run. `firstTrackedAt` is stamped
 * here and never again: it is the origin for "years tracked", and deriving that
 * from the earliest dateAdded would make the figure shrink when the oldest
 * record is deleted.
 */
export async function loadSettings(appVersion: string): Promise<Settings> {
  // StrictMode deliberately starts effects twice in development, and two app
  // roots can also open the same installed PWA close together. The read and
  // first insert must therefore be one serialized transaction; two separate
  // get/add calls race into a ConstraintError on the singleton key.
  return db.transaction('rw', db.settings, async () => {
    const existing = await db.settings.get('singleton');
    if (existing) {
      if (existing.appVersion !== appVersion) {
        await db.settings.update('singleton', { appVersion });
        return { ...existing, appVersion };
      }
      return existing;
    }
    const fresh: Settings = { ...defaultSettings(appVersion), firstTrackedAt: nowIso() };
    await db.settings.add(fresh);
    return fresh;
  });
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  await db.settings.update('singleton', patch);
}
