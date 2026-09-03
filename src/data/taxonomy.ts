import raw from './taxonomy.json';
import type { GenreIndex, TagGroup } from '../db/schema';

/**
 * The controlled vocabulary: 12 fixed genres and 242 seeded tags.
 *
 * taxonomy.json is the single source of truth and is imported, never
 * transcribed — a hand-typed copy of 242 strings drifts on the first edit.
 * `npm run check:tokens` asserts three things this file depends on and TypeScript
 * cannot see: that the copy matches the delivered document, that every genre's
 * colorIndex matches the index-to-genre table in tokens.css, and that the set is
 * exactly twelve. A work stores the INDEX, so a reorder silently recolours the
 * whole library — the one change here that could not be spotted by looking.
 */

export interface Genre {
  name: string;
  colorIndex: GenreIndex;
  colorName: string;
  hex: string;
  description: string;
}

export interface TagGroupDef {
  group: TagGroup;
  tags: string[];
}

export interface SourceMap {
  source: string;
  incoming: string;
  genre: string;
  note: string;
}

export const TAXONOMY_VERSION: number = raw.version;

/** Ordered BY colorIndex, so GENRES[i].colorIndex === i always holds. */
export const GENRES: Genre[] = (raw.genres as Genre[])
  .slice()
  .sort((a, b) => a.colorIndex - b.colorIndex);

export const GENRE_NAMES: string[] = GENRES.map((g) => g.name);

export const TAG_GROUPS: TagGroupDef[] = raw.tagGroups as TagGroupDef[];

export const SOURCE_MAPPING: SourceMap[] = raw.sourceMapping as SourceMap[];

export const ALL_TAGS: string[] = TAG_GROUPS.flatMap((g) => g.tags);

/**
 * Which groups each seeded tag belongs to. Two strings genuinely sit in two
 * groups — "Body Horror" is a Subgenre and a Content warning, "Slavery" is a
 * Theme and a Content warning. Recording membership as a list rather than
 * picking a winner is what lets both survive with warnings switched off
 * (OPEN-QUESTIONS Q-016, settled 2026-09-03).
 */
export const TAG_GROUP_MEMBERSHIP: ReadonlyMap<string, TagGroup[]> = (() => {
  const m = new Map<string, TagGroup[]>();
  for (const g of TAG_GROUPS) {
    for (const t of g.tags) {
      const list = m.get(t);
      if (list) list.push(g.group);
      else m.set(t, [g.group]);
    }
  }
  return m;
})();

/**
 * True only when Content warnings is the tag's ONLY group. A tag that also
 * earns its place as a subgenre is never hidden — hiding "Body Horror" as a
 * warning also removed it as a legitimate subgenre, which was the defect.
 */
export function isWarningOnly(tag: string): boolean {
  const groups = TAG_GROUP_MEMBERSHIP.get(tag);
  return !!groups && groups.length === 1 && groups[0] === 'Content warnings';
}

/** The visibility gate. One function, so the Settings toggle cannot be
 *  honoured on one screen and missed on another. */
export function visibleTags(tags: string[], contentWarningsOn: boolean): string[] {
  return contentWarningsOn ? tags : tags.filter((t) => !isWarningOnly(t));
}

export function genreByName(name: string): Genre | undefined {
  return GENRES.find((g) => g.name === name);
}

export function genreIndexByName(name: string): GenreIndex | undefined {
  return genreByName(name)?.colorIndex;
}
