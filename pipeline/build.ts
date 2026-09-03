import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { OUT, cachePath, human, n, readJsonl, writeAtomic } from './lib.ts';
import type { CorpusSeries, CorpusUniverse, CorpusWork, StageReport } from './types.ts';

/**
 * Builds corpus.sqlite.
 *
 * Uses Node's built-in `node:sqlite` rather than better-sqlite3 or sql.js. Node
 * 24 ships SQLite 3.50 with FTS5, unicode61, remove_diacritics 2 and prefix
 * indexes — every option SCHEMA §10 names — so the alternative was a native
 * module that needs a C++ toolchain on Windows to build. Verified before the
 * pipeline was written rather than after.
 *
 * ponytail: node:sqlite is flagged experimental, so its API could move under a
 * Node upgrade. Contained risk: this is a build-time tool run by hand on one
 * machine, and the FILE it produces is a plain SQLite database that the app
 * reads through wa-sqlite. Nothing at runtime depends on this module.
 */

const SCHEMA = `
PRAGMA journal_mode = OFF;
PRAGMA synchronous = OFF;

CREATE TABLE corpus_work (
  id                 TEXT PRIMARY KEY,
  title              TEXT NOT NULL,
  title_normalized   TEXT NOT NULL,
  synonyms           TEXT NOT NULL DEFAULT '',
  authors            TEXT NOT NULL DEFAULT '',
  format_hint        TEXT,
  series_id          TEXT,
  series_position    REAL,
  universe_id        TEXT,
  cover_id           TEXT,
  cover_source       TEXT,
  publication_status TEXT NOT NULL DEFAULT 'unknown',
  chapter_count      INTEGER,
  volume_count       INTEGER,
  year               INTEGER,
  popularity         INTEGER NOT NULL DEFAULT 0,
  external_ids       TEXT NOT NULL DEFAULT '{}',
  source             TEXT NOT NULL
);

CREATE TABLE corpus_series (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  universe_id   TEXT,
  total_entries INTEGER,
  source        TEXT NOT NULL
);

CREATE TABLE corpus_universe (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  source      TEXT NOT NULL
);

CREATE INDEX idx_work_series   ON corpus_work(series_id);
CREATE INDEX idx_work_universe ON corpus_work(universe_id);
-- Ranking reads popularity on every typeahead, so it is worth its own index.
CREATE INDEX idx_work_pop      ON corpus_work(popularity DESC);

-- External content: the FTS index points at corpus_work rather than keeping a
-- second copy of every title and author string. On a corpus this size that is
-- the difference between one copy of the text and two.
CREATE VIRTUAL TABLE corpus_work_fts USING fts5(
  title,
  title_normalized,
  synonyms,
  authors,
  content='corpus_work',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3 4'
);
`;

export async function runBuild(): Promise<StageReport> {
  const started = Date.now();
  const stage = 'build';
  const notes: string[] = [];

  const worksPath = cachePath('merge', 'works.jsonl');
  if (!existsSync(worksPath)) {
    return {
      stage,
      ok: false,
      counts: {},
      notes: ['no merged works — run the merge stage first'],
      seconds: 0,
    };
  }

  mkdirSync(OUT, { recursive: true });
  const dbPath = join(OUT, 'corpus.sqlite');
  // Rebuild from scratch every time. An incremental build would need a
  // reconciliation step whose only job is to undo a previous run's mistakes.
  for (const f of [dbPath, `${dbPath}-journal`, `${dbPath}-wal`]) {
    if (existsSync(f)) rmSync(f);
  }

  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA);

  const insertWork = db.prepare(`
    INSERT INTO corpus_work (id, title, title_normalized, synonyms, authors, format_hint,
      series_id, series_position, universe_id, cover_id, cover_source, publication_status,
      chapter_count, volume_count, year, popularity, external_ids, source)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insertSeries = db.prepare(
    `INSERT OR REPLACE INTO corpus_series (id, name, universe_id, total_entries, source) VALUES (?,?,?,?,?)`,
  );
  const insertUniverse = db.prepare(
    `INSERT OR REPLACE INTO corpus_universe (id, name, description, source) VALUES (?,?,?,?)`,
  );

  let works = 0;
  let series = 0;
  let universes = 0;
  let withSeries = 0;
  let withCover = 0;

  db.exec('BEGIN');
  try {
    for await (const w of readJsonl<CorpusWork>(worksPath)) {
      insertWork.run(
        w.id,
        w.title,
        w.title_normalized,
        w.synonyms ?? '',
        w.authors ?? '',
        w.format_hint,
        w.series_id,
        w.series_position,
        w.universe_id,
        w.cover_id,
        w.cover_source,
        w.publication_status,
        w.chapter_count,
        w.volume_count,
        w.year,
        w.popularity,
        w.external_ids ?? '{}',
        w.source,
      );
      works++;
      if (w.series_id) withSeries++;
      if (w.cover_id) withCover++;
      if (works % 50_000 === 0) {
        db.exec('COMMIT');
        db.exec('BEGIN');
      }
    }

    for await (const s of readJsonl<CorpusSeries>(cachePath('merge', 'series.jsonl'))) {
      insertSeries.run(s.id, s.name, s.universe_id, s.total_entries, s.source);
      series++;
    }
    for await (const u of readJsonl<CorpusUniverse>(cachePath('merge', 'universes.jsonl'))) {
      insertUniverse.run(u.id, u.name, u.description, u.source);
      universes++;
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    db.close();
    throw e;
  }

  // Built once at the end rather than kept in step with every insert: an
  // external-content FTS index is far cheaper to build in one pass.
  db.exec(`INSERT INTO corpus_work_fts(corpus_work_fts) VALUES('rebuild')`);
  db.exec('ANALYZE');
  db.exec('VACUUM');

  // A real query against the finished file. "It built" and "it answers" are
  // different claims, and only the second one is worth shipping.
  const probe = db
    .prepare(
      `SELECT w.title FROM corpus_work_fts f JOIN corpus_work w ON w.rowid = f.rowid
       WHERE corpus_work_fts MATCH ? ORDER BY rank LIMIT 3`,
    )
    .all('sol*') as { title: string }[];
  notes.push(
    `FTS probe "sol*" returned ${probe.length}: ${probe.map((p) => p.title).join(' / ') || 'nothing'}`,
  );

  db.close();

  const bytes = statSync(dbPath).size;
  const checksum = createHash('sha256').update(readFileSync(dbPath)).digest('hex');

  const manifest = {
    version: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
    builtAt: new Date().toISOString(),
    bytes,
    sha256: checksum,
    counts: { works, series, universes, withSeries, withCover },
  };
  writeAtomic(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));

  notes.push(`corpus.sqlite is ${human(bytes)} for ${n(works)} works`);
  notes.push(`${n(withSeries)} works carry a series link, ${n(withCover)} carry a cover id`);

  return {
    stage,
    ok: true,
    counts: { works, series, universes, withSeries, withCover, bytes },
    notes,
    seconds: (Date.now() - started) / 1000,
  };
}
