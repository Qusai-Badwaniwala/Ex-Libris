Ex Libris
Data Contract
SCHEMA.md · Version 1.0
Both sessions receive this document.
Claude Design designs against it. Claude Code implements it exactly.
This file exists so that neither session waits on the other. Every field a screen could need is defined here, including the shapes returned by search, matching, and suggestion logic.

Changing this contract. Claude Code may propose changes — a missing index, a field that turns out to be unworkable, a type that should differ. Any proposal must be flagged to the user with the reason. If a change affects anything visible on screen, it goes back to the user before implementation. Do not change it silently.
Conventions. All dates are ISO 8601 strings. All ids are UUID v4 strings unless stated. Optional fields marked ? may be absent or null, and every screen must render sensibly when they are — real catalogue data is full of gaps.

Contents


Right-click and choose "Update field" to populate.

1 · work
The central entity. A book, a novel, or a manhwa.
interface Work {
  id: string;
  title: string;
  sortTitle: string;              // leading articles stripped, lowercased
  subtitle?: string;
 
  format: &apos;book&apos; | &apos;novel&apos; | &apos;manhwa&apos;;
  // Decided by how the user reads it, not what it technically is.
  // A web novel with a print edition is &apos;novel&apos; if read serialized.
  // Always user-editable in one tap. Never auto-corrected after creation.
 
  authorIds: string[];            // may be empty — manhwa often credits studios
  seriesId?: string;
  seriesPosition?: number;        // decimal permitted: 1.5 for novellas
  universeId?: string;
 
  status: &apos;wishlist&apos; | &apos;reading&apos; | &apos;caught_up&apos; | &apos;finished&apos; | &apos;dropped&apos;;
  publicationStatus: &apos;ongoing&apos; | &apos;complete&apos; | &apos;hiatus&apos; | &apos;abandoned&apos; | &apos;unknown&apos;;
  // ORTHOGONAL. `status` describes the user.
  // `publicationStatus` describes the work.
  // A manhwa can be `ongoing` while the user is `caught_up`.
  // Never derive one from the other.
  // `caught_up` is offered ONLY when publicationStatus is &apos;ongoing&apos; or &apos;hiatus&apos;.
 
  progressUnit: &apos;page&apos; | &apos;chapter&apos; | &apos;percent&apos;;
  // Defaults: book -> &apos;page&apos;, novel -> &apos;chapter&apos;, manhwa -> &apos;chapter&apos;.
  // Always user-overridable per work.
  progressCurrent: number;        // 0 when unstarted
  progressTotal?: number;         // prefilled from corpus, always editable
  // When progressTotal is absent, show the raw count and NO progress bar.
  // Never invent a denominator.
 
  coverSource: &apos;api&apos; | &apos;user&apos; | &apos;none&apos;;
  coverPath?: string;             // OPFS path
  coverRemoteUrl?: string;        // original source, for re-fetch after restore
  coverDominantColor?: string;    // &apos;#RRGGBB&apos; — tinted pages AND spine view
  coverTextColor?: &apos;light&apos; | &apos;dark&apos;;   // computed for contrast
 
  rating?: number;                // 1-5, half-steps. Independent of axes.
  tagIds: string[];
 
  isTranslated: boolean;          // gates the optional translation axis
 
  dateAdded: string;
  dateStarted?: string;
  dateFinished?: string;
  dateDropped?: string;
 
  dropReason?: string;            // optional, never prompted twice
  dropAtProgress?: number;
 
  externalIds: {
    openLibraryWork?: string;
    openLibraryEdition?: string;
    wikidata?: string;
    anilist?: number;
    mangadex?: string;
    googleBooks?: string;
    isbn13?: string;
  };
 
  corpusId?: string;              // provenance link back to the corpus row
  isManualEntry: boolean;         // true when no corpus match existed
 
  notes?: string;                 // short free-text on the work itself,
                                  // separate from the Notes feature
 
  deletedAt?: string;             // soft delete. Hard-purge after 30 days.
  updatedAt: string;
}

Indexes: status, format, seriesId, universeId, sortTitle, dateFinished, deletedAt, compound [format+status].
States every screen must handle: no cover · no author · no series · no progressTotal · very long title · isManualEntry with almost no metadata.
2 · axisRating
One row per work. Every field nullable — partial ratings are normal and must not break matching.
interface AxisRating {
  workId: string;
  protagonist?: 1|2|3|4|5;
  powerSystem?: 1|2|3|4|5;
  world?: 1|2|3|4|5;
  pacing?: 1|2|3|4|5;
  prose?: 1|2|3|4|5;
  ending?: 1|2|3|4|5;
  endingNone?: boolean;   // TRUE = the work has no ending (author abandoned).
                          // Mutually exclusive with `ending`.
                          // NOT a low score — a different fact.
                          // Never average it in.
  translation?: 1|2|3|4|5;  // only when work.isTranslated
  ratedAt?: string;
}

Canonical labels. Always display the word, never the number.
Axis
1
2
3
4
5
protagonist
Heroic
Principled
Pragmatic
Ruthless
Monstrous
powerSystem
Vague
Loose
Coherent
Codified
Rigorous
world
Gentle
Fair
Harsh
Brutal
Merciless
pacing
Slow burn
Patient
Steady
Driving
Relentless
prose
Plain
Clean
Textured
Rich
Dense
ending
Botched
Rushed
Passable
Satisfying
Earned
translation
Rough
Stiff
Serviceable
Smooth
Fluent

ending is writable only when status === &apos;finished&apos;. endingNone displays as Unfinished and sits outside the scale.
3 · series
interface Series {
  id: string;
  name: string;
  sortName: string;
  universeId?: string;
  totalEntriesKnown?: number;   // from corpus. Powers completion rings.
                                // When absent: NO ring.
                                // Never a fake denominator.
  source: &apos;corpus&apos; | &apos;user&apos;;
  externalIds: { wikidata?: string; anilist?: number; openLibrary?: string; };
  updatedAt: string;
}
4 · universe
A level above series. Solves the user’s stated pain: discovering too late that a series sits inside a larger continuity.
interface Universe {
  id: string;
  name: string;
  description?: string;
  readingOrderNote?: string;    // free text — "start with X, not Y"
  source: &apos;corpus&apos; | &apos;user&apos;;
  externalIds: { wikidata?: string; };
  updatedAt: string;
}
5 · author
interface Author {
  id: string;
  name: string;
  sortName: string;             // "Brown, Pierce"
  role?: &apos;author&apos; | &apos;artist&apos; | &apos;studio&apos; | &apos;translator&apos;;
  externalIds: { openLibrary?: string; wikidata?: string; anilist?: number; };
}
6 · note and noteLink
Free-floating, optionally attached to one or more works.
interface Note {
  id: string;
  title?: string;
  body: string;
  tagIds: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}
 
interface NoteLink {
  noteId: string;
  workId: string;
  createdAt: string;
}

A note with no links lives only in the Notes feed. A linked note appears in the feed and on each linked work’s page. Deleting a work unlinks its notes rather than deleting them — they survive as loose notes.
7 · tag
interface Tag {
  id: string;
  name: string;
  normalizedName: string;       // lowercased, trimmed — used for dedupe
  source: &apos;user&apos; | &apos;corpus&apos;;    // corpus tags from OL subjects / AniList genres
  colorIndex: number;           // 0-11, index into the genre spectrum.
                                // Stable once assigned.
  usageCount: number;
}

Tags are shared across works and notes. Merge on normalizedName collision.
8 · settings
Single-row key-value store.
interface Settings {
  ownerName: string;              // from the bookplate
  theme: &apos;light&apos; | &apos;dark&apos; | &apos;system&apos;;
  defaultView: { book: &apos;list&apos;|&apos;spine&apos;; novel: &apos;list&apos;|&apos;spine&apos;;
                 manhwa: &apos;list&apos;|&apos;spine&apos;; };
  seriesSectionsDefaultOpen: boolean;
  corpusVersion?: string;
  corpusInstalledAt?: string;
  lastAutoBackupAt?: string;
  lastManualExportAt?: string;
  aiEnabled: boolean;             // default false
  aiApiKey?: string;
  aiCallsToday: number;
  aiDailyCap: number;             // default 50
  appVersion: string;
}
9 · Returned shapes
These are the payloads screens consume. Design against them directly.
9.1 Search result
One bar serves both "find what I own" and "add what I don’t."
interface SearchResults {
  inLibrary: Work[];
  fromCorpus: CorpusMatch[];
  isLiveFallback: boolean;    // true when results came from a network call
  query: string;
}
 
interface CorpusMatch {
  corpusId: string;
  title: string;
  authors: string[];          // may be empty
  formatHint?: &apos;book&apos; | &apos;novel&apos; | &apos;manhwa&apos;;
  seriesName?: string;
  seriesPosition?: number;
  universeName?: string;
  coverUrl?: string;
  publicationStatus?: &apos;ongoing&apos; | &apos;complete&apos; | &apos;hiatus&apos; | &apos;abandoned&apos;;
  chapterCount?: number;
  year?: number;
}
9.2 Series suggestion
Produced when a work is added. Suggests, never applies.
interface SeriesSuggestion {
  kind: &apos;series&apos; | &apos;universe&apos;;
  name: string;
  position?: number;              // this work’s place in it
  totalEntriesKnown?: number;
  confidence: &apos;high&apos; | &apos;medium&apos; | &apos;low&apos;;
  // high   = direct corpus link
  // medium = title pattern or strong fuzzy match
  // low    = weak fuzzy match or AI fallback
  //          must be visually distinguished
  source: &apos;corpus&apos; | &apos;pattern&apos; | &apos;fuzzy&apos; | &apos;ai&apos;;
  otherEntries: {                 // entries NOT yet in the library
    corpusId: string;
    title: string;
    position?: number;
    coverUrl?: string;
  }[];
  readingOrderNote?: string;      // universes only
}
9.3 More like this
interface Recommendation {
  work: Work;
  score: number;                  // 0-1, internal ranking — never display
  matchedAxes: {
    axis: &apos;protagonist&apos;|&apos;powerSystem&apos;|&apos;world&apos;|&apos;pacing&apos;|&apos;prose&apos;|&apos;ending&apos;;
    label: string;                // e.g. "Monstrous" — display this
  }[];
}

Requires at least three shared rated axes before returning anything. protagonist, powerSystem and world weight highest; pacing and prose weight loosely because they are appetites, not judgments. Null axes are ignored, never imputed.
The UI must surface matchedAxes — "matched on Monstrous and Merciless." A recommendation that cannot explain itself is not trustworthy.
9.4 Stats
interface Stats {
  finishedThisYear: number;
  currentlyReading: number;
  libraryTotal: number;           // EXCLUDES wishlist. Never inflate.
  wishlistTotal: number;
  byFormat: { book: number; novel: number; manhwa: number; };
  genreDistribution: { tagId: string; name: string;
                       count: number; colorIndex: number; }[];
  mostReadAuthor?: { authorId: string; name: string; count: number; };
  seriesStarted: number;
  seriesCompleted: number;
  finishRate: number;             // finished / (finished + dropped), 0-1
  droppedTotal: number;
  finishedByYear: { year: number; count: number; }[];
}

Home shows three. The Stats tab shows all.
9.5 Series with progress
interface SeriesWithProgress {
  series: Series;
  owned: Work[];                  // ordered by seriesPosition
  missing: {                      // in the corpus but not the library
    corpusId: string;
    title: string;
    position?: number;
    coverUrl?: string;
  }[];
  completionRing?: {              // absent when totalEntriesKnown is null
    finished: number;
    owned: number;
    total: number;
  };
}
9.6 Spine
interface SpineData {
  workId: string;
  title: string;
  color: string;                  // &apos;#RRGGBB&apos; from coverDominantColor
  textColor: &apos;light&apos; | &apos;dark&apos;;
  widthBucket: 1|2|3|4|5;         // derived from chapter or page count
  status: Work[&apos;status&apos;];
}

Works with no cover fall back to a neutral colour. Works with no length data get widthBucket 3.
10 · Corpus tables
Read-only, shipped prebuilt, queried in a Web Worker. Not part of user data and never included in backups.
corpus_work      id, title, title_normalized, authors, format_hint,
                 series_id, series_position, universe_id, cover_id,
                 cover_source, publication_status, chapter_count,
                 volume_count, year, popularity, external_ids, source
 
corpus_series    id, name, universe_id, total_entries
 
corpus_universe  id, name, description
 
corpus_work_fts  FTS5 over title + title_normalized + authors
                 tokenize=&apos;unicode61 remove_diacritics 2&apos;
                 prefix=&apos;2 3 4&apos;
11 · Backup payload
interface BackupFile {
  schemaVersion: 1;
  appVersion: string;
  createdAt: string;
  kind: &apos;auto&apos; | &apos;manual&apos;;
  counts: { works: number; notes: number;
            series: number; universes: number; };
  data: {
    works: Work[];
    axisRatings: AxisRating[];
    series: Series[];
    universes: Universe[];
    authors: Author[];
    notes: Note[];
    noteLinks: NoteLink[];
    tags: Tag[];
    settings: Settings;           // aiApiKey EXCLUDED
  };
  userCovers: { workId: string; filename: string; }[];
  // User-uploaded covers are bundled — they are irreplaceable.
  // API-fetched covers are excluded — they can be re-fetched.
}

Manual export is a .zip: data.json + /covers/user/ + manifest.json. Imports must be transactional — a partial write is worse than a failure.