/// <reference lib="webworker" />

import SQLiteESMFactory from '@journeyapps/wa-sqlite/dist/wa-sqlite.mjs';
import sqliteWasmUrl from '@journeyapps/wa-sqlite/dist/wa-sqlite.wasm?url';
import * as SQLite from '@journeyapps/wa-sqlite';
import { toFtsPrefixQuery } from './query';
import { ReadonlyOpfsVFS } from './readonly-opfs-vfs';
import { CATALOGUE_SEARCH_SQL, catalogueSearchBindings } from './search-sql';
import {
  CATALOGUE_RELATIONSHIP_SQL,
  CATALOGUE_SERIES_ENTRIES_SQL,
  rowsToRelationshipEvidence,
} from './relationship-sql';
import type {
  CatalogueWorkerRequest,
  CatalogueWorkerResponse,
  CatalogueWorkerResult,
  CorpusMatch,
} from './types';

const scope = self as unknown as DedicatedWorkerGlobalScope;

let sqlite3: ReturnType<typeof SQLite.Factory> | null = null;
let vfs: ReadonlyOpfsVFS | null = null;
let database: number | null = null;
let openPath: string | null = null;
let searchStatement: number | null = null;

type SQLiteApi = ReturnType<typeof SQLite.Factory>;

async function queryRows(
  api: SQLiteApi,
  db: number,
  sql: string,
  bindings: Array<string | number> = [],
): Promise<unknown[][]> {
  for await (const statement of api.statements(db, sql)) {
    api.bind_collection(statement, bindings);
    const rows: unknown[][] = [];
    while ((await api.step(statement)) === SQLite.SQLITE_ROW) rows.push(api.row(statement));
    return rows;
  }
  return [];
}

async function runtime(path: string) {
  if (sqlite3 && vfs?.path === path) return { sqlite3, vfs };
  if (vfs) vfs.close();
  sqlite3 = null;
  vfs = null;
  const module = await SQLiteESMFactory({ locateFile: () => sqliteWasmUrl });
  sqlite3 = SQLite.Factory(module);
  vfs = await ReadonlyOpfsVFS.create(path);
  sqlite3.vfs_register(vfs, true);
  return { sqlite3, vfs };
}

async function closeDatabase(): Promise<void> {
  if (searchStatement !== null && sqlite3) await sqlite3.finalize(searchStatement);
  searchStatement = null;
  if (database !== null && sqlite3) await sqlite3.close(database);
  database = null;
  openPath = null;
}

async function openDatabase(path: string): Promise<number> {
  if (database !== null && openPath === path) return database;
  await closeDatabase();
  const ready = await runtime(path);
  // immutable=1 keeps SQLite from looking for a journal beside this read-only
  // index. The VFS also takes the fast access-handle path for immutable files.
  // SQLite only interprets URI query parameters when the filename uses the
  // file: scheme. Without it, the OPFS VFS sees `immutable=1`, but SQLite does
  // not and may attempt journal recovery against the read-only handle.
  database = await ready.sqlite3.open_v2(
    `file:/${path}?immutable=1`,
    SQLite.SQLITE_OPEN_READONLY | SQLite.SQLITE_OPEN_URI,
    ready.vfs.name,
  );
  await ready.sqlite3.exec(database, 'PRAGMA cache_size = -8192; PRAGMA temp_store = MEMORY');
  openPath = path;
  return database;
}

async function prepareSearch(api: SQLiteApi, db: number): Promise<void> {
  if (searchStatement !== null) return;
  const seedRows = await queryRows(
    api,
    db,
    `SELECT title_normalized FROM corpus_work
      WHERE length(title_normalized) >= 3
      ORDER BY popularity DESC
      LIMIT 1`,
  );
  const seedTitle = typeof seedRows[0]?.[0] === 'string' ? seedRows[0][0] : '';
  const seedWord = seedTitle.split(/\s+/).find((word) => word.length >= 3) ?? seedTitle;
  const seedExpression = toFtsPrefixQuery(seedWord);
  if (!seedExpression) throw new Error('The catalogue contains no searchable title.');
  const text = api.str_new(db, CATALOGUE_SEARCH_SQL);
  try {
    const prepared = await api.prepare_v2(db, api.str_value(text));
    if (!prepared) throw new Error('The catalogue search statement could not be prepared.');
    searchStatement = prepared.stmt;
    api.bind_collection(searchStatement, catalogueSearchBindings(seedWord, 1));
    while ((await api.step(searchStatement)) === SQLite.SQLITE_ROW) {
      // Compile and JIT the real FTS/ranking/join path before the first reader
      // keystroke. The one-row result is deliberately discarded.
    }
    await api.reset(searchStatement);
  } finally {
    api.str_finish(text);
  }
}

async function verify(path: string): Promise<{ works: number }> {
  const db = await openDatabase(path);
  if (!sqlite3) throw new Error('The catalogue database runtime did not start.');
  const ready = { sqlite3 };
  const count = await queryRows(ready.sqlite3, db, 'SELECT COUNT(*) FROM corpus_work');
  const works = Number(count[0]?.[0]);
  if (!Number.isSafeInteger(works) || works <= 0) {
    throw new Error('The downloaded index contains no works.');
  }
  // Full quick_check runs in the writable build pipeline. FTS5 implements its
  // integrity command as a special INSERT, so invoking it here would reject an
  // otherwise healthy immutable database. Still require the installed file to
  // compile and execute a real FTS5 query before it can be promoted.
  await queryRows(
    ready.sqlite3,
    db,
    `SELECT COUNT(*) FROM corpus_work_fts
      WHERE corpus_work_fts MATCH ?`,
    ['"__exl_catalogue_verify__"*'],
  );
  // Prepare the real ranked query during installation/opening. A reader's
  // first three-character search should not pay SQLite's schema compilation
  // cost on the keystroke path.
  await prepareSearch(ready.sqlite3, db);
  return { works };
}

const asText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

function rowToMatch(row: unknown[]): CorpusMatch {
  const authors = asText(row[2])
    ?.split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  const publication = asText(row[9]);
  return {
    corpusId: String(row[0]),
    title: String(row[1]),
    authors: authors ?? [],
    formatHint: row[3] === 'book' || row[3] === 'novel' || row[3] === 'manhwa' ? row[3] : undefined,
    seriesName: asText(row[4]),
    seriesPosition: asNumber(row[5]),
    universeName: asText(row[6]),
    coverId: asText(row[7]),
    coverSource:
      row[8] === 'openlibrary' || row[8] === 'anilist' || row[8] === 'mangadex'
        ? row[8]
        : undefined,
    publicationStatus:
      publication === 'ongoing' ||
      publication === 'complete' ||
      publication === 'hiatus' ||
      publication === 'abandoned'
        ? publication
        : undefined,
    chapterCount: asNumber(row[10]),
    volumeCount: asNumber(row[11]),
    year: asNumber(row[12]),
    source: String(row[13]),
  };
}

async function search(query: string, limit: number) {
  if (database === null || !sqlite3 || searchStatement === null) {
    throw new Error('The catalogue index is not open.');
  }
  const expression = toFtsPrefixQuery(query);
  if (!expression) return { matches: [], elapsedMs: 0 };
  const started = performance.now();
  await sqlite3.reset(searchStatement);
  sqlite3.bind_collection(searchStatement, catalogueSearchBindings(query, limit));
  const rows: unknown[][] = [];
  while ((await sqlite3.step(searchStatement)) === SQLite.SQLITE_ROW) {
    rows.push(sqlite3.row(searchStatement));
  }
  return { matches: rows.map(rowToMatch), elapsedMs: performance.now() - started };
}

async function relationship(corpusId: string) {
  if (database === null || !sqlite3) throw new Error('The catalogue index is not open.');
  const rootRows = await queryRows(sqlite3, database, CATALOGUE_RELATIONSHIP_SQL, [corpusId]);
  const seriesId = typeof rootRows[0]?.[12] === 'string' ? rootRows[0][12] : undefined;
  const entryRows = seriesId
    ? await queryRows(sqlite3, database, CATALOGUE_SERIES_ENTRIES_SQL, [seriesId])
    : [];
  return rowsToRelationshipEvidence(rootRows, entryRows);
}

async function handle(request: CatalogueWorkerRequest): Promise<CatalogueWorkerResult> {
  switch (request.type) {
    case 'open': {
      const checked = await verify(request.path);
      return { type: 'opened', works: checked.works };
    }
    case 'verify': {
      const checked = await verify(request.path);
      return { type: 'verified', works: checked.works };
    }
    case 'search': {
      const found = await search(request.query, request.limit);
      return { type: 'results', ...found };
    }
    case 'relationship':
      return { type: 'relationship', evidence: await relationship(request.corpusId) };
    case 'close':
      await closeDatabase();
      vfs?.close();
      sqlite3 = null;
      vfs = null;
      return { type: 'closed' };
  }
}

// Opening awaits WASM and OPFS. A second message must not create a second
// exclusive handle or change SQLite's shared statement before the first ends.
let requests: Promise<void> = Promise.resolve();
scope.addEventListener('message', (event: MessageEvent<CatalogueWorkerRequest>) => {
  const request = event.data;
  requests = requests
    .then(() => handle(request))
    .then((result) => {
      const response: CatalogueWorkerResponse = { id: request.id, ok: true, result };
      scope.postMessage(response);
    })
    .catch((error: unknown) => {
      const response: CatalogueWorkerResponse = {
        id: request.id,
        ok: false,
        error: error instanceof Error ? error.message : 'The catalogue worker failed.',
      };
      scope.postMessage(response);
    });
});
