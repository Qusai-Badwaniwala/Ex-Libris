import { existsSync, renameSync, statSync } from 'node:fs';
import {
  JsonlWriter,
  cachePath,
  downloadResumable,
  human,
  n,
  prepareJsonlResume,
  readCheckpoint,
  readGzipLines,
  readJsonl,
  writeCheckpoint,
} from '../lib.ts';
import { normalizeOpenLibraryId, normalizeTitle, stableId } from '../normalize.ts';
import type { WikidataMembership } from './wikidata.ts';
import type { CorpusWork, StageReport } from '../types.ts';

/**
 * Open Library. Published books, under CC0.
 *
 * The dumps are large and the sizes below were measured against the live
 * server, not assumed:
 *
 *   ol_dump_works_latest.txt.gz      4.06 GB
 *   ol_dump_editions_latest.txt.gz  11.72 GB
 *   ol_dump_authors_latest.txt.gz    0.78 GB
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

/** Measured on the complete 2026-08-31 works dump: 473,503 rows. */
export const CORE_SUBJECT_MINIMUM = 4;

export function isFictionSubject(subject: string): boolean {
  const normalized = subject.normalize('NFKC').toLocaleLowerCase('en-US');
  if (/\bnon[\s-]?fiction\b/.test(normalized)) return false;
  return /\bfiction\b/.test(normalized);
}

export function qualifiesForOpenLibraryCore(
  subjects: readonly string[],
  inWikidataSeries: boolean,
): boolean {
  return (
    inWikidataSeries || (subjects.length >= CORE_SUBJECT_MINIMUM && subjects.some(isFictionSubject))
  );
}

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
  const stage = 'openlibrary-works';
  const notes: string[] = [];
  const src = dumpPath('works');

  if (!readCheckpoint('wikidata').done) {
    return {
      stage,
      ok: false,
      counts: { works: 0 },
      notes: [
        'Wikidata must be complete before filtering so explicitly linked series works remain in the compact core',
      ],
      seconds: 0,
    };
  }
  const wikidataSeriesWorks = new Set<string>();
  for await (const membership of readJsonl<WikidataMembership>(
    cachePath('wikidata', 'series.jsonl'),
  )) {
    const id = normalizeOpenLibraryId(membership.olid);
    if (id) wikidataSeriesWorks.add(id);
  }

  if (!existsSync(src)) {
    return {
      stage,
      ok: false,
      counts: { works: 0 },
      notes: [
        'no works dump on disk — run `node pipeline/run.ts acquire` after the owner approves the 4.84 GB works + authors download',
      ],
      seconds: 0,
    };
  }

  const cp = readCheckpoint(stage);
  const output = cachePath('openlibrary', 'works-keyed.jsonl');
  if (cp.done && existsSync(output)) {
    return { stage, ok: true, counts: cp.counts ?? {}, notes: ['already complete'], seconds: 0 };
  }

  const resume = prepareJsonlResume(output, cp.cursor);
  const resuming = resume.append;
  const prior = resuming ? (cp.counts ?? {}) : {};
  const out = new JsonlWriter(output, resuming);
  let seen = 0;
  let kept = prior['kept'] ?? 0;
  const dropped = {
    noTitle: prior['noTitle'] ?? 0,
    noAuthor: prior['noAuthor'] ?? 0,
    noCover: prior['noCover'] ?? 0,
    notEnglish: prior['notEnglish'] ?? 0,
    notCore: prior['notCore'] ?? 0,
  };
  let fictionQualified = prior['fictionQualified'] ?? 0;
  let wikidataQualified = prior['wikidataQualified'] ?? 0;
  let bothQualified = prior['bothQualified'] ?? 0;
  if (resuming) notes.push(`resuming after ${n(resume.position)} source rows`);

  try {
    for await (const line of readGzipLines(src)) {
      seen++;
      // Gzip cannot seek, so replay the source to the committed line without
      // parsing or counting it again. The paired output byte boundary above
      // removes any uncommitted tail before new rows are appended.
      if (seen <= resume.position) continue;
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
      const authorKeys = rec.authors?.map((a) => a.author?.key).filter(isString) ?? [];
      if (authorKeys.length === 0) {
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
      const subjects = rec.subjects ?? [];
      const fiction = subjects.length >= CORE_SUBJECT_MINIMUM && subjects.some(isFictionSubject);
      const inWikidataSeries = wikidataSeriesWorks.has(key.toUpperCase());
      if (!qualifiesForOpenLibraryCore(subjects, inWikidataSeries)) {
        dropped.notCore++;
        continue;
      }
      if (fiction) fictionQualified++;
      if (inWikidataSeries) wikidataQualified++;
      if (fiction && inWikidataSeries) bothQualified++;

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
          authorKeys,
          ...(subjects.length ? { subjects: subjects.slice(0, 12) } : {}),
        }),
        source: 'openlibrary',
      } satisfies CorpusWork);
      kept++;

      if (seen % 250_000 === 0) {
        await out.flush();
        const counts = {
          seen,
          kept,
          fictionQualified,
          wikidataQualified,
          bothQualified,
          ...dropped,
        };
        writeCheckpoint(stage, {
          done: false,
          cursor: { position: seen, outputBytes: out.writtenBytes },
          counts,
        });
        process.stdout.write(`\n      ${n(seen)} scanned, ${n(kept)} kept`);
      }
    }
  } finally {
    await out.close();
  }

  const counts = {
    seen,
    kept,
    fictionQualified,
    wikidataQualified,
    bothQualified,
    ...dropped,
  };
  writeCheckpoint(stage, {
    done: true,
    cursor: { position: seen, outputBytes: out.writtenBytes },
    counts,
  });

  notes.push(
    `${n(kept)} kept from ${n(seen)} works (${((kept / Math.max(seen, 1)) * 100).toFixed(1)}%)`,
  );
  notes.push(
    `core: ${n(fictionQualified)} data-rich fiction rows, ${n(wikidataQualified)} Wikidata-series rows, ${n(bothQualified)} in both`,
  );
  notes.push(
    `dropped: ${n(dropped.noTitle)} untitled, ${n(dropped.noAuthor)} authorless, ${n(dropped.noCover)} coverless, ${n(dropped.notEnglish)} explicitly non-English, ${n(dropped.notCore)} outside the compact-core rule`,
  );
  notes.push('author keys are staged; `openlibrary-authors` resolves them before merge');

  return { stage, ok: true, counts, notes, seconds: (Date.now() - started) / 1000 };
}

/**
 * Stage 2b. Open Library works refer to authors by key, so shipping the staged
 * rows directly would make author search silently useless. This pass keeps
 * only referenced author names, then streams the works into their final input.
 *
 * A gzip stream cannot seek. On interruption the checkpoint preserves every
 * matched author already written, while the next run replays lines up to the
 * last checkpoint before continuing. It never redownloads the dump.
 */
export async function runOpenLibraryAuthors(): Promise<StageReport> {
  const started = Date.now();
  const stage = 'openlibrary-authors';
  const source = dumpPath('authors');
  const keyedWorks = cachePath('openlibrary', 'works-keyed.jsonl');
  const authorRows = cachePath(stage, 'authors.jsonl');
  const finalWorks = cachePath('openlibrary', 'works.jsonl');

  if (!existsSync(source) || !existsSync(keyedWorks)) {
    return {
      stage,
      ok: false,
      counts: {},
      notes: [
        !existsSync(source)
          ? 'the Open Library authors dump is missing'
          : 'the keyed Open Library works are missing; run `openlibrary` first',
      ],
      seconds: 0,
    };
  }

  const cp = readCheckpoint(stage);
  if (cp.done && existsSync(finalWorks)) {
    return { stage, ok: true, counts: cp.counts ?? {}, notes: ['already complete'], seconds: 0 };
  }

  const wanted = new Set<string>();
  let stagedWorks = 0;
  for await (const work of readJsonl<CorpusWork>(keyedWorks)) {
    stagedWorks++;
    for (const key of authorKeys(work)) wanted.add(key);
  }
  if (stagedWorks === 0 || wanted.size === 0) {
    return {
      stage,
      ok: false,
      counts: { stagedWorks, wantedAuthors: wanted.size },
      notes: ['the Open Library works stage produced no resolvable author keys'],
      seconds: (Date.now() - started) / 1000,
    };
  }

  const names = new Map<string, string>();
  for await (const author of readJsonl<{ key: string; name: string }>(authorRows)) {
    names.set(author.key, author.name);
  }
  const resumeAt = existsSync(authorRows) && typeof cp.cursor === 'number' ? cp.cursor : 0;
  const out = new JsonlWriter(authorRows, resumeAt > 0);
  let seen = 0;
  try {
    for await (const line of readGzipLines(source)) {
      seen++;
      if (seen <= resumeAt) continue;
      const tab = line.lastIndexOf('\t');
      if (tab < 0) continue;
      let record: OlAuthor;
      try {
        record = JSON.parse(line.slice(tab + 1)) as OlAuthor;
      } catch {
        continue;
      }
      const key = record.key;
      const name = record.name?.trim() || record.personal_name?.trim();
      if (key && name && wanted.has(key) && !names.has(key)) {
        names.set(key, name);
        out.write({ key, name });
      }
      if (seen % 250_000 === 0) {
        await out.flush();
        writeCheckpoint(stage, {
          done: false,
          cursor: seen,
          counts: { stagedWorks, wantedAuthors: wanted.size, resolvedAuthors: names.size },
        });
        process.stdout.write(`\n      ${n(seen)} authors scanned, ${n(names.size)} matched`);
      }
    }
  } finally {
    await out.close();
  }

  const resolving = cachePath('openlibrary', 'works.resolving.jsonl');
  const resolved = new JsonlWriter(resolving);
  let kept = 0;
  let unresolvedWorks = 0;
  let partiallyResolved = 0;
  try {
    for await (const work of readJsonl<CorpusWork>(keyedWorks)) {
      const joined = resolveOpenLibraryAuthorNames(work, names);
      if (!joined) {
        unresolvedWorks++;
        continue;
      }
      if (joined.partial) partiallyResolved++;
      resolved.write({ ...work, authors: joined.authors } satisfies CorpusWork);
      kept++;
    }
  } finally {
    await resolved.close();
  }
  if (kept === 0) {
    return {
      stage,
      ok: false,
      counts: { stagedWorks, wantedAuthors: wanted.size, resolvedAuthors: names.size },
      notes: ['no work retained an author name after the Open Library join'],
      seconds: (Date.now() - started) / 1000,
    };
  }
  renameSync(resolving, finalWorks);

  const counts = {
    stagedWorks,
    kept,
    wantedAuthors: wanted.size,
    resolvedAuthors: names.size,
    unresolvedWorks,
    partiallyResolved,
  };
  writeCheckpoint(stage, { done: true, cursor: seen, counts });
  return {
    stage,
    ok: true,
    counts,
    notes: [
      `${n(kept)} works now carry resolved author names`,
      `${n(unresolvedWorks)} works were omitted because none of their author keys resolved`,
      `${n(partiallyResolved)} retained works had at least one unresolved co-author`,
    ],
    seconds: (Date.now() - started) / 1000,
  };
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

interface OlAuthor {
  key?: string;
  name?: string;
  personal_name?: string;
}

const isString = (value: string | undefined): value is string =>
  typeof value === 'string' && value.length > 0;

function authorKeys(work: CorpusWork): string[] {
  try {
    const external = JSON.parse(work.external_ids) as { authorKeys?: unknown };
    return Array.isArray(external.authorKeys)
      ? external.authorKeys.filter((key): key is string => typeof key === 'string')
      : [];
  } catch {
    return [];
  }
}

export function resolveOpenLibraryAuthorNames(
  work: CorpusWork,
  names: ReadonlyMap<string, string>,
): { authors: string; partial: boolean } | null {
  const keys = authorKeys(work);
  const authors = keys.map((key) => names.get(key)).filter(isString);
  return authors.length === 0
    ? null
    : { authors: authors.join(', '), partial: authors.length < keys.length };
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
