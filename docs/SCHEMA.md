# SCHEMA.md — the live data contract

**Version 2 · 2026-09-07**

## Where the contract actually lives

**[`src/db/schema.ts`](../src/db/schema.ts) is the contract.** It is TypeScript,
it is what the app compiles against, and it carries the reasoning for every
field as comments beside that field.

This document does not restate it. A markdown copy of a type definition is a
second answer to the same question and it drifts within a week — which is the
one thing the engine brief is most insistent about. What lives here instead is
the version, the departures from the delivered v1, and the indexes.

The delivered v1 is preserved unmodified at
[`design/docs/schema.md`](../design/docs/schema.md) and is never edited.

---

## Version 2 · what changed from v1, and why

All seven were proposed to the owner and approved on 2026-09-03, before any code
was written. Reasoning in full is in [`DECISIONS.md`](DECISIONS.md) E-001 to
E-007.

|       | change                            | reason in one line                                                                                                  |
| ----- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| E-001 | **+** `work.genres: GenreIndex[]` | The twelve genres are a closed vocabulary separate from tags; v1 predates the taxonomy. At most two, primary first. |
| E-002 | **−** `work.notes`                | On no screen in the finished design. Dropped rather than designed for.                                              |
| E-003 | **−** `tag.colorIndex`            | Colour belongs to the genre index. Tags render as uncoloured pills.                                                 |
| E-004 | **+** `tag.groups: TagGroup[]`    | A tag may sit in several groups, so a warning string that is also a subgenre survives with warnings off.            |
| E-005 | **+** `readingSession` table      | "Chapters read" must be a sum of logged sessions, never a sum over `progressCurrent`.                               |
| E-006 | **+** `settings.firstTrackedAt`   | "Years tracked" needs an origin that does not move when the oldest record is deleted.                               |
| E-007 | **+** six `settings` fields       | Content warnings, genre filter mode, onboarding state, catalogue skip, AI call date.                                |

Phase 5 adds two persisted record types within the same live contract and an
additive Dexie v2 migration:

- `ReadingOrder` names one user- or corpus-sourced order for a `series` or
  `universe`. Several orders may share the same context; none is silently
  canonical.
- `ReadingOrderEntry` stores its explicit position, kind, stable display label,
  and optional local work/series and catalogue identities. An entry without a
  local target is a truthful catalogue ghost, not an owned work.

The exact interfaces and validation rules live in `src/db/schema.ts` and
`src/db/repo.ts`. Phase 5 confirmation creates a corpus `Publication order` only
after the reader confirms the relationship. Resolution itself writes nothing.
Editing an existing order uses one `saveReadingOrder` transaction for its name,
description, and full entry sequence. Validation or storage failure therefore
preserves both the prior metadata and prior sequence. A universe's optional
`readingOrderNote` is a separate starting-point fact: it can be saved or cleared
without changing, selecting, or deleting any named order.

### Deliberately dormant

Two fields are in the type and nothing writes them. Both stay so a backup
written by any build restores without loss.

- `work.rating` — the six axes do this job better. No screen sets it.
- `work.isTranslated` — retained for backup compatibility. E-087 supersedes its
  old gate: Translation appears for every work and this field does not control
  the interface.

### Superseded by the design package

`SearchResults` (v1 §9.1) described one search merging library and catalogue
results. The finished design splits them — search is a lens over the library and
never reaches the catalogue (design D-055). `SearchResults` therefore becomes the
**catalogue sheet's** payload, and the library search screen needs its own return
shape. That shape is written in Phase 1, against the real screen, rather than
guessed at now.

---

## Indexes

Declared once, in `MIGRATIONS` in [`src/db/db.ts`](../src/db/db.ts).

| table               | key and indexes                                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `work`              | `id`, `status`, `format`, `seriesId`, `universeId`, `sortTitle`, `dateAdded`, `dateFinished`, `deletedAt`, `[format+status]`, `*genres`, `*tagIds` |
| `axisRating`        | `workId`                                                                                                                                           |
| `series`            | `id`, `sortName`, `universeId`, `source`                                                                                                           |
| `universe`          | `id`, `name`, `source`                                                                                                                             |
| `author`            | `id`, `sortName`, `name`                                                                                                                           |
| `note`              | `id`, `updatedAt`, `pinned`, `deletedAt`, `*tagIds`                                                                                                |
| `noteLink`          | `[noteId+workId]` (primary), `noteId`, `workId`                                                                                                    |
| `tag`               | `id`, **`&normalizedName`** (unique), `usageCount`, `*groups`                                                                                      |
| `readingSession`    | `id`, `workId`, `at`                                                                                                                               |
| `readingOrder`      | `id`, `[contextType+contextId]`, `contextId`, `source`                                                                                             |
| `readingOrderEntry` | `id`, `orderId`, `[orderId+position]`, `workId`, `seriesId`, `corpusId`                                                                            |
| `settings`          | `id`                                                                                                                                               |

Three of these are doing more than lookup:

- **`&normalizedName`** is unique, so the merge rule in v1 §7 is enforced by the
  store rather than remembered by every call site.
- **`[noteId+workId]`** is the primary key, so attaching the same note to the
  same work twice cannot produce a second link.
- **`*genres` and `*tagIds`** are multi-entry, so genre filtering over a large
  library is an index lookup rather than a scan.

---

## Phase 4 cover storage contract

Phase 4 required no Dexie migration: the shipped `Work` fields already express
the cover contract. Their runtime meaning is now fixed:

- `coverRemoteUrl` is an optional fetch lead. Its presence does not mean an
  image is available locally.
- `coverSource` describes the file currently committed in OPFS. It is `none`
  until a candidate image has been decoded, processed, written, and closed.
- `coverPath` points only inside `covers/user/<encoded-work-id>/` or
  `covers/api/<encoded-work-id>/`, with a unique filename for every candidate.
- `coverDominantColor` and `coverTextColor` are computed once from the processed
  local file. They may style Detail and spine presentation but do not tint the
  Home Continue surface.

Binary commit precedes the Dexie pointer update. If processing, OPFS, or the
record update fails, the last durable record and cover remain visible and the
candidate file is removed. A concurrent user cover prevents a later API result
from taking ownership. Replacement removes the superseded file after the new
record is durable. Soft delete retains the cover for Trash restoration; hard
purge removes it best-effort. Phase 8 export and restore now carry every user
cover and deliberately omit replaceable API-cover bytes.

The Workbox runtime image cache was removed. OPFS is the only durable runtime
cover cache, so deleting an OPFS cover does not leave a second 30-day copy.

## Phase 6 axis and matching contract

Phase 6 uses the existing `axisRating` store and requires no migration. One row
is keyed by `workId`; every score is optional and limited to integer stops 1–5.
An empty row is deleted. `ending` and `endingNone` are mutually exclusive and
writable only while `work.status === 'finished'`; correcting the status away
from Finished clears both while preserving the other axes. `endingNone` is a
separate no-ending fact and is never averaged.

E-087 supersedes the old Translation gate. Translation is available on every
work; `work.isTranslated` is compatibility data only. Recommendation distance
uses protagonist, power system, world, pacing, prose, and ending. It ignores
missing values, requires at least three shared rated axes, excludes Wishlist and
Trash, and never persists or displays its internal score. Explanation labels
come only from stops both works rated identically.

## Settings singleton creation

`settings.id` remains the single key `singleton`. First read, first insert, and
application-version update are one serialized Dexie read-write transaction.
This is required because React StrictMode and two simultaneously opened app
roots can otherwise both observe an absent row and race to insert it.

Phase 9 adds an optional `settings.spineWidthProfile` derived cache without a
Dexie migration. Version 1 contains a signature of the current non-Wishlist,
non-Trash library, separate four-boundary chapter/page ladders, and the units
whose ladders are adaptive. Forty known lengths in one unit activates its
20/40/60/80-percentile boundaries; smaller samples retain D-027's fixed ladder.
Malformed or signature-mismatched values are ignored and recomputed. The cache
is safe to export and restore because it contains no reader content and cannot
override the current library signature; reset clears it with settings.

Stats adds no persisted aggregate. `libraryStats` reads works, authors, series,
reading sessions, and settings in one read transaction. Library totals exclude
Wishlist and Trash. “Chapters read” sums only chapter-unit sessions, never page
sessions or mutable progress. Calendar-year figures use local-time helpers.

---

## Rules that are not fields

- **Dates are stored as UTC ISO 8601 instants and asked about locally.**
  `src/db/dates.ts` is the only correct way to turn one into a calendar day or
  year; the gate fails on anything else. See DECISIONS E-014.
- **A migration may only add.** `MIGRATIONS` is one ordered list. Append, never
  edit a shipped entry. A missing field resolves to the behaviour that user
  already had, decided in the upgrade function rather than at every read site.
- **`status` and `publicationStatus` are orthogonal** and neither is ever derived
  from the other. `caught_up` is offered only when the work is `ongoing` or
  `hiatus`.
- **For an ongoing work, `progressTotal` means "released so far", not a
  ceiling** (design D-105). No percentage is shown, the stepper is uncapped, and
  reaching the total reads "Caught up", never "Finish it".
- **An absent `progressTotal` means no bar and no percentage, ever.** Never
  invent a denominator. This is the common case for web novels.
- **An absent `series.totalEntriesKnown` means no completion ring.** Never a fake
  denominator.
- **Relationship evidence is an offer, not a mutation.** Exact corpus identity
  outranks title patterns; series and universe confirmation are separate writes.
- **Bulk series addition defaults only verified, shelf-known missing entries to
  Wishlist.** It deduplicates by `corpusId` and rolls the whole batch back if an
  entry cannot be represented honestly.
- **Deleting a series or universe unlinks dependent records rather than deleting
  the works.** Reading-order rows owned by the deleted context are removed.

## Phase 7 note and link contract

Phase 7 required no migration: the additive `note`, `noteLink`, and `tag`
records already carry the complete persisted shape. In this contract,
“attachment” means a linked work represented by `noteLink`; there is no binary
file or media attachment entity.

- A note write, its work links, its tags, and all affected tag usage counts are
  committed in one Dexie transaction. Every linked work ID is validated before
  commit, and a failed write rolls back the complete change.
- Tag names are trimmed, resolved case-insensitively, and deduplicated before a
  note is saved. `tag.usageCount` counts active works plus active notes.
- Note reads hydrate linked works and visible tags in batches. The Notes feed is
  pinned-first, then newest-updated-first. Local library search matches note
  title, body, tag names, and linked work titles.
- Note deletion is soft deletion. Restore clears `deletedAt`; permanent delete
  removes the note and its links and refreshes tag counts. Empty Trash and the
  next-launch expiry sweep include notes.
- Soft-deleting a work leaves `noteLink` rows intact for lossless work restore.
  Permanently purging a work removes only its links. Notes remain reader-owned
  records and are not deleted with a work.
- The existing backup/export contract already includes notes, links, pin state,
  and tags, so no backup-format change was needed.

## Phase 8 archive, restore, and import contract

Phase 8 requires no Dexie migration. The durable database shape stays at
`SCHEMA_VERSION = 2`; a complete archive is an outer format around those rows.

- `manifest.json` identifies `ex-libris-backup` version 1, schema/database/app
  versions, creation instant, automatic/manual kind, table counts, and the
  work-to-cover entry map.
- `data.json` contains works, axes, relationships, authors, notes and links,
  named reading orders and entries, tags, sessions, settings, and count totals.
  Its read is one Dexie transaction. `settings.aiApiKey` is always absent.
- `covers/` contains every `coverSource === "user"` file and no API cover.
  Restore assigns each cover a new unique OPFS path before committing its Dexie
  pointer. A failed database write removes those new files; a successful
  replacement removes only the superseded prior user-cover files.
- Automatic archives live under OPFS `backups/`, are due after 48 hours, and
  rotate lexically by millisecond-bearing local filename to the newest ten.
  `lastAutoBackupAt` advances only after the file closes successfully.
- Merge preserves current device settings and resolves imported tag-name
  collisions to the current canonical ID. Replace first creates a safety
  archive whenever any non-settings table contains data, then clears and writes
  all tables in one Dexie transaction.
- Catalogue installation fields, backup timestamps, and `aiApiKey` are local
  device state during both restore modes. A schema-v1 JSON backup is normalized
  centrally with empty reading-order collections before validation.
- Paste and CSV imports become `NewWorkInput[]` only after the confirmation
  screen. `createWorks` validates all titles first, resolves authors/tags, writes
  the entire batch in one transaction, and refreshes denormalized tag counts
  inside that boundary.

## Phase 10 tag-maintenance contract

Phase 10 requires no migration or backup-format change. It maintains the
existing `tag`, `work.tagIds`, and `note.tagIds` records transactionally.

- Rename trims the requested name and updates the existing tag identity. If the
  normalized destination already belongs to another tag, the operation becomes
  an explicit merge rather than violating the unique index.
- Merge replaces the source ID across every active or soft-deleted work and
  note, deduplicates each ID list, combines group membership into the
  destination, removes the source, and refreshes active usage counts inside one
  Dexie transaction.
- `tag.usageCount` remains the count of active works plus active notes. The
  maintenance read separately computes soft-deleted references so the UI can
  distinguish `unused` from `in Trash`.
- Deletion is allowed only when no work or note, active or soft-deleted,
  references the tag. This preserves lossless Trash restore and never performs
  automatic cleanup.
