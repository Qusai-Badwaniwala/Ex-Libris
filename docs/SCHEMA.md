# SCHEMA.md — the live data contract

**Version 2 · 2026-09-03**

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

### Deliberately dormant

Two fields are in the type and nothing writes them. Both stay so a backup
written by any build restores without loss.

- `work.rating` — the six axes do this job better. No screen sets it.
- `work.isTranslated` — the translation axis is deferred. See
  [OPEN-QUESTIONS](OPEN-QUESTIONS.md) Q-017.

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

| table            | key and indexes                                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `work`           | `id`, `status`, `format`, `seriesId`, `universeId`, `sortTitle`, `dateAdded`, `dateFinished`, `deletedAt`, `[format+status]`, `*genres`, `*tagIds` |
| `axisRating`     | `workId`                                                                                                                                           |
| `series`         | `id`, `sortName`, `universeId`, `source`                                                                                                           |
| `universe`       | `id`, `name`, `source`                                                                                                                             |
| `author`         | `id`, `sortName`, `name`                                                                                                                           |
| `note`           | `id`, `updatedAt`, `pinned`, `deletedAt`, `*tagIds`                                                                                                |
| `noteLink`       | `[noteId+workId]` (primary), `noteId`, `workId`                                                                                                    |
| `tag`            | `id`, **`&normalizedName`** (unique), `usageCount`, `*groups`                                                                                      |
| `readingSession` | `id`, `workId`, `at`                                                                                                                               |
| `settings`       | `id`                                                                                                                                               |

Three of these are doing more than lookup:

- **`&normalizedName`** is unique, so the merge rule in v1 §7 is enforced by the
  store rather than remembered by every call site.
- **`[noteId+workId]`** is the primary key, so attaching the same note to the
  same work twice cannot produce a second link.
- **`*genres` and `*tagIds`** are multi-entry, so genre filtering over a large
  library is an index lookup rather than a scan.

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
