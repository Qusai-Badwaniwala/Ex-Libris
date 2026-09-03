import {
  JsonlWriter,
  cachePath,
  fetchRetry,
  n,
  readCheckpoint,
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
 * Scoped to written works — literary work, book, novel, light novel, manhwa,
 * manga, web serial — rather than everything with a P179, which would also
 * bring back television seasons, video games and comic strips.
 */
const QUERY = (limit: number, offset: number) => `
SELECT ?work ?workLabel ?series ?seriesLabel ?ordinal ?olid WHERE {
  ?work wdt:P179 ?series .
  ?work wdt:P31/wdt:P279* ?kind .
  VALUES ?kind { wd:Q7725634 wd:Q571 wd:Q8261 wd:Q747381 wd:Q21198342 wd:Q1004 wd:Q725377 }
  OPTIONAL { ?work p:P179 [ ps:P179 ?series ; pq:P1545 ?ordinal ] }
  OPTIONAL { ?work wdt:P648 ?olid }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?work
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

  if (cp.done) {
    return { stage, ok: true, counts: cp.counts ?? {}, notes: ['already complete'], seconds: 0 };
  }

  const startPage = typeof cp.cursor === 'number' ? cp.cursor + 1 : 0;
  const out = new JsonlWriter(cachePath(stage, 'series.jsonl'), startPage > 0);
  if (startPage > 0) notes.push(`resumed at page ${startPage}`);

  let page = startPage;
  let withOrdinal = 0;
  let withOlid = 0;
  const seriesSeen = new Set<string>();

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
        break;
      }

      const json = (await res.json()) as {
        results?: { bindings?: Record<string, { value: string }>[] };
      };
      const rows = json.results?.bindings ?? [];
      if (rows.length === 0) {
        notes.push(`source exhausted at page ${page}`);
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

      writeCheckpoint(stage, {
        done: false,
        cursor: page,
        counts: { pages: page + 1, memberships: out.written },
      });
      // The query service is a shared free resource with no key. One request
      // per second is well inside what it asks for.
      await sleep(1200);
    }
  } finally {
    await out.close();
  }

  const counts = {
    pages: page - startPage,
    memberships: out.written,
    series: seriesSeen.size,
    withOrdinal,
    withOpenLibraryId: withOlid,
  };
  writeCheckpoint(stage, { done: page >= maxPages, cursor: page, counts });

  const joinRate = out.written === 0 ? 0 : (withOlid / out.written) * 100;
  notes.push(`${n(out.written)} memberships across ${n(seriesSeen.size)} series`);
  notes.push(`${n(withOrdinal)} carry an explicit ordinal (P1545)`);
  notes.push(
    `Open Library join rate: ${joinRate.toFixed(1)}% — this is the number that predicts whether series detection feels good`,
  );

  return { stage, ok: true, counts, notes, seconds: (Date.now() - started) / 1000 };
}

const qid = (uri: string) => uri.replace('http://www.wikidata.org/entity/', '');
