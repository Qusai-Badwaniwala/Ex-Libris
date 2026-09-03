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

**Phase 0 complete. Phase 1 part done. Phase 2 built and partly run. Gate green.**

The app runs and is usable end to end for one job: you can open it for the first
time, name the bookplate, add a work by hand, find it on its shelf, change
everything about it, log reading against it, delete it and get it back.

**Built in Phase 1 so far:** the splash, the welcome screen, the bookplate, Home
(Continue strip, Shelves, Everything row, the three figures, the theme
switches), the format screen with sort and status filter, book detail, the
status picker, the edit sheet, the reading-session sheet, the genre editor, the
add-by-hand sheet, the drawer, the bottom nav, the FAB and its two doors, and
Trash with restore, per-item purge and empty.

Also built: the Wishlist with Surprise me, Settings as a ruled ledger (owner
name, theme, default views, export, storage, content warnings), and About. Three
of the four nav tabs are real screens now; only Stats shows the placeholder.

**Still to build in Phase 1:** the Everything screen with its genre filter, the
four-step spotlight tour after the bookplate, tag editing and tag housekeeping
(B9), and manual series and universe editing (B5). Per-axis entry (B4) belongs
with the axes in Phase 6. The unbuilt screens land on a mono-voiced "not built
yet · phase N" panel rather than a plausible-looking empty state, so the app
never claims to do something it cannot.

**Deferred with a reason, not silently:** B1, the manual cover override, moves
to Phase 4. A user-supplied cover and a fetched one share the same store,
downscale and colour-extraction path, and building that path twice is how the
two diverge.

**Phase 2 — the corpus pipeline** lives in `pipeline/` and is run with
`npm run pipeline`. Nine resumable, checkpointed stages. Zero new dependencies:
Node 24 ships SQLite 3.50 with FTS5 and the exact tokenizer SCHEMA §10 names,
and it strips TypeScript natively. AniList and MangaDex have been run for real;
Open Library and Wikidata are written and verified but not run, because that is
a 16.2 GB download and the phase gate says to report first. Read
`docs/PIPELINE-NOTES.md` before touching any of it — especially the section on
AniList returning the comic rather than the novel.

Measured on 2026-09-03, not estimated:

|                         |                                                                    |
| ----------------------- | ------------------------------------------------------------------ |
| unit tests              | 112 passing, 8 files                                               |
| end-to-end tests        | 11 passing against a production build, as one journey              |
| structural checks       | 5 passing                                                          |
| JS bundle               | 396 kB raw, **120.3 kB gzipped** (budget: 250 kB)                  |
| corpus, sample build    | 3,722 works, 4.6 MB — 1,275 bytes/work, ~608 MB projected at 500k  |
| corpus typeahead        | 0.15–0.55 ms for a 3-character prefix (budget 50 ms)               |
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
`npm run icons` (regenerates the three PNG app icons from `scripts/icon.svg`),
`npm run pipeline` (the corpus pipeline — read `docs/PIPELINE-NOTES.md` first).

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
docs/              These files. ENGINE-BRIEF.md is the original brief;
                   PIPELINE-NOTES.md is required reading before running the
                   corpus pipeline.
pipeline/          The build-time corpus pipeline. NOT part of the app bundle —
                   nothing in src/ imports it, and the bundle hash is unchanged
                   by its presence. Run with `npm run pipeline`.
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

1. **Answer Q-023, the corpus size ceiling.** A real build measured 1,275 bytes
   per work, projecting to ~608 MB at 500k — three to six times the brief's
   guess. Three options are laid out in `OPEN-QUESTIONS.md`; nothing else in
   Phase 2 should run until one is picked, because a full `acquire` is 16.2 GB
   and hours.
2. **Finish Phase 1's remaining screens.** Tag editing and housekeeping (B9),
   manual series and universe editing (B5), the Everything screen with its genre
   filter, and the four-step spotlight tour. `repo.setSeries`, `seriesByName`,
   `tagByName` and `refreshTagCounts` all exist and are tested; what is missing
   is the UI.
3. **Phase 3 must show `format_hint` in the add flow.** Not a nicety — see
   PIPELINE-NOTES. AniList returns a 96-chapter manhua for "Reverend Insanity"
   where the novel is 2,334 chapters, so a match offered without its format
   hands the reader a number wrong by 24x.

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
