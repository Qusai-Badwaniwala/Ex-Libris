import { existsSync, statSync } from 'node:fs';
import {
  JsonlWriter,
  cachePath,
  downloadResumable,
  human,
  n,
  readCheckpoint,
  readGzipLines,
  writeCheckpoint,
} from '../lib.ts';
import { normalizeTitle, stableId } from '../normalize.ts';
import type { CorpusWork, StageReport } from '../types.ts';

/**
 * Open Library. Published books, under CC0.
 *
 * The dumps are large and the sizes below were measured against the live
 * server, not assumed:
 *
 *   ol_dump_works_latest.txt.gz      3.78 GB
 *   ol_dump_editions_latest.txt.gz  11.72 GB
 *   ol_dump_authors_latest.txt.gz    0.73 GB
 *
 * Sixteen gigabytes compressed, and well over a hundred decompressed. So
 * `acquire` is never part of `all` — it has to be asked for by name — and both
 * stages stream. Nothing here ever holds a dump in memory.
 */

const DUMPS = {
  works: 'https://openlibrary.org/data/ol_dump_works_latest.txt.gz',
  editions: 'https://openlibrary.org/data/ol_dump_editions_latest.txt.gz',
  authors: 'https://openlibrary.org/data/ol_dump_authors_latest.txt.gz',
} as const;

export function dumpPath(which: keyof typeof DUMPS): string {
  return cachePath('openlibrary', `ol_dump_${which}.txt.gz`);
}

/** Stage 1. Resumable: a dropped connection eleven gigabytes in costs the
 *  remainder, not the whole file. */
export async function acquireOpenLibrary(force: boolean): Promise<StageReport> {
  const started = Date.now();
  const notes: string[] = [];
  const counts: Record<string, number> = {};

  for (const [which, url] of Object.entries(DUMPS) as [keyof typeof DUMPS, string][]) {
    // Editions is 11.7 GB and nothing in the current filter predicate reads it.
    // Downloading it "for later" is three hours for a file no stage opens.
    if (which === 'editions' && !force) {
      notes.push(
        'skipped editions (11.7 GB, unused by the current filter) — pass --force to fetch it',
      );
      continue;
    }
    const dest = dumpPath(which);
    let last = 0;
    const { bytes, resumed } = await downloadResumable(url, dest, (got, total) => {
      const pct = total ? Math.floor((got / total) * 100) : 0;
      if (pct >= last + 5) {
        last = pct;
        process.stdout.write(`\n      ${which} ${pct}% (${human(got)})`);
      }
    });
    counts[`${which}Bytes`] = bytes;
    notes.push(`${which}: ${human(bytes)}${resumed ? ' (already complete)' : ''}`);
  }

  return { stage: 'acquire', ok: true, counts, notes, seconds: (Date.now() - started) / 1000 };
}

/**
 * Stage 2. Streams the works dump and cuts ~40 million rows to a shippable
 * core.
 *
 * The predicate is the brief's, minus one clause: `edition_count >= 2` is not
 * in the works dump at all — it can only be computed by streaming the 11.7 GB
 * editions dump and counting. That pass is worth doing once the owner has seen
 * what this filter alone produces, and not before. The count is reported so the
 * decision is made against a number rather than a guess.
 */
export async function runOpenLibrary(): Promise<StageReport> {
  const started = Date.now();
  const stage = 'openlibrary';
  const notes: string[] = [];
  const src = dumpPath('works');

  if (!existsSync(src)) {
    return {
      stage,
      ok: true,
      counts: { works: 0 },
      notes: [
        'no works dump on disk — run `node pipeline/run.ts acquire` first (3.78 GB)',
        'skipped rather than failed: the other sources build a usable corpus without it',
      ],
      seconds: 0,
    };
  }

  const cp = readCheckpoint(stage);
  if (cp.done) {
    return { stage, ok: true, counts: cp.counts ?? {}, notes: ['already complete'], seconds: 0 };
  }

  const out = new JsonlWriter(cachePath(stage, 'works.jsonl'));
  let seen = 0;
  let kept = 0;
  const dropped = { noTitle: 0, noAuthor: 0, noCover: 0, notEnglish: 0 };

  try {
    for await (const line of readGzipLines(src)) {
      seen++;
      // The dump is TSV: type, key, revision, last_modified, JSON.
      const tab = line.lastIndexOf('\t');
      if (tab < 0) continue;
      let rec: OlWork;
      try {
        rec = JSON.parse(line.slice(tab + 1)) as OlWork;
      } catch {
        continue;
      }

      if (!rec.title?.trim()) {
        dropped.noTitle++;
        continue;
      }
      if (!rec.authors?.length) {
        dropped.noAuthor++;
        continue;
      }
      // No cover means a colour block forever, and half a million of those is
      // not an index worth 150 MB of a phone.
      const cover = rec.covers?.find((c) => typeof c === 'number' && c > 0);
      if (!cover) {
        dropped.noCover++;
        continue;
      }
      if (rec.languages?.length && !rec.languages.some((l) => /eng/.test(l.key ?? ''))) {
        dropped.notEnglish++;
        continue;
      }

      const key = (rec.key ?? '').replace('/works/', '');
      if (!key) continue;

      out.write({
        id: stableId('openlibrary', key),
        title: rec.title.trim(),
        title_normalized: normalizeTitle(rec.title),
        synonyms: (rec.subtitle ?? '').trim(),
        // Author KEYS only. Resolving them to names needs the authors dump,
        // which is stage 2b; writing the key now means the join can happen
        // later without re-streaming 3.8 GB.
        authors: '',
        format_hint: 'book',
        series_id: null,
        series_position: null,
        universe_id: null,
        cover_id: String(cover),
        cover_source: 'openlibrary',
        publication_status: 'complete',
        chapter_count: null,
        volume_count: null,
        year: firstYear(rec.first_publish_date),
        popularity: 0,
        external_ids: JSON.stringify({
          openLibraryWork: key,
          authorKeys: rec.authors.map((a) => a.author?.key).filter(Boolean),
          ...(rec.subjects?.length ? { subjects: rec.subjects.slice(0, 12) } : {}),
        }),
        source: 'openlibrary',
      } satisfies CorpusWork);
      kept++;

      if (seen % 250_000 === 0) {
        writeCheckpoint(stage, { done: false, cursor: seen, counts: { seen, kept } });
        process.stdout.write(`\n      ${n(seen)} scanned, ${n(kept)} kept`);
      }
    }
  } finally {
    await out.close();
  }

  const counts = { seen, kept, ...dropped };
  writeCheckpoint(stage, { done: true, cursor: seen, counts });

  notes.push(
    `${n(kept)} kept from ${n(seen)} works (${((kept / Math.max(seen, 1)) * 100).toFixed(1)}%)`,
  );
  notes.push(
    `dropped: ${n(dropped.noTitle)} untitled, ${n(dropped.noAuthor)} authorless, ${n(dropped.noCover)} coverless, ${n(dropped.notEnglish)} non-English`,
  );
  notes.push('author names still need the authors dump joined in — external_ids carries the keys');

  return { stage, ok: true, counts, notes, seconds: (Date.now() - started) / 1000 };
}

interface OlWork {
  key?: string;
  title?: string;
  subtitle?: string;
  covers?: number[];
  authors?: { author?: { key?: string } }[];
  languages?: { key?: string }[];
  subjects?: string[];
  first_publish_date?: string;
}

function firstYear(s: string | undefined): number | null {
  if (!s) return null;
  const m = /\b(1[0-9]{3}|20[0-9]{2})\b/.exec(s);
  return m ? Number(m[1]) : null;
}

/** Reports what is on disk without downloading anything. */
export function dumpStatus(): { which: string; bytes: number }[] {
  return (Object.keys(DUMPS) as (keyof typeof DUMPS)[]).map((which) => {
    const p = dumpPath(which);
    return { which, bytes: existsSync(p) ? statSync(p).size : 0 };
  });
}
