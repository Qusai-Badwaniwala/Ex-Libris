import { existsSync } from 'node:fs';
import {
  JsonlWriter,
  cachePath,
  fetchRetry,
  n,
  prepareJsonlResume,
  readCheckpoint,
  readJsonl,
  sleep,
  writeCheckpoint,
} from '../lib.ts';
import type { StageReport } from '../types.ts';

/**
 * Wikidata. The important one.
 *
 * It is the only free structured source that states "this work is entry N of
 * series S" as DATA rather than as a string to be parsed out of a title. Series
 * resolution quality lives or dies on how well this is exploited — the brief is
 * explicit about that, and the join rate below is the number that predicts
 * whether series detection will feel good.
 *
 * The Query Service has a hard 60-second timeout, so this cannot be one query.
 * It pages with LIMIT/OFFSET, checkpoints every page, and backs off when the
 * service says to. A full pull is tens of pages and takes a while; it is
 * resumable precisely because of that.
 */

const ENDPOINT = 'https://query.wikidata.org/sparql';
const PAGE = 2000;

/**
 * P179 is "part of the series", P1545 the ordinal within it.
 *
 * Production merge currently joins only through P648 Open Library work ids.
 * Requiring that identifier here avoids asking the shared query service to
 * enumerate a much larger set of unjoinable television, game and comic-strip
 * series rows. `normalizeOpenLibraryId` remains the final type boundary.
 */
const QUERY = (limit: number, offset: number) => `
SELECT ?work ?workLabel ?series ?seriesLabel ?ordinal ?olid WHERE {
  ?work wdt:P179 ?series ;
        wdt:P648 ?olid .
  OPTIONAL { ?work p:P179 [ ps:P179 ?series ; pq:P1545 ?ordinal ] }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?work ?series
LIMIT ${limit} OFFSET ${offset}`;

export interface WikidataMembership {
  work: string;
  workLabel: string;
  series: string;
  seriesLabel: string;
  ordinal: number | null;
  /** Open Library id (P648) — the join key back to the OL rows. */
  olid: string | null;
}

export async function runWikidata(maxPages = 30): Promise<StageReport> {
  const started = Date.now();
  const stage = 'wikidata';
  const notes: string[] = [];
  const cp = readCheckpoint(stage);
  const output = cachePath(stage, 'series.jsonl');

  if (cp.done && existsSync(output)) {
    return { stage, ok: true, counts: cp.counts ?? {}, notes: ['already complete'], seconds: 0 };
  }

  const resume = prepareJsonlResume(output, cp.cursor);
  const startPage = resume.append ? resume.position + 1 : 0;
  const existingRows: WikidataMembership[] = [];
  if (startPage > 0) {
    for await (const row of readJsonl<WikidataMembership>(output)) {
      existingRows.push(row);
    }
  }
  const out = new JsonlWriter(output, resume.append);
  if (startPage > 0) notes.push(`resumed at page ${startPage}`);

  let page = startPage;
  let lastCompleted = startPage - 1;
  let exhausted = false;
  let stoppedStatus: number | null = null;
  let withOrdinal = existingRows.filter((row) => row.ordinal !== null).length;
  let withOlid = existingRows.filter((row) => row.olid !== null).length;
  const seriesSeen = new Set(existingRows.map((row) => row.series));

  try {
    for (; page < maxPages; page++) {
      const url = `${ENDPOINT}?query=${encodeURIComponent(QUERY(PAGE, page * PAGE))}&format=json`;
      const res = await fetchRetry(url, {
        headers: { accept: 'application/sparql-results+json' },
        retries: 3,
      });

      if (!res.ok) {
        // A timeout here is normal at depth and is not a failure of the run:
        // what has already been written is still usable.
        notes.push(`stopped at page ${page}: HTTP ${res.status} (query service timeout is common)`);
        stoppedStatus = res.status;
        break;
      }

      const json = (await res.json()) as {
        results?: { bindings?: Record<string, { value: string }>[] };
      };
      const rows = json.results?.bindings ?? [];
      if (rows.length === 0) {
        notes.push(`source exhausted at page ${page}`);
        exhausted = true;
        break;
      }

      for (const r of rows) {
        const work = r['work']?.value;
        const series = r['series']?.value;
        if (!work || !series) continue;
        const ordRaw = r['ordinal']?.value;
        const ordinal = ordRaw !== undefined && /^\d+$/.test(ordRaw) ? Number(ordRaw) : null;
        if (ordinal !== null) withOrdinal++;
        const olid = r['olid']?.value ?? null;
        if (olid) withOlid++;
        seriesSeen.add(series);

        out.write({
          work: qid(work),
          workLabel: r['workLabel']?.value ?? '',
          series: qid(series),
          seriesLabel: r['seriesLabel']?.value ?? '',
          ordinal,
          olid,
        } satisfies WikidataMembership);
      }

      await out.flush();
      writeCheckpoint(stage, {
        done: false,
        cursor: { position: page, outputBytes: out.writtenBytes },
        counts: { pages: page + 1, memberships: existingRows.length + out.written },
      });
      lastCompleted = page;
      // The query service is a shared free resource with no key. One request
      // per second is well inside what it asks for.
      await sleep(1200);
    }
  } finally {
    await out.close();
  }

  const counts = {
    pages: lastCompleted + 1,
    memberships: existingRows.length + out.written,
    series: seriesSeen.size,
    withOrdinal,
    withOpenLibraryId: withOlid,
  };
  writeCheckpoint(stage, {
    done: exhausted,
    cursor: { position: lastCompleted, outputBytes: out.writtenBytes },
    counts,
  });

  notes.push(`${n(counts.memberships)} memberships across ${n(seriesSeen.size)} series`);
  notes.push(`${n(withOrdinal)} carry an explicit ordinal (P1545)`);
  notes.push(
    `${n(withOlid)} carry a P648 Open Library identifier; retained-work join rate is reported by merge`,
  );
  if (!exhausted && page >= maxPages) {
    notes.push(
      `page budget ${n(maxPages)} reached before exhaustion; rerun with a larger --pages value before production merge`,
    );
  }

  if (stoppedStatus !== null) {
    notes.push(
      `source extraction remains incomplete after HTTP ${stoppedStatus}; rerun resumes safely`,
    );
  }

  return { stage, ok: exhausted, counts, notes, seconds: (Date.now() - started) / 1000 };
}

const qid = (uri: string) => uri.replace('http://www.wikidata.org/entity/', '');
