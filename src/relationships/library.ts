import { db } from '../db/db';
import type { Series, Universe, Work } from '../db/schema';

/** One interpretation for every library surface. Legacy conflicts remain visible. */
export function membership(work: Work, series: Series | undefined) {
  const inherited = series?.universeId;
  const conflict = !!(series && work.universeId && work.universeId !== inherited);
  return { universeId: series ? inherited : work.universeId, conflict };
}

export function sequence(a: Work, b: Work) {
  return (
    (a.seriesPosition ?? Infinity) - (b.seriesPosition ?? Infinity) ||
    a.sortTitle.localeCompare(b.sortTitle)
  );
}

/** Detect organisation changes independently of reading progress in another tab. */
export function organisationRevision(works: Work[], series: Series[], worlds: Universe[]) {
  return JSON.stringify([
    works.map((w) => [w.id, w.seriesId, w.seriesPosition, w.universeId, w.deletedAt]),
    series.map((s) => [s.id, s.name, s.universeId]),
    worlds.map((w) => [w.id, w.name, w.readingOrderNote]),
  ]);
}

export async function readRelationships() {
  const [works, series, worlds, authors, orders, entries] = await db.transaction(
    'r',
    [db.work, db.series, db.universe, db.author, db.readingOrder, db.readingOrderEntry],
    () =>
      Promise.all([
        db.work.toArray(),
        db.series.toArray(),
        db.universe.toArray(),
        db.author.toArray(),
        db.readingOrder.toArray(),
        db.readingOrderEntry.toArray(),
      ]),
  );
  const seriesById = new Map(series.map((row) => [row.id, row]));
  const worldsById = new Map(worlds.map((row) => [row.id, row]));
  const authorById = new Map(authors.map((row) => [row.id, row.name]));
  const active = works.filter((work) => !work.deletedAt);
  return {
    revision: organisationRevision(works, series, worlds),
    works: active,
    deletedWorks: works.filter((work) => !!work.deletedAt),
    series,
    worlds,
    seriesById,
    worldsById,
    orders,
    entries,
    authorLine: (work: Work) =>
      work.authorIds
        .map((id) => authorById.get(id))
        .filter(Boolean)
        .join(', '),
    seriesWorks: (id: string) => active.filter((work) => work.seriesId === id).sort(sequence),
    worldWorks: (id: string) =>
      active.filter(
        (work) => membership(work, seriesById.get(work.seriesId ?? '')).universeId === id,
      ),
    relation: (work: Work) => {
      const group = seriesById.get(work.seriesId ?? '');
      const resolved = membership(work, group);
      return {
        series: group,
        universe: worldsById.get(resolved.universeId ?? ''),
        conflict: resolved.conflict,
      };
    },
  };
}

export interface CodexSection {
  id: string;
  name: string;
  world?: Universe;
  series?: Series;
  works: Work[];
  total: number;
}

export function codexSections(
  works: Work[],
  allWorks: Work[],
  series: Series[],
  worlds: Universe[],
): CodexSection[] {
  const bySeries = new Map(series.map((row) => [row.id, row]));
  const byWorld = new Map(worlds.map((row) => [row.id, row]));
  const sections = new Map<string, CodexSection>();
  const names = {
    book: 'Independent books',
    novel: 'Independent novels',
    manhwa: 'Independent manhwa',
  };
  const keyFor = (work: Work) =>
    work.seriesId && bySeries.has(work.seriesId)
      ? `series:${work.seriesId}`
      : `standalone:${work.universeId ?? ''}:${work.format}`;
  const totals = new Map<string, number>();
  for (const work of allWorks) {
    if (work.deletedAt || work.status === 'wishlist') continue;
    const key = keyFor(work);
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }
  for (const work of works) {
    if (work.deletedAt || work.status === 'wishlist') continue;
    const group = bySeries.get(work.seriesId ?? '');
    const world = byWorld.get(membership(work, group).universeId ?? '');
    const id = keyFor(work);
    let section = sections.get(id);
    if (!section) {
      section = {
        id,
        name: group?.name ?? names[work.format],
        world,
        series: group,
        works: [],
        total: totals.get(id) ?? 0,
      };
      sections.set(id, section);
    }
    section.works.push(work);
  }
  return [...sections.values()]
    .sort(
      (a, b) =>
        (a.world?.name ?? '\uffff').localeCompare(b.world?.name ?? '\uffff') ||
        a.name.localeCompare(b.name),
    )
    .map((section) => ({
      ...section,
      works: section.series ? section.works.sort(sequence) : section.works,
    }));
}
