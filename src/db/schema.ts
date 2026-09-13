/**
 * The data contract. Mirrors docs/SCHEMA.md field for field.
 *
 * Seven deliberate departures from SCHEMA.md v1, all approved by the owner on
 * 2026-09-03 and recorded in docs/DECISIONS.md as E-001 to E-007. Every one of
 * them exists because the finished design package needs it and v1 predates the
 * design work:
 *
 *   + work.genres          the 12 fixed genres are a closed vocabulary separate
 *                          from tags (docs/taxonomy.md). A work carries at most
 *                          two, primary first.
 *   - work.notes           dropped. No screen ever surfaced it and the Notes
 *                          feature covers the need.
 *   - tag.colorIndex       dropped. Colour belongs to the genre index; tags
 *                          render as uncoloured hairline pills.
 *   + tag.groups           a tag may belong to several groups. Warning-gating
 *                          applies only when Content warnings is its ONLY
 *                          group, so "Body Horror" survives as a subgenre when
 *                          warnings are off.
 *   + readingSession       Stats' "chapters read" has to come from logged
 *                          sessions. Summing progressCurrent breaks the first
 *                          time anything is edited downward.
 *   + settings.firstTrackedAt   "years tracked" needs a fixed origin. The
 *                          earliest dateAdded moves when the oldest record is
 *                          deleted, so the origin is stamped once and kept.
 *   + settings.*           content warnings, onboarding state, genre filter.
 *
 * Two fields are kept but deliberately dormant. Both stay in the type so a
 * backup written by any build restores cleanly:
 *   work.rating          no screen sets it. The six axes do this job better.
 *   work.isTranslated    retained for backup compatibility, but no longer gates
 *                        Translation: the owner chose to show that axis always.
 */

/** Bump when a shipped field changes meaning. Backups carry this number. */
export const SCHEMA_VERSION = 2;

export type Format = 'book' | 'novel' | 'manhwa';
export type ReadingStatus = 'wishlist' | 'reading' | 'caught_up' | 'finished' | 'dropped';
export type PublicationStatus = 'ongoing' | 'complete' | 'hiatus' | 'abandoned' | 'unknown';
export type ProgressUnit = 'page' | 'chapter' | 'percent';
export type CoverSource = 'api' | 'user' | 'none';
export type TextColor = 'light' | 'dark';
export type AxisScore = 1 | 2 | 3 | 4 | 5;

/** Index into the twelve fixed genres. See src/data/taxonomy.ts. */
export type GenreIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export interface ExternalIds {
  openLibraryWork?: string;
  openLibraryEdition?: string;
  wikidata?: string;
  anilist?: number;
  mangadex?: string;
  googleBooks?: string;
  isbn13?: string;
}

export interface Work {
  id: string;
  title: string;
  /** leading articles stripped, lowercased, for ordering */
  sortTitle: string;
  subtitle?: string;

  /**
   * Decided by how the work is READ, not by what it technically is. A web novel
   * with a print edition is 'novel' when it is read serialized. User-editable
   * at any time; never auto-corrected after creation.
   */
  format: Format;

  authorIds: string[];
  seriesId?: string;
  /** decimal permitted: 1.5 for a novella between entries */
  seriesPosition?: number;
  universeId?: string;

  /**
   * ORTHOGONAL to publicationStatus. `status` describes the reader,
   * `publicationStatus` describes the work. Never derive one from the other.
   * 'caught_up' is offered only when publicationStatus is 'ongoing' or 'hiatus'.
   */
  status: ReadingStatus;
  publicationStatus: PublicationStatus;

  progressUnit: ProgressUnit;
  progressCurrent: number;
  /**
   * For an ongoing work this is "released so far", not a ceiling — see
   * DECISIONS D-105. Absent means no progress bar and no percentage, ever.
   * Never invent a denominator.
   */
  progressTotal?: number;

  coverSource: CoverSource;
  coverPath?: string;
  coverRemoteUrl?: string;
  /** '#RRGGBB'. Feeds both the tinted detail header and spine view. */
  coverDominantColor?: string;
  coverTextColor?: TextColor;

  /** Dormant: no screen sets this. Kept for restore compatibility. */
  rating?: number;

  tagIds: string[];
  /** At most two, primary first. */
  genres: GenreIndex[];

  /** Compatibility field only. Translation now appears for every work (E-087). */
  isTranslated: boolean;

  dateAdded: string;
  dateStarted?: string;
  dateFinished?: string;
  dateDropped?: string;

  dropReason?: string;
  dropAtProgress?: number;

  externalIds: ExternalIds;

  corpusId?: string;
  isManualEntry: boolean;

  /** Soft delete. Hard-purged after 30 days. */
  deletedAt?: string;
  updatedAt: string;
}

export interface AxisRating {
  workId: string;
  protagonist?: AxisScore;
  powerSystem?: AxisScore;
  world?: AxisScore;
  pacing?: AxisScore;
  prose?: AxisScore;
  /** Writable only when status === 'finished'. */
  ending?: AxisScore;
  /**
   * TRUE = the work has no ending because the author stopped. Mutually
   * exclusive with `ending`. NOT a low score — a different fact. Never averaged.
   */
  endingNone?: boolean;
  translation?: AxisScore;
  ratedAt?: string;
}

export interface Series {
  id: string;
  name: string;
  sortName: string;
  universeId?: string;
  /** Powers completion rings. Absent means NO ring — never a fake denominator. */
  totalEntriesKnown?: number;
  source: 'corpus' | 'user';
  externalIds: { wikidata?: string; anilist?: number; openLibrary?: string };
  updatedAt: string;
}

export interface Universe {
  id: string;
  name: string;
  description?: string;
  /** free text — "start with X, not Y" */
  readingOrderNote?: string;
  source: 'corpus' | 'user';
  externalIds: { wikidata?: string };
  updatedAt: string;
}

/**
 * One named way through a series or universe. A context can have several
 * orders (publication, chronological, preferred) without any one being
 * silently treated as canonical.
 */
export interface ReadingOrder {
  id: string;
  contextType: 'series' | 'universe';
  contextId: string;
  name: string;
  description?: string;
  source: 'corpus' | 'user';
  updatedAt: string;
}

/**
 * An order entry can point at a local work/series or at a catalogue ghost.
 * `label` is retained so the order remains understandable if the local target
 * is later removed. Exactly one of workId/seriesId may be present; corpusId is
 * allowed beside workId so a downloaded-catalogue identity is not lost.
 */
export interface ReadingOrderEntry {
  id: string;
  orderId: string;
  position: number;
  kind: 'work' | 'series';
  label: string;
  workId?: string;
  seriesId?: string;
  corpusId?: string;
  note?: string;
}

export interface Author {
  id: string;
  name: string;
  /** "Brown, Pierce" */
  sortName: string;
  role?: 'author' | 'artist' | 'studio' | 'translator';
  externalIds: { openLibrary?: string; wikidata?: string; anilist?: number };
}

export interface Note {
  id: string;
  title?: string;
  /** Plain text. Not markdown — settled with the owner on 2026-09-02. */
  body: string;
  tagIds: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface NoteLink {
  noteId: string;
  workId: string;
  createdAt: string;
}

export type TagGroup =
  'Subgenre' | 'Setting' | 'Protagonist' | 'Themes' | 'Craft' | 'Origin' | 'Content warnings';

export interface Tag {
  id: string;
  name: string;
  /** lowercased, trimmed — the dedupe key */
  normalizedName: string;
  source: 'user' | 'corpus';
  /**
   * A tag may sit in more than one group. It is warning-gated only when
   * 'Content warnings' is its ONLY group, so a string that is both a subgenre
   * and a warning survives with the toggle off.
   */
  groups: TagGroup[];
  /** Denormalised, for suggestion ordering. */
  usageCount: number;
}

/**
 * Logged reading sessions. Stats' "chapters read" is the sum of `delta` and
 * nothing else — never a sum over progressCurrent, which moves when a value is
 * corrected downward.
 */
export interface ReadingSession {
  id: string;
  workId: string;
  /** position before this session */
  from: number;
  /** position reached */
  to: number;
  /** to - from, always positive. Denormalised so Stats is one sum. */
  delta: number;
  unit: ProgressUnit;
  at: string;
}

export type ViewMode = 'list' | 'spine';
export type ThemeChoice = 'light' | 'dark' | 'system';
export type GenreFilterMode = 'any' | 'all';

/** Cached Phase 9 width ladder. Missing means derive it from the current
 * library; small per-unit samples retain the fixed design thresholds. */
export interface SpineWidthProfileSetting {
  version: 1;
  signature: string;
  thresholds: {
    chapter: [number, number, number, number];
    page: [number, number, number, number];
  };
  adaptiveUnits: Array<'chapter' | 'page'>;
}

export interface Settings {
  id: 'singleton';
  /**
   * Required by the bookplate in practice; optional in the type so a backup
   * written before that rule restores without crashing About (Q-003).
   */
  ownerName?: string;
  theme: ThemeChoice;
  defaultView: Record<Format, ViewMode>;
  seriesSectionsDefaultOpen: boolean;

  /** Off by default. Off means those tags are neither shown NOR created. */
  contentWarningsOn: boolean;
  genreFilterMode: GenreFilterMode;

  welcomeSeenAt?: string;
  tourCompletedAt?: string;
  /** Stamped once at first run. The origin for "years tracked". */
  firstTrackedAt?: string;
  spineWidthProfile?: SpineWidthProfileSetting;

  corpusVersion?: string;
  corpusInstalledAt?: string;
  corpusSkippedAt?: string;

  lastAutoBackupAt?: string;
  lastManualExportAt?: string;

  aiEnabled: boolean;
  aiApiKey?: string;
  aiCallsToday: number;
  aiCallsDate?: string;
  aiDailyCap: number;

  appVersion: string;
}
