# progress.md

Appended per phase. What was built, what was decided differently and why, what
broke and how it was found, and what was tried and abandoned.

---

## Phase 0 · Foundations — 2026-09-03

### Built

Vite + React 19 + TypeScript, strict, with `noUncheckedIndexedAccess`. PWA via
`vite-plugin-pwa` with a Workbox service worker, a manifest carrying the share
target, and three generated icons. Dexie schema implementing the data contract
exactly, with a single-list migration harness. OPFS wrapper, `storage.persist()`,
storage usage reporting. A hand-rolled router over the History API that gives the
Android back gesture correct behaviour. Self-hosted typefaces. `tokens.css` and
the taxonomy vendored verbatim and byte-compared in the gate. A Phase 0
diagnostics panel that reports every foundation's real state.

Measured at the end of the phase, not estimated: 44 unit tests, 6 end-to-end
tests, 5 structural checks, 97.5 kB gzipped JS against a 250 kB budget.

### Decided differently from the brief, and why

- **The engine brief's §7 search model was superseded by the design's D-055.**
  The brief describes one bar merging library and catalogue results. The finished
  design splits them: search is a lens over the library only and never touches
  the catalogue, which lives behind the FAB. The design package wins by standing
  instruction. The consequence for the schema is that `SearchResults` §9.1 is now
  the catalogue sheet's payload and the library search screen needs its own
  return shape — to be written in Phase 1, not guessed at now.
- **Seven schema changes** (E-001 to E-007) were proposed to the owner and
  approved before any code was written. All are additive except two deliberate
  removals.
- **No router library.** Sixty lines over the History API, because the app is a
  screen plus a sheet stack rather than a nested route tree.

### What broke, and how it was found

- **`installHistory` was not idempotent.** Found because a router test failed on
  its _second_ case, not its first — two `popstate` listeners meant one back
  press unwound two layers. Would have appeared in development as "the back
  gesture sometimes skips a screen", caused by React StrictMode and by every HMR
  reload, and would have been very hard to attribute. Fixed at the source.
- **Dates were being read on the UTC calendar.** Found by _looking_ at the
  diagnostics panel at 01:50 IST and seeing "first tracked 2026-09-02" on the
  3rd. No test caught it and no test would have. The same defect on 1 January
  drops a book out of "finished in 2026". Fixed by making `src/db/dates.ts` the
  only way to ask for a day or a year, and by adding a structural check that
  fails the build on `.slice(0, 4|7|10)` anywhere else.
- **A 404 on `/favicon.ico`.** Found by reading the console after opening the
  built app by hand. Fixed with a real favicon link, and an end-to-end test that
  now refuses to tolerate any console error or 4xx response at all — which is
  the check that would have caught it.
- **Prettier silently reformatted the vendored `taxonomy.json`,** which is a
  verbatim copy of the design contract. Caught by `check:tokens` within an hour
  of that check being written. Both contract copies are now in `.prettierignore`.
- **The first version of the date check was dead on arrival.** It gated on an
  identifier matching `\bAt\b`, which never matches inside `firstTrackedAt`
  because there is no word boundary there. It passed against the very defect it
  was written for. Found by deliberately reintroducing that defect and watching
  the check stay green.

### Every test was watched to fail

Four load-bearing assertions had their defect reintroduced and were confirmed to
go red, then restored:

| defect reintroduced                                           | test that caught it                                     |
| ------------------------------------------------------------- | ------------------------------------------------------- |
| pop the screen before the open sheet                          | router · back closes the topmost sheet first (2 tests)  |
| gate a tag on any warning membership rather than warning-only | taxonomy · Body Horror survives with warnings off       |
| drop the `&` from `tag.normalizedName`                        | db · refuses a second tag with the same normalised name |
| match a leading article as a prefix rather than a whole word  | keys · "Theodore Rex" is not filed under "odore"        |

The two structural checks were proven the same way: `tokens.css` was corrupted
and the drift check went red; a hardcoded `#ff0000` and `250ms` were added to
`base.css` and both were reported with the right line number.

### Tried and abandoned

- **Writing source files with shell heredocs.** They fail silently on this
  machine at any real size — the first attempt at `src/db/schema.ts` produced a
  parse error and no file. Everything since is written with an editor tool.
  Recorded in `HANDOFF.md` so it is not retried.
- **Gating the date check on a date-looking identifier.** Too clever and it did
  not work. Any slice to 4, 7 or 10 characters is now flagged regardless of what
  it is slicing; a false positive costs one comment and a missed one costs a
  wrong year on screen.

### Left deliberately undone

- `work.rating` and `work.isTranslated` are in the type and nothing sets them.
  Both are documented as dormant in `src/db/schema.ts`, both stay so a restored
  backup is never lossy.
- The app icon needs the owner's eye (Q-018).
- `design/Ex Libris.dc.html` has been read structurally and screen by screen,
  not line by line. That full read happens at the start of Phase 1, before
  porting.

---

## Phase 1 · Core library (part done) — 2026-09-03

### Built

The app is runnable and usable end to end for one job. Splash, welcome,
bookplate, Home, the format screen, book detail, Trash, the drawer, the bottom
nav, the FAB and its two doors. Sheets: add by hand, edit this work, status,
reading session, genre editor.

Underneath: `src/db/repo.ts` (every read and write against the library, with the
rules that span two tables), `src/db/derive.ts` (a faithful port of the
prototype's `deco()`), and `src/ui/store.ts` (live Dexie queries, so a status
change repaints everywhere at once).

Measured, not estimated: 84 unit tests, 7 end-to-end tests as one journey,
113.4 kB gzipped against a 250 kB budget.

### The audit items that landed

A1 status, A2 format, A3 title and author, A4 totals and unit and position
(A5 was Phase 0), B6 sort and status filter. A6 needs notes and lands in
Phase 7. B1 moves to Phase 4 with the cover pipeline, stated rather than
quietly dropped.

### Decided differently, and why

- **`setFormat` does not touch `progressUnit`.** Moving a work from Books to
  Novels would otherwise turn a page count into a chapter count — the number on
  screen changes meaning without changing value, which is the worst kind of
  quiet edit. The unit is a separate control on the same sheet, and the sheet
  says so out loud.
- **Correcting a position records no session.** `setProgressCurrent` moves the
  work; `logSession` moves it AND records what was read. Without the split,
  fixing a mis-tap would inflate "chapters read" and there would be no way to
  bring it back.
- **The trash screen no longer promises a countdown.** There is no background
  job, so thirty days can only be enforced on open. The copy says that.
- **Unbuilt screens say so in the mono developer voice.** A plausible empty
  state on an unbuilt screen is indistinguishable from one whose data failed to
  load.

### What broke, and how it was found

- **`nav.close()` then `nav.open()` is a race that loses.** The FAB's "Add by
  hand" door opened nothing when tapped faster than a person taps. `close()`
  rewinds history and popstate arrives on its own schedule, so the queued
  `open()` landed BEFORE the pop that then cancelled it. Found by an end-to-end
  test failing where a hand-driven click had worked. Fixed with `nav.swap()`
  and `nav.closeAndPush()`, which reuse the existing history entry — one layer,
  one entry — so the sequence cannot race at all.
- **`Field` rendered a `<label>` with no `htmlFor`.** A screen reader read
  "edit text" with no name, and the input was reachable only by placeholder.
  Found because Playwright could not find the field by its label either.
- **Two controls on the detail screen were both named "Edit"** — the header one
  and the genre row's. A screen reader reads "Edit, Edit". The visible words are
  the design's and are unchanged; the accessible names now differ.
- **The two-column progress row overflowed the sheet.** A flex item's default
  `min-width` is `auto`, which is its content width, so an input with a wide
  placeholder refused to shrink and pushed the second column past the right
  edge. Found by looking at a screenshot at Pixel 7 size, not by any test.
- **The service worker served the previous build twice** while checking work by
  hand, once silently. Both times the fix was to unregister it and clear the
  Cache Storage. This is the standing hazard in this project and it is in
  HANDOFF.md.

### Every new assertion was watched to fail

Five defects reintroduced in `src/db/repo.ts` and `src/db/derive.ts`, each
confirmed to turn the suite red, then restored:

| defect reintroduced                                    | what it would have shipped                         |
| ------------------------------------------------------ | -------------------------------------------------- |
| stop clearing `dateFinished` when a finish is undone   | a mis-marked book counts toward "finished" forever |
| make `setFormat` rewrite the progress unit             | a page count silently becomes a chapter count      |
| let `logSession` finish an ongoing serial at its count | the app asserts an ending the author never wrote   |
| make `purgeWork` delete notes instead of unlinking     | the reader's own writing lost with a record        |
| remove the clamp on the progress fill                  | a bar wider than its own track                     |

### Left deliberately undone

Wishlist, Settings, About, Everything, the spotlight tour, tag editing, tag
housekeeping, manual series editing, and per-axis entry. All are Phase 1 and all
are listed in HANDOFF.md. The axis line is absent from detail until Phase 6
rather than stubbed: a row of type that says "tap to change it" and does not is
the switch-with-nothing-behind-it the design itself refuses.

### Phase 1, second pass — Wishlist, Settings, About, and Q-022

**Built.** The Wishlist with Surprise me, Settings as a ruled ledger, About as
the bookplate kept. Three of the four nav tabs are now real screens; only Stats
still shows the honest placeholder.

**Q-022 settled, option 2.** Reaching the last chapter released so far of an
ongoing serial now ASKS, once, at exactly that moment: the session sheet does
not close, it becomes the offer. Declining leaves the work as Reading and the
question is not asked again. `status` still describes the reader and is never
derived — the app offers, it does not decide.

**Audit items that landed:** B7 the owner's name is editable, C1 content
warnings moved out of the "Help from a model" heading and under Tags, C3 Export
a copy has a real handler, C4 a storage row with real numbers. Two more found
while building and fixed the same day: the Wishlist's Start button had no
handler in the design and its rows were not tappable, so an entry could be
removed but never opened or started.

**Export.** SCHEMA §11's finished shape is a .zip with covers and a manifest,
and that is Phase 8. What ships now is data.json alone, which today is the WHOLE
library — there is no cover pipeline until Phase 4, so nothing is left out. It
is in Phase 1 rather than Phase 8 because it is the only thing standing between
a lost phone and a lost library.

### What broke, and how it was found

- **The Surprise card was not in the history stack.** Built as local React
  state, which quietly exempted it from the one rule the router exists to
  enforce: every modal surface owns a history entry. The back gesture could not
  dismiss it and neither could Escape, so its scrim trapped the reader on the
  screen. Found by a screenshot run that timed out clicking a tab underneath it.
- **`nav.swap()` on an empty overlay stack created an unclosable overlay.**
  `[].slice(0, -1)` is still `[]`, so the sheet appeared with no history entry
  behind it — the exact defect the router exists to prevent, reintroduced by a
  helper written to prevent it. It now delegates to `open()`.
- **The first unit test for that guard was dead on arrival.** This suite
  dispatches `popstate` by hand, so "back closes it" passes whether or not an
  entry was ever pushed. The assertion has to be on `history.length`, which is
  the thing that actually differs.
- **A meta separator orphaned onto wrapped lines.** The rule was rendered
  BEFORE each part after the first, so a wrapped line began with a hairline and
  no word. The design had already solved this for the axis line (D-010, "the
  rule trails its word rather than leading the next one") and the same shape
  applies to every hairline-divided meta string.
- **The add sheet ignored the screen you opened it from.** Adding from the
  Wishlist defaulted to Reading, and adding from the Books shelf defaulted to
  Novels counted in chapters. The screen you were on says what you meant.

**The API key is never written to a backup** (SCHEMA §11), and that assertion
was watched to fail before it was trusted: a backup is a file the reader may put
in a cloud drive, and a credential inside it travels wherever the file goes.

---

## Phase 2 · The corpus pipeline — 2026-09-03

### Built

Nine stages under `pipeline/`, run by `npm run pipeline`. Every one is resumable
and idempotent: a checkpoint per stage, JSONL between stages, and a rerun of a
finished stage is a no-op. Sources: Open Library (dumps), Wikidata (paged
SPARQL), AniList (paged GraphQL), MangaDex (paged REST). Then merge, derive,
build to SQLite with FTS5, and emit a manifest with a SHA-256.

Zero new dependencies. Node 24 ships SQLite 3.50 with FTS5 and the exact
tokenizer SCHEMA §10 names, and it strips TypeScript natively, so neither a
native SQLite module nor a TS loader was needed. Both were verified before the
pipeline was written rather than assumed.

### Run for real

AniList 40 pages and MangaDex 20 pages, merged and built: 4,000 source rows →
3,722 works → `corpus.sqlite` at 4.6 MB, with 72 series covering 177 works. The
Open Library and Wikidata stages are written and their sizes verified against
the live servers, but not run — that is a 16.2 GB download and hours, and the
brief says to report before building further.

### The two numbers that decide the shape of it

- **1,275 bytes per work**, projecting to about **608 MB at 500k works** —
  three to six times the brief's 100–200 MB guess. The sample is all comics with
  long synonym lists, so treat it as an upper bound until stage 2 runs.
- **Typeahead 0.15–0.55 ms** for a three-character prefix, against a 50 ms
  budget. Measured on the built file with node:sqlite; Phase 3 has to re-measure
  through wa-sqlite over OPFS, which is a different engine on different storage.

### What reading one sample changed

AniList holds the **comic**, not the novel, for Chinese and Korean web fiction.
Reverend Insanity comes back as a 96-chapter CANCELLED manhua where the novel is
2,334 chapters; Lord of the Mysteries as a 65-chapter manhua where the novel is
1,432. Shadow Slave and Kill the Sun are absent entirely. Nothing about this was
guessable from the API documentation, and a pipeline written without checking
would have shipped a chapter count wrong by a factor of twenty-four with no
signal that anything was off.

### What broke, and how it was found

- **Cross-source merging was far too strict.** Querying the built corpus found
  256 duplicate title groups, 6.5% of it — AniList and MangaDex romanise author
  names differently, so a title+author key almost never agreed across them. A
  second pass on title alone fixed 240 of them; the 16 left were each checked by
  hand and are all genuinely different works.
- **A test passed for the wrong reason.** "Never merge two records from the same
  source" used records with differing countries, so deleting the rule left the
  test green — the country check was catching it. Rewritten with same-source,
  same-country, same-format records so only the rule under test can reject them.
  Found by mutation, not by reading.
- **Node's ESM needs real file extensions** even when stripping types, so every
  import inside `pipeline/` ends in `.ts`. The first run failed outright.
- **The pipeline was not being typechecked at all.** `tsconfig.json` included
  `src`, `tests` and `scripts` but not `pipeline`, so `tsc --noEmit` passed over
  it silently. Two real type errors were waiting behind that.

### Tried and abandoned

- **Bulk web-novel sources.** No permissively licensed dataset exists.
  `shaido987/novel-dataset` has 24,639 NovelUpdates novels and no LICENSE file;
  NovelUpdates and Royal Road both return 403 to an automated request for
  `robots.txt` alone. Full write-up, with the alternatives, in
  `PIPELINE-NOTES.md`.
- **Deriving `total_entries` from relation clusters.** What the corpus knows is
  not what exists, and a wrong denominator under a completion ring is the one
  thing SCHEMA forbids outright.
