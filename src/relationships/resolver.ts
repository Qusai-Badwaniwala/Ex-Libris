import { sortTitleOf } from '../db/keys';
import type { Series, Work } from '../db/schema';
import type { CorpusRelationshipEntry, CorpusRelationshipEvidence } from '../catalogue/types';
import { parseSeriesTitle } from './title-pattern';

export type SuggestionConfidence = 'high' | 'medium' | 'low';

export interface SeriesSuggestion {
  kind: 'series';
  source: 'corpus' | 'title_pattern' | 'library_match';
  confidence: SuggestionConfidence;
  name: string;
  position?: number;
  totalEntriesKnown?: number;
  corpusSeriesId?: string;
  existingSeriesId?: string;
  /** Every catalogue-known entry, ordered where the source states an ordinal. */
  catalogueEntries: CorpusRelationshipEntry[];
  missingEntries: CorpusRelationshipEntry[];
  missingEarlierEntries: CorpusRelationshipEntry[];
}

export interface UniverseSuggestion {
  kind: 'universe';
  source: 'corpus';
  confidence: 'high';
  name: string;
  description?: string;
  corpusUniverseId: string;
}

export interface RelationshipResolution {
  series?: SeriesSuggestion;
  /** Separate by contract: a universe is a rarer, distinct offer. */
  universe?: UniverseSuggestion;
}

export type RelationshipCandidateWork = Pick<
  Work,
  'id' | 'title' | 'seriesId' | 'corpusId' | 'deletedAt'
>;

export interface ResolveRelationshipInput {
  work: Pick<Work, 'id' | 'title' | 'corpusId'>;
  corpus?: CorpusRelationshipEvidence;
  librarySeries: Series[];
  libraryWorks: RelationshipCandidateWork[];
}

function normalizedWords(value: string): string {
  return sortTitleOf(value)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function trigrams(value: string): Set<string> {
  const normalized = `  ${normalizedWords(value)}  `;
  const out = new Set<string>();
  for (let index = 0; index <= normalized.length - 3; index++) {
    out.add(normalized.slice(index, index + 3));
  }
  return out;
}

function editSimilarity(left: string, right: string): number {
  const a = normalizedWords(left);
  const b = normalizedWords(right);
  if (!a || !b) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row++) {
    const current = [row];
    for (let column = 1; column <= b.length; column++) {
      current[column] = Math.min(
        current[column - 1]! + 1,
        previous[column]! + 1,
        previous[column - 1]! + (a[row - 1] === b[column - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return 1 - previous[b.length]! / Math.max(a.length, b.length);
}

/** Conservative maximum of normalized edit and trigram similarity. */
export function titleSimilarity(left: string, right: string): number {
  const a = trigrams(left);
  const b = trigrams(right);
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const gram of a) if (b.has(gram)) overlap++;
  return Math.max((2 * overlap) / (a.size + b.size), editSimilarity(left, right));
}

interface LibrarySeriesMatch {
  series: Series;
  confidence: 'medium' | 'low';
}

/**
 * Fuzzy matching is intentionally difficult to trigger: exact normalized
 * names win, otherwise a unique candidate must clear 0.9 with an 0.08 margin.
 * A false merge is invisible; a missed suggestion remains manually fixable.
 */
export function matchLibrarySeries(
  candidateName: string,
  series: Series[],
): LibrarySeriesMatch | undefined {
  const candidate = normalizedWords(candidateName);
  if (candidate.length < 3) return undefined;
  const exact = series.find((entry) => normalizedWords(entry.name) === candidate);
  if (exact) return { series: exact, confidence: 'medium' };
  if (candidate.length < 6) return undefined;

  const ranked = series
    .map((entry) => ({ series: entry, score: titleSimilarity(candidate, entry.name) }))
    .sort((left, right) => right.score - left.score);
  const best = ranked[0];
  if (!best || best.score < 0.9) return undefined;
  if (ranked[1] && best.score - ranked[1].score < 0.08) return undefined;
  return { series: best.series, confidence: 'low' };
}

function librarySeriesForPattern(
  name: string,
  series: Series[],
  works: RelationshipCandidateWork[],
): LibrarySeriesMatch | undefined {
  const direct = matchLibrarySeries(name, series);
  if (direct) return direct;

  const candidates = works
    .filter((work) => !work.deletedAt && work.seriesId)
    .map((work) => ({ work, parsed: parseSeriesTitle(work.title) }))
    .filter((candidate) => candidate.parsed);
  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: titleSimilarity(name, candidate.parsed!.seriesName),
    }))
    .sort((left, right) => right.score - left.score);
  const best = ranked[0];
  if (!best || best.score < 0.9 || (ranked[1] && best.score - ranked[1].score < 0.08)) {
    return undefined;
  }
  const matched = series.find((entry) => entry.id === best.candidate.work.seriesId);
  return matched ? { series: matched, confidence: 'low' } : undefined;
}

function corpusResolution(
  work: ResolveRelationshipInput['work'],
  corpus: CorpusRelationshipEvidence,
  librarySeries: Series[],
  libraryWorks: RelationshipCandidateWork[],
): RelationshipResolution {
  const ownedCorpusIds = new Set(
    libraryWorks
      .filter((entry) => !entry.deletedAt)
      .map((entry) => entry.corpusId)
      .filter(Boolean),
  );
  const existingSeries = corpus.series
    ? librarySeries.find(
        (entry) =>
          entry.id === corpus.series!.corpusSeriesId ||
          normalizedWords(entry.name) === normalizedWords(corpus.series!.name),
      )
    : undefined;
  const position = corpus.work.seriesPosition;
  const missingEntries =
    corpus.series?.entries.filter(
      (entry) => entry.corpusId !== work.corpusId && !ownedCorpusIds.has(entry.corpusId),
    ) ?? [];
  const missingEarlierEntries =
    position === undefined
      ? []
      : missingEntries.filter(
          (entry) => entry.seriesPosition !== undefined && entry.seriesPosition < position,
        );

  return {
    series: corpus.series
      ? {
          kind: 'series',
          source: 'corpus',
          confidence: 'high',
          name: corpus.series.name,
          position,
          totalEntriesKnown: corpus.series.totalEntriesKnown,
          corpusSeriesId: corpus.series.corpusSeriesId,
          existingSeriesId: existingSeries?.id,
          catalogueEntries: corpus.series.entries,
          missingEntries,
          missingEarlierEntries,
        }
      : undefined,
    universe: corpus.universe
      ? {
          kind: 'universe',
          source: 'corpus',
          confidence: 'high',
          name: corpus.universe.name,
          description: corpus.universe.description,
          corpusUniverseId: corpus.universe.corpusUniverseId,
        }
      : undefined,
  };
}

/** Runs the documented cascade and performs no writes. */
export function resolveRelationships(input: ResolveRelationshipInput): RelationshipResolution {
  if (input.corpus?.series || input.corpus?.universe) {
    return corpusResolution(input.work, input.corpus, input.librarySeries, input.libraryWorks);
  }

  const parsed = parseSeriesTitle(input.work.title);
  if (!parsed) return {};
  const libraryMatch = librarySeriesForPattern(
    parsed.seriesName,
    input.librarySeries,
    input.libraryWorks,
  );

  if (libraryMatch) {
    return {
      series: {
        kind: 'series',
        source:
          normalizedWords(libraryMatch.series.name) === normalizedWords(parsed.seriesName)
            ? 'title_pattern'
            : 'library_match',
        confidence: libraryMatch.confidence,
        name: libraryMatch.series.name,
        position: parsed.position,
        existingSeriesId: libraryMatch.series.id,
        totalEntriesKnown: libraryMatch.series.totalEntriesKnown,
        catalogueEntries: [],
        missingEntries: [],
        missingEarlierEntries: [],
      },
    };
  }

  return {
    series: {
      kind: 'series',
      source: 'title_pattern',
      confidence: 'medium',
      name: parsed.seriesName,
      position: parsed.position,
      catalogueEntries: [],
      missingEntries: [],
      missingEarlierEntries: [],
    },
  };
}
