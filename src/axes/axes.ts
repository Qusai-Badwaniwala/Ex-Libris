import type { AxisRating, AxisScore, Work } from '../db/schema';

export const AXIS_KEYS = [
  'protagonist',
  'powerSystem',
  'world',
  'pacing',
  'prose',
  'ending',
  'translation',
] as const;

export const MATCH_AXIS_KEYS = [
  'protagonist',
  'powerSystem',
  'world',
  'pacing',
  'prose',
  'ending',
] as const;

export type AxisKey = (typeof AXIS_KEYS)[number];
export type MatchAxisKey = (typeof MATCH_AXIS_KEYS)[number];

export interface AxisDefinition {
  key: AxisKey;
  name: string;
  low: string;
  high: string;
  words: readonly [string, string, string, string, string];
}

export const AXES: readonly AxisDefinition[] = [
  {
    key: 'protagonist',
    name: 'Protagonist',
    low: 'Heroic',
    high: 'Monstrous',
    words: ['Heroic', 'Principled', 'Pragmatic', 'Ruthless', 'Monstrous'],
  },
  {
    key: 'powerSystem',
    name: 'Power system',
    low: 'Vague',
    high: 'Rigorous',
    words: ['Vague', 'Loose', 'Coherent', 'Codified', 'Rigorous'],
  },
  {
    key: 'world',
    name: 'World',
    low: 'Gentle',
    high: 'Merciless',
    words: ['Gentle', 'Fair', 'Harsh', 'Brutal', 'Merciless'],
  },
  {
    key: 'pacing',
    name: 'Pacing',
    low: 'Slow burn',
    high: 'Relentless',
    words: ['Slow burn', 'Patient', 'Steady', 'Driving', 'Relentless'],
  },
  {
    key: 'prose',
    name: 'Prose',
    low: 'Plain',
    high: 'Dense',
    words: ['Plain', 'Clean', 'Textured', 'Rich', 'Dense'],
  },
  {
    key: 'ending',
    name: 'Ending',
    low: 'Botched',
    high: 'Earned',
    words: ['Botched', 'Rushed', 'Passable', 'Satisfying', 'Earned'],
  },
  {
    key: 'translation',
    name: 'Translation',
    low: 'Rough',
    high: 'Fluent',
    words: ['Rough', 'Stiff', 'Serviceable', 'Smooth', 'Fluent'],
  },
] as const;

export const AXIS_BY_KEY = Object.fromEntries(AXES.map((axis) => [axis.key, axis])) as Record<
  AxisKey,
  AxisDefinition
>;

export function axisWord(key: AxisKey, score: AxisScore): string {
  return AXIS_BY_KEY[key].words[score - 1]!;
}

const MATCH_WEIGHTS: Record<MatchAxisKey, number> = {
  protagonist: 3,
  powerSystem: 3,
  world: 3,
  pacing: 1,
  prose: 1,
  ending: 2,
};

export interface SimilarWorkCandidate {
  work: Work;
  rating: AxisRating;
  authorName?: string;
}

export interface SimilarWork extends SimilarWorkCandidate {
  /** Internal rank only. The interface explains matches with axis names. */
  score: number;
  sharedAxes: MatchAxisKey[];
  matchedAxes: MatchAxisKey[];
}

/**
 * Ranks only the reader's own works. Missing values are ignored rather than
 * guessed, and three shared axes are required before a comparison is honest.
 * Translation remains useful edition context but is deliberately not part of
 * the six-axis recommendation contract.
 */
export function moreLikeThis(
  targetWorkId: string,
  target: AxisRating | undefined,
  candidates: SimilarWorkCandidate[],
  limit = 5,
): SimilarWork[] {
  if (!target) return [];

  return candidates
    .filter(
      ({ work, rating }) =>
        work.id !== targetWorkId &&
        !work.deletedAt &&
        work.status !== 'wishlist' &&
        rating.workId === work.id,
    )
    .map((candidate): SimilarWork | null => {
      const sharedAxes = MATCH_AXIS_KEYS.filter(
        (key) => target[key] !== undefined && candidate.rating[key] !== undefined,
      );
      if (sharedAxes.length < 3) return null;

      let totalWeight = 0;
      let weightedSimilarity = 0;
      const byCloseness = sharedAxes.map((key) => {
        const weight = MATCH_WEIGHTS[key];
        const distance = Math.abs(target[key]! - candidate.rating[key]!);
        const similarity = 1 - distance / 4;
        totalWeight += weight;
        weightedSimilarity += similarity * weight;
        return { key, similarity, weight };
      });

      byCloseness.sort(
        (a, b) =>
          b.similarity - a.similarity ||
          b.weight - a.weight ||
          MATCH_AXIS_KEYS.indexOf(a.key) - MATCH_AXIS_KEYS.indexOf(b.key),
      );
      const matchedAxes = byCloseness
        .filter(({ similarity }) => similarity === 1)
        .slice(0, 3)
        .map(({ key }) => key);
      if (matchedAxes.length === 0) return null;

      return {
        ...candidate,
        score: weightedSimilarity / totalWeight,
        sharedAxes,
        matchedAxes,
      };
    })
    .filter((candidate): candidate is SimilarWork => candidate !== null)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.sharedAxes.length - a.sharedAxes.length ||
        a.work.sortTitle.localeCompare(b.work.sortTitle),
    )
    .slice(0, Math.max(0, limit));
}

export function matchedAxesSentence(keys: MatchAxisKey[], rating: AxisRating): string {
  const names = keys.flatMap((key) =>
    rating[key] === undefined ? [] : [axisWord(key, rating[key])],
  );
  if (names.length === 0) return '';
  if (names.length === 1) return `Matched on ${names[0]}.`;
  if (names.length === 2) return `Matched on ${names[0]} and ${names[1]}.`;
  return `Matched on ${names.slice(0, -1).join(', ')} and ${names.at(-1)}.`;
}
