import { existsSync } from 'node:fs';
import { JsonlWriter, cachePath, n, readCheckpoint, readJsonl } from './lib.ts';
import { couldBeSameWork, matchKey, mergeWork, normalizeOpenLibraryId } from './normalize.ts';
import type { AniRelation } from './sources/anilist.ts';
import type { WikidataMembership } from './sources/wikidata.ts';
import type { CorpusSeries, CorpusUniverse, CorpusWork, StageReport } from './types.ts';

/**
 * Stages 6 and 7: normalise and merge across sources, then derive series and
 * universes.
 *
 * The merge is by `matchKey` — a lossy title-plus-author key — and it is
 * deliberately conservative. Two records collapse into one only when the title
 * AND the author agree after folding. Merging two works that are actually
 * different is invisible and permanent; failing to merge two that are the same
 * shows up as a duplicate in the search results, which the reader can see and
 * report. The visible failure is the better one.
 */

export interface MergeOptions {
  /** Restricted API rows are only for the explicit local engineering fixture. */
  includeRestricted?: boolean;
  /** Production merge refuses a bounded or interrupted Wikidata pull. */
  requireCompleteWikidata?: boolean;
}

export function mergeInputPaths(includeRestricted = false): string[] {
  return includeRestricted
    ? [cachePath('anilist', 'works.jsonl'), cachePath('mangadex', 'works.jsonl')]
    : [cachePath('openlibrary', 'works.jsonl')];
}

export async function runMerge(options: MergeOptions = {}): Promise<StageReport> {
  const started = Date.now();
  const notes: string[] = [];
  const includeRestricted = options.includeRestricted ?? false;
  const stage = includeRestricted ? 'fixture-merge' : 'merge';
  const requireCompleteWikidata = options.requireCompleteWikidata ?? !includeRestricted;

  const inputs = mergeInputPaths(includeRestricted);
  const openLibraryWorks = cachePath('openlibrary', 'works.jsonl');
  if (!includeRestricted && !existsSync(openLibraryWorks)) {
    return {
      stage,
      ok: false,
      counts: {},
      notes: ['resolved Open Library works are missing; run both Open Library stages first'],
      seconds: 0,
    };
  }
  if (requireCompleteWikidata && !readCheckpoint('wikidata').done) {
    return {
      stage,
      ok: false,
      counts: {},
      notes: ['Wikidata is incomplete or was page-bounded; resume it before a production merge'],
      seconds: 0,
    };
  }
  notes.push(
    includeRestricted
      ? 'engineering fixture: AniList and MangaDex cache rows only'
      : 'production merge: Open Library rows only; restricted API caches were ignored',
  );

  const byKey = new Map<string, CorpusWork>();
  const perSource: Record<string, number> = {};
  let read = 0;
  let merged = 0;

  for (const path of inputs) {
    for await (const w of readJsonl<CorpusWork>(path)) {
      read++;
      perSource[w.source] = (perSource[w.source] ?? 0) + 1;

      // An author-less record must not collapse into an author-less record of
      // a different work that happens to share a title. Those stay separate.
      const key = w.authors ? matchKey(w.title, w.authors.split(',')[0]) : `${w.id}`;
      const existing = byKey.get(key);
      if (existing) {
        byKey.set(key, mergeWork(existing, w));
        merged++;
      } else {
        byKey.set(key, w);
      }
    }
  }

  if (read === 0) {
    return { stage, ok: false, counts: {}, notes: ['no source rows to merge'], seconds: 0 };
  }

  /* ── second pass: same title, different source ────────────────────────── */

  // The first pass needs title AND author to agree, and across sources the
  // author almost never does — AniList reads a "Story" staff credit, MangaDex
  // an author relationship, and the two romanise names differently. Measured on
  // a 4,000-row sample that left 256 duplicate title groups, 6.5% of the
  // corpus, all of them visible to the reader as a doubled search result.
  //
  // So titles are grouped a second time. A group only collapses when it holds
  // exactly one record per source — a group with two AniList rows is two real
  // works, and which one the MangaDex row belongs to is unknowable, so it is
  // left alone rather than guessed at.
  const byTitle = new Map<string, CorpusWork[]>();
  for (const w of byKey.values()) {
    const list = byTitle.get(w.title_normalized) ?? [];
    list.push(w);
    byTitle.set(w.title_normalized, list);
  }

  let crossMerged = 0;
  let ambiguous = 0;
  for (const [, group] of byTitle) {
    if (group.length < 2) continue;
    const sources = new Set(group.map((g) => g.source));
    if (sources.size !== group.length) {
      // Two rows from one source: genuinely two works sharing a title.
      ambiguous++;
      continue;
    }
    let acc = group[0]!;
    let ok = true;
    for (const other of group.slice(1)) {
      if (!couldBeSameWork(acc, other)) {
        ok = false;
        break;
      }
      acc = mergeWork(acc, other);
    }
    if (!ok) {
      ambiguous++;
      continue;
    }
    for (const g of group) {
      const k = g.authors ? matchKey(g.title, g.authors.split(',')[0]) : `${g.id}`;
      byKey.delete(k);
    }
    byKey.set(`title:${acc.title_normalized}`, acc);
    crossMerged += group.length - 1;
  }

  /* ── derive series from AniList relations ─────────────────────────────── */

  const byAnilistId = new Map<number, CorpusWork>();
  for (const w of byKey.values()) {
    const id = readAnilistId(w);
    if (id !== null) byAnilistId.set(id, w);
  }

  // Union-find over PREQUEL/SEQUEL/SIDE_STORY/PARENT edges. Anything
  // transitively connected is one series — which is what those relations mean.
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    let r = x;
    while (parent.get(r) !== undefined && parent.get(r) !== r) r = parent.get(r)!;
    return r;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  let edges = 0;
  if (includeRestricted) {
    for await (const rel of readJsonl<AniRelation>(cachePath('anilist', 'relations.jsonl'))) {
      if (!byAnilistId.has(rel.from) || !byAnilistId.has(rel.to)) continue;
      if (!parent.has(rel.from)) parent.set(rel.from, rel.from);
      if (!parent.has(rel.to)) parent.set(rel.to, rel.to);
      union(rel.from, rel.to);
      edges++;
    }
  }

  const clusters = new Map<number, number[]>();
  for (const id of parent.keys()) {
    const root = find(id);
    const list = clusters.get(root) ?? [];
    list.push(id);
    clusters.set(root, list);
  }

  const series: CorpusSeries[] = [];
  for (const [root, members] of clusters) {
    // A cluster of one is not a series. Emitting it would give every standalone
    // work a series page with itself in it.
    if (members.length < 2) continue;

    const works = members.map((m) => byAnilistId.get(m)!).filter(Boolean);
    if (works.length < 2) continue;

    // Named after the most popular member, which is the entry a reader is most
    // likely to recognise the set by.
    const lead = works.reduce((a, b) => (b.popularity > a.popularity ? b : a));
    const id = `series:anilist:${root}`;
    series.push({
      id,
      name: lead.title,
      universe_id: null,
      // The cluster is what THIS corpus knows, which is not the same as what
      // exists. Claiming it as the total would put a wrong denominator under a
      // completion ring, so the count stays null until a source states it.
      total_entries: null,
      source: 'anilist',
    });

    // Ordered by year, then popularity: enough for a stable list, and
    // deliberately not presented as a reading order, which needs Wikidata's
    // P1545 ordinal to state honestly.
    works.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || b.popularity - a.popularity);
    works.forEach((w, i) => {
      w.series_id = id;
      w.series_position = i + 1;
    });
  }
  const anilistSeries = series.length;

  /* ── attach explicit Wikidata series memberships ──────────────────────── */

  const byOpenLibraryId = new Map<string, CorpusWork>();
  const workById = new Map<string, CorpusWork>();
  for (const work of byKey.values()) {
    workById.set(work.id, work);
    const id = readOpenLibraryId(work);
    if (id) byOpenLibraryId.set(id, work);
  }
  const memberships = new Map<string, WikidataMembership[]>();
  let wikidataRows = 0;
  for await (const membership of readJsonl<WikidataMembership>(
    cachePath('wikidata', 'series.jsonl'),
  )) {
    wikidataRows++;
    const openLibraryId = normalizeOpenLibraryId(membership.olid);
    const work = openLibraryId ? byOpenLibraryId.get(openLibraryId) : undefined;
    if (!work) continue;
    const group = memberships.get(work.id) ?? [];
    group.push(membership);
    memberships.set(work.id, group);
  }

  const seriesById = new Map(series.map((entry) => [entry.id, entry]));
  let wikidataJoined = 0;
  let wikidataAmbiguous = 0;
  for (const [workId, candidates] of memberships) {
    const seriesIds = new Set(candidates.map((candidate) => candidate.series));
    if (seriesIds.size !== 1) {
      // P179 can describe several overlapping groupings. The runtime schema
      // has one series slot, so choosing here would silently discard context.
      wikidataAmbiguous++;
      continue;
    }
    const work = workById.get(workId);
    if (!work) continue;
    const chosen = candidates[0]!;
    const explicitPositions = [
      ...new Set(
        candidates
          .map((candidate) => candidate.ordinal)
          .filter((value): value is number => value !== null),
      ),
    ];
    const seriesId = `series:wikidata:${chosen.series}`;
    work.series_id = seriesId;
    work.series_position = explicitPositions.length === 1 ? explicitPositions[0]! : null;
    work.external_ids = JSON.stringify({
      ...readExternalIds(work),
      wikidata: chosen.work,
      wikidataSeries: chosen.series,
    });
    if (!seriesById.has(seriesId)) {
      const entry: CorpusSeries = {
        id: seriesId,
        name: chosen.seriesLabel.trim() || chosen.series,
        universe_id: null,
        // Membership rows state inclusion and sometimes order, not the full
        // number of entries. A partial count must never power a completion ring.
        total_entries: null,
        source: 'wikidata',
      };
      series.push(entry);
      seriesById.set(seriesId, entry);
    }
    wikidataJoined++;
  }

  /* ── universes ────────────────────────────────────────────────────────── */

  // Left empty on purpose. A universe is a claim that several SERIES share a
  // continuity, and nothing in AniList or MangaDex states that — only Wikidata
  // does, through P179 chains. Inventing them from relation clusters would put
  // confident wrong groupings in front of the reader, which is the one thing
  // the series cascade is written to avoid.
  const universes: CorpusUniverse[] = [];
  notes.push(
    'universes remain empty: the Wikidata pull states work-to-series membership, not shared continuity',
  );

  /* ── write ────────────────────────────────────────────────────────────── */

  const worksOut = new JsonlWriter(cachePath(stage, 'works.jsonl'));
  for (const w of byKey.values()) worksOut.write(w);
  const workCount = await worksOut.close();

  const seriesOut = new JsonlWriter(cachePath(stage, 'series.jsonl'));
  for (const s of series) seriesOut.write(s);
  await seriesOut.close();

  const uniOut = new JsonlWriter(cachePath(stage, 'universes.jsonl'));
  for (const u of universes) uniOut.write(u);
  await uniOut.close();

  const inSeries = [...byKey.values()].filter((w) => w.series_id).length;

  notes.push(
    `read ${n(read)} rows (${Object.entries(perSource)
      .map(([s, c]) => `${s} ${n(c)}`)
      .join(', ')})`,
  );
  notes.push(
    `${n(merged)} collapsed on title+author, ${n(crossMerged)} more on title across sources, leaving ${n(workCount)}`,
  );
  notes.push(`${n(ambiguous)} same-title groups left alone as genuinely different works`);
  notes.push(`${n(edges)} usable AniList relations produced ${n(anilistSeries)} fixture series`);
  notes.push(
    `${n(wikidataJoined)} Open Library works joined to Wikidata series from ${n(wikidataRows)} membership rows; ${n(wikidataAmbiguous)} multi-series cases left unassigned`,
  );

  return {
    stage,
    ok: true,
    counts: {
      read,
      output: workCount,
      merged,
      crossMerged,
      ambiguous,
      series: series.length,
      universes: universes.length,
      worksInSeries: inSeries,
      wikidataRows,
      wikidataJoined,
      wikidataAmbiguous,
    },
    notes,
    seconds: (Date.now() - started) / 1000,
  };
}

function readAnilistId(w: CorpusWork): number | null {
  try {
    const ids = JSON.parse(w.external_ids || '{}') as { anilist?: number };
    return typeof ids.anilist === 'number' ? ids.anilist : null;
  } catch {
    return null;
  }
}

function readExternalIds(work: CorpusWork): Record<string, unknown> {
  try {
    const value = JSON.parse(work.external_ids || '{}') as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function readOpenLibraryId(work: CorpusWork): string | null {
  const value = readExternalIds(work)['openLibraryWork'];
  return typeof value === 'string' ? normalizeOpenLibraryId(value) : null;
}

export { normalizeOpenLibraryId } from './normalize.ts';
