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

**Phase 0 (Foundations) is complete and the gate is green.** Nothing from
Phase 1 has started.

What runs today: `npm run dev` opens a diagnostics panel in the mono developer
voice — not an app screen, and deliberately impossible to mistake for one. It
reports the real state of every foundation: IndexedDB, an OPFS write/read/delete
round trip, `storage.persist()`, storage usage, the loaded contract (12 genres,
242 tags), the live theme, and the navigation stack. `src/ui/App.tsx` is deleted
in Phase 1 and replaced by the real Home screen.

Measured on 2026-09-03, not estimated:

|                         |                                                                    |
| ----------------------- | ------------------------------------------------------------------ |
| unit tests              | 44 passing, 5 files                                                |
| end-to-end tests        | 6 passing against a production build                               |
| structural checks       | 5 passing                                                          |
| JS bundle               | 309 kB raw, **97.5 kB gzipped** (budget: 250 kB)                   |
| CSS bundle              | 21.3 kB raw, 4.1 kB gzipped                                        |
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

1. **Phase 1 · Core library.** Port Home, the format screen, detail, the
   by-hand add sheet and Trash from `design/Ex Libris.dc.html`, faithfully. The
   prototype has no CSS classes — every style is an inline `var(--token)` object
   — so porting is mechanical. The only translation needed is `style-hover`,
   `style-focus` and `style-active`, which are prototype-specific attributes
   with no inline-style equivalent; they become real CSS rules.
2. **Build the audit list into Phase 1** (see `DECISIONS.md` E-009). A1–A6,
   B1, B4–B7, B9 and all of C. The largest of these is an "Edit this work" sheet
   covering status, format, title, author, progress total and unit, and cover —
   none of which the design package has a control for, and without which the app
   cannot be used.
3. **Read `design/Ex Libris.dc.html` end to end before porting.** It has been
   read structurally and by screen, not line by line.

---

## Anything broken or half-finished

Nothing is broken. Two things are deliberately dormant and documented:

- `work.rating` exists in the type and no screen sets it. The six axes do the
  job; the field stays so a restored backup from any build is not lossy.
- `work.isTranslated` exists and no control sets it. See Q-017 — the owner
  deferred the translation axis and the two readings of that answer differ.

The app icon in `public/icons/` is assembled from the bookplate frame in the
design package because Claude Design never produced one. It is conservative and
correct, and it is the one piece of Phase 0 that wants the owner's eye (Q-018).
