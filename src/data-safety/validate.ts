import type { BackupFile } from '../db/backup';

type Row = Record<string, unknown>;
type Rule = (value: unknown) => boolean;
const text: Rule = (v) => typeof v === 'string';
const name: Rule = (v) => text(v) && (v as string).trim().length > 0;
const bool: Rule = (v) => typeof v === 'boolean';
const number: Rule = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const integer: Rule = (v) => number(v) && Number.isSafeInteger(v);
const date: Rule = (v) =>
  text(v) &&
  /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(v as string) &&
  Number.isFinite(Date.parse(v as string));
const object: Rule = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const oneOf =
  (...values: unknown[]): Rule =>
  (v) =>
    values.includes(v);
const arrayOf =
  (rule: Rule, max = Infinity): Rule =>
  (v) =>
    Array.isArray(v) && v.length <= max && v.every(rule);
const ids = arrayOf(name);
const unit = oneOf('page', 'chapter', 'percent');
const source = oneOf('user', 'corpus');
const score: Rule = (v) => integer(v) && (v as number) >= 1 && (v as number) <= 5;

function check(
  row: unknown,
  required: Record<string, Rule>,
  optional: Record<string, Rule>,
  label: string,
): asserts row is Row {
  if (!object(row)) throw new Error(`${label} is not a record.`);
  const fields = row as Row;
  for (const [key, rule] of Object.entries(required))
    if (!rule(fields[key])) throw new Error(`${label} has invalid ${key}.`);
  for (const [key, rule] of Object.entries(optional))
    if (fields[key] !== undefined && !rule(fields[key]))
      throw new Error(`${label} has invalid ${key}.`);
}

function external(value: unknown): boolean {
  return (
    object(value) &&
    Object.entries(value as Row).every(([key, v]) => (key === 'anilist' ? integer(v) : name(v)))
  );
}

/** Validate the complete known shape before preview, not only foreign keys.
 * Unknown additive fields remain portable; known fields never receive guessed defaults. */
export function validateRecordShapes(backup: BackupFile): void {
  check(
    backup,
    {
      schemaVersion: oneOf(1, 2),
      dbVersion: integer,
      appVersion: name,
      createdAt: date,
      kind: oneOf('auto', 'manual'),
    },
    {},
    'Backup',
  );
  for (const work of backup.data.works) {
    check(
      work,
      {
        id: name,
        title: name,
        sortTitle: text,
        format: oneOf('book', 'novel', 'manhwa'),
        authorIds: ids,
        status: oneOf('wishlist', 'reading', 'caught_up', 'finished', 'dropped'),
        publicationStatus: oneOf('ongoing', 'complete', 'hiatus', 'abandoned', 'unknown'),
        progressUnit: unit,
        progressCurrent: integer,
        coverSource: oneOf('api', 'user', 'none'),
        tagIds: ids,
        genres: arrayOf((v) => integer(v) && (v as number) < 12, 2),
        isTranslated: bool,
        isManualEntry: bool,
        dateAdded: date,
        updatedAt: date,
        externalIds: external,
      },
      {
        subtitle: text,
        seriesId: name,
        universeId: name,
        corpusId: name,
        seriesPosition: (v) => number(v) && (v as number) > 0,
        progressTotal: integer,
        coverPath: name,
        coverRemoteUrl: (v) => text(v) && /^https?:\/\//.test(v as string),
        coverDominantColor: (v) => text(v) && /^#[\da-f]{6}$/i.test(v as string),
        coverTextColor: oneOf('light', 'dark'),
        rating: (v) => number(v) && (v as number) <= 5,
        dateStarted: date,
        dateFinished: date,
        dateDropped: date,
        deletedAt: date,
        dropReason: text,
        dropAtProgress: integer,
      },
      'Work',
    );
    if (
      work.progressUnit === 'percent' &&
      (work.progressCurrent > 100 || (work.progressTotal ?? 100) > 100)
    )
      throw new Error('Percentage progress must be between zero and one hundred.');
    if (new Set(work.genres).size !== work.genres.length)
      throw new Error('A work has duplicate genres.');
  }
  for (const row of backup.data.axisRatings) {
    check(
      row,
      { workId: name },
      {
        protagonist: score,
        powerSystem: score,
        world: score,
        pacing: score,
        prose: score,
        ending: score,
        translation: score,
        endingNone: bool,
        ratedAt: date,
      },
      'Axis profile',
    );
    if (row.ending !== undefined && row.endingNone)
      throw new Error('An axis profile has two ending states.');
  }
  for (const row of backup.data.series)
    check(
      row,
      { id: name, name, sortName: text, source, externalIds: external, updatedAt: date },
      { universeId: name, totalEntriesKnown: integer },
      'Series',
    );
  for (const row of backup.data.universes)
    check(
      row,
      { id: name, name, source, externalIds: external, updatedAt: date },
      { description: text, readingOrderNote: text },
      'World',
    );
  for (const row of backup.data.authors)
    check(
      row,
      { id: name, name, sortName: text, externalIds: external },
      { role: oneOf('author', 'artist', 'studio', 'translator') },
      'Author',
    );
  for (const row of backup.data.notes)
    check(
      row,
      { id: name, body: text, tagIds: ids, pinned: bool, createdAt: date, updatedAt: date },
      { title: text, deletedAt: date },
      'Note',
    );
  for (const row of backup.data.noteLinks)
    check(row, { noteId: name, workId: name, createdAt: date }, {}, 'Note attachment');
  for (const row of backup.data.readingOrders)
    check(
      row,
      {
        id: name,
        contextType: oneOf('series', 'universe'),
        contextId: name,
        name,
        source,
        updatedAt: date,
      },
      { description: text },
      'Reading order',
    );
  for (const row of backup.data.readingOrderEntries) {
    check(
      row,
      {
        id: name,
        orderId: name,
        position: (v) => integer(v) && (v as number) > 0,
        kind: oneOf('work', 'series'),
        label: name,
      },
      { workId: name, seriesId: name, corpusId: name, note: text },
      'Reading-order entry',
    );
    if (
      row.kind === 'work'
        ? !!row.seriesId || (!row.workId && !row.corpusId)
        : !!row.workId || (!row.seriesId && !row.corpusId)
    )
      throw new Error('A reading-order entry has an invalid target.');
  }
  for (const row of backup.data.tags)
    check(
      row,
      {
        id: name,
        name,
        normalizedName: name,
        source,
        groups: arrayOf(
          oneOf(
            'Subgenre',
            'Setting',
            'Protagonist',
            'Themes',
            'Craft',
            'Origin',
            'Content warnings',
          ),
        ),
        usageCount: integer,
      },
      {},
      'Tag',
    );
  for (const row of backup.data.readingSessions) {
    check(
      row,
      { id: name, workId: name, from: integer, to: integer, delta: integer, unit, at: date },
      {},
      'Reading session',
    );
    if (row.delta <= 0 || row.to - row.from !== row.delta)
      throw new Error('A reading session has inconsistent progress.');
  }
  if (backup.data.settings !== null) {
    check(
      backup.data.settings,
      {
        id: oneOf('singleton'),
        theme: oneOf('light', 'dark', 'system'),
        defaultView: (v) =>
          object(v) &&
          ['book', 'novel', 'manhwa'].every((key) => oneOf('list', 'spine')((v as Row)[key])),
        seriesSectionsDefaultOpen: bool,
        contentWarningsOn: bool,
        genreFilterMode: oneOf('any', 'all'),
        aiEnabled: bool,
        aiCallsToday: integer,
        aiDailyCap: integer,
        appVersion: name,
      },
      {
        ownerName: text,
        welcomeSeenAt: date,
        tourCompletedAt: date,
        firstTrackedAt: date,
        corpusVersion: name,
        corpusInstalledAt: date,
        corpusSkippedAt: date,
        lastAutoBackupAt: date,
        lastManualExportAt: date,
        aiApiKey: text,
        aiCallsDate: text,
      },
      'Settings',
    );
  }
  for (const cover of backup.userCovers)
    check(
      cover,
      { workId: name, path: name, filename: name },
      { archivePath: name, mediaType: name },
      'User cover',
    );
}
