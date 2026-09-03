# HANDOFF.md

Written for someone with no memory of the conversation. Read this first, then
`OPEN-QUESTIONS.md`. Update both before the end of every session.

**Ex Libris** — a personal reading tracker PWA for one person. Mobile-first,
offline-first, single user, no accounts, no cloud, no cost. It tracks books, web
novels and manhwa in one library.

---

## What this project refuses to be

- **No cloud, no account, no sync, no telemetry, no analytics.** Every byte of
  user data lives on the device. The network is used for metadata lookups, cover
  images and the one-time catalogue download, and for nothing else.
- **No gamification.** No streaks, no badges, no congratulation, no
  notifications. Finishing a book is acknowledged once, quietly, and never
  celebrated.
- **No paid dependency.** Nothing with a credit card attached, ever.
- **Finished is never rendered as diminished** — no strikethrough, no grey, no
  reduced opacity. It is the shelf the owner should be proudest of.

---

## Where the work stopped

**Phase 0 is complete. Phase 1 is PART DONE and the gate is green.**

The app runs and is usable end to end for one job: you can open it for the first
time, name the bookplate, add a work by hand, find it on its shelf, change
everything about it, log reading against it, delete it and get it back.

**Built in Phase 1 so far:** the splash, the welcome screen, the bookplate, Home
(Continue strip, Shelves, Everything row, the three figures, the theme
switches), the format screen with sort and status filter, book detail, the
status picker, the edit sheet, the reading-session sheet, the genre editor, the
add-by-hand sheet, the drawer, the bottom nav, the FAB and its two doors, and
Trash with restore, per-item purge and empty.

**Still to build in Phase 1:** Wishlist (with Surprise me), Settings (which
carries audit items B7, C1, C3, C4), About, the Everything screen with its genre
filter, the four-step spotlight tour after the bookplate, tag editing and tag
housekeeping (B9), manual series and universe editing (B5), and per-axis entry
(B4). The nav bar's other three tabs currently land on a mono-voiced
"not built yet · phase N" panel rather than on a plausible-looking empty state,
so the app never claims to do something it cannot.

**Deferred with a reason, not silently:** B1, the manual cover override, moves
to Phase 4. A user-supplied cover and a fetched one share the same store,
downscale and colour-extraction path, and building that path twice is how the
two diverge.

Measured on 2026-09-03, not estimated:

|                         |                                                                    |
| ----------------------- | ------------------------------------------------------------------ |
| unit tests              | 84 passing, 6 files                                                |
| end-to-end tests        | 7 passing against a production build, as one journey               |
| structural checks       | 5 passing                                                          |
| JS bundle               | 378 kB raw, **113.4 kB gzipped** (budget: 250 kB)                  |
| service worker precache | 55 entries, 5.4 MB (mostly the 13 illustrations and 21 font files) |

---

## How to run it

```
cd "H:\Ex libris Project\Website"
npm install          # first time only
npm run dev          # http://localhost:5173
npm run gate         # the full gate — must pass before anything is "done"
```

Other scripts: `npm run build`, `npm run preview`, `npm run test:watch`,
`npm run icons` (regenerates the three PNG app icons from `scripts/icon.svg`).

**The gate is one chain and it is not optional:**

```
format:check → lint → typecheck → check:tokens → unit tests → e2e → build
```

First run of the e2e suite on a new machine needs `npx playwright install chromium`.

### Environment gotchas — read these before losing an hour

- **Never run `npm run build` while `npm run dev` is running.** The build
  overwrites what the dev server is serving and the site starts 500ing.
- **OPFS and the service worker both need a secure context.** `localhost` counts;
  a bare LAN address like `http://192.168.1.x:5173` does **not**. Opening the dev
  server on the phone over wi-fi will start, and then silently persist nothing.
  To test on the phone properly, use a tunnel that terminates TLS, or Chrome's
  `chrome://flags/#unsafely-treat-insecure-origin-as-secure` with the LAN origin
  added. This is the single biggest difference between testing here and testing
  on the device.
- **Heredocs are unreliable in this shell.** Write source files with an editor
  tool, not `cat > file <<EOF`. Multi-line commit messages go in a file and use
  `git commit -F`.
- **Prettier must never touch `src/styles/tokens.css` or
  `src/data/taxonomy.json`.** Both are in `.prettierignore`; both are verbatim
  copies of the design contract and formatting them counts as drift.
  `npm run check:tokens` fails if either drifts.

---

## How it is laid out

```
design/            The handoff package from Claude Design, vendored verbatim.
                   NEVER EDITED. It is the contract, and check:tokens proves
                   the copies in src/ still match it.
docs/              These files. ENGINE-BRIEF.md is the original brief.
scripts/           check-tokens.mjs (structural gate), make-icons.mjs, icon.svg
src/db/            schema.ts (the contract as types), db.ts (Dexie +
                   migrations), keys.ts (sort keys), dates.ts (local calendar)
src/storage/       opfs.ts, persist.ts
src/router/        router.ts — screens, sheets, and the Android back gesture
src/data/          taxonomy.json (verbatim) + taxonomy.ts (typed accessors)
src/styles/        tokens.css (verbatim) + base.css (ported from the prototype)
src/ui/            App.tsx (Phase 0 panel, deleted in Phase 1), theme.ts
tests/unit/        vitest, against fake-indexeddb
tests/e2e/         playwright, against a production build on localhost:4173
```

---

## Rules this codebase holds itself to

1. **The design package is the contract.** `design/` is never edited. Anything
   in `src/` copied from it is byte-compared by `check:tokens`. If the design
   needs to change, that goes to the owner first.
2. **Nothing hardcodes a colour or a duration.** `check:tokens` scans every
   source file and fails on a literal hex or `NNNms`. Use tokens.
3. **Nothing derives a calendar day by slicing an ISO string.** Storage is UTC;
   every question the app asks is local. Use `localDay` / `localYear` /
   `yearsTracked` from `src/db/dates.ts`. `check:tokens` enforces this.
4. **A migration may only add.** `MIGRATIONS` in `src/db/db.ts` is the single
   list; append, never edit a shipped entry. A missing field must resolve to the
   behaviour that user already had, decided in the upgrade function, not at
   every read site.
5. **Collecting nothing is a failure.** `check:tokens` fails if it scans zero
   files; vitest fails if it finds no tests.
6. **Every test has been watched to fail.** See `progress.md` for the list of
   defects that were reintroduced to prove it.

---

## The next three concrete actions

1. **The Wishlist screen and Settings.** Settings carries four audit items on
   its own: the owner name has to become editable (B7), "Show content warning
   tags" is filed under the wrong heading (C1), "Export a copy" has no handler
   (C3), and there is no storage-usage row in an app that will hold a
   several-hundred-megabyte index (C4). `storageUsage()` in
   `src/storage/opfs.ts` already returns what that row needs.
2. **Tag editing, and then tag housekeeping (B9).** The tag picker is a full
   screen over 242 seeded tags in 7 groups — see design/COMPONENTS.md "Tag
   picker" for its exact shape. `repo.tagByName` and `refreshTagCounts` are
   already in place and tested.
3. **Manual series and universe editing (B5).** `repo.setSeries`,
   `seriesByName` and `universeByName` exist and are tested; what is missing is
   the sheet and a way to reach a series page other than through a work that
   already belongs to one.

---

## Anything broken or half-finished

Nothing is broken. Beyond the Phase 1 list above, two things are deliberately
dormant and documented:

- `work.rating` exists in the type and no screen sets it. The six axes do the
  job; the field stays so a restored backup from any build is not lossy.
- `work.isTranslated` exists and no control sets it. See Q-017 — the owner
  deferred the translation axis and the two readings of that answer differ.

The app icon in `public/icons/` is assembled from the bookplate frame in the
design package because Claude Design never produced one. It is conservative and
correct, and it wants the owner's eye (Q-018).

**One design behaviour to raise with the owner, not a bug:** a work whose
position reaches its published count renders its progress as "Chapter 2,334
published" with a full segmented track — the design's own rule (D-009, D-105) —
while the status pill still reads whatever is stored, usually Reading. Both
statements are true and the screen makes the reader reconcile them. Recorded as
Q-022 rather than changed, because it is a design decision and not mine.
