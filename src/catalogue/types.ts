import type { Format, PublicationStatus } from '../db/schema';

export interface CorpusChunk {
  offset: number;
  bytes: number;
  sha256: string;
}

export interface CorpusManifest {
  schema: 1;
  version: string;
  builtAt: string;
  file: string;
  bytes: number;
  sha256: string;
  chunkSize: number;
  chunks: CorpusChunk[];
  distribution: 'production' | 'engineering-fixture';
  sources: Record<string, number>;
  counts: {
    works: number;
    series: number;
    universes: number;
    withSeries: number;
    withCover: number;
  };
}

/** The worker's stable return shape. Missing catalogue facts stay missing. */
export interface CorpusMatch {
  corpusId: string;
  title: string;
  authors: string[];
  formatHint?: Format;
  seriesName?: string;
  seriesPosition?: number;
  universeName?: string;
  coverId?: string;
  coverSource?: 'openlibrary' | 'anilist' | 'mangadex';
  publicationStatus?: Exclude<PublicationStatus, 'unknown'>;
  chapterCount?: number;
  volumeCount?: number;
  year?: number;
  source: string;
  /** Present only for the credited, user-initiated live MangaDex connector. */
  mangadexId?: string;
}

/** A catalogue work in a source-stated series, including entries not owned. */
export interface CorpusRelationshipEntry {
  corpusId: string;
  title: string;
  authors: string[];
  formatHint?: Format;
  seriesPosition?: number;
  coverId?: string;
  coverSource?: 'openlibrary' | 'anilist' | 'mangadex';
  publicationStatus?: Exclude<PublicationStatus, 'unknown'>;
  chapterCount?: number;
  volumeCount?: number;
  year?: number;
  source: string;
}

export interface CorpusSeriesEvidence {
  corpusSeriesId: string;
  name: string;
  /** Missing is meaningful: it forbids a completion denominator. */
  totalEntriesKnown?: number;
  source: string;
  entries: CorpusRelationshipEntry[];
}

export interface CorpusUniverseEvidence {
  corpusUniverseId: string;
  name: string;
  description?: string;
  source: string;
}

export interface CorpusRelationshipEvidence {
  work: CorpusRelationshipEntry;
  series?: CorpusSeriesEvidence;
  universe?: CorpusUniverseEvidence;
}

export type CatalogueWorkerRequest =
  | { id: number; type: 'open'; path: string }
  | { id: number; type: 'search'; query: string; limit: number }
  | { id: number; type: 'relationship'; corpusId: string }
  | { id: number; type: 'verify'; path: string }
  | { id: number; type: 'close' };

export type CatalogueWorkerResult =
  | { type: 'opened'; works: number }
  | { type: 'results'; matches: CorpusMatch[]; elapsedMs: number }
  | { type: 'relationship'; evidence?: CorpusRelationshipEvidence }
  | { type: 'verified'; works: number }
  | { type: 'closed' };

export type CatalogueWorkerResponse =
  | { id: number; ok: true; result: CatalogueWorkerResult }
  | { id: number; ok: false; error: string };

export interface InstallProgress {
  receivedBytes: number;
  totalBytes: number;
  startedAt: number;
}

export type CatalogueInstallState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | ({ phase: 'downloading'; manifest: CorpusManifest } & InstallProgress)
  | { phase: 'ready'; manifest: CorpusManifest; path: string; works: number }
  | { phase: 'unavailable'; reason: string }
  | { phase: 'error'; message: string; manifest?: CorpusManifest };
