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

---

## Codex transition audit · 2026-09-04

### Audited and recovered

- Inventoried the workspace and the 222 project-relevant files outside generated
  dependency/build directories. `Website/` is the actual Git repository; the
  workspace root is only its container.
- Read the engineering handoff, progress, open questions, decisions, schema,
  engine brief, pipeline notes, build/test configuration, core runtime storage,
  routing, app shell, and the Phase 2 pipeline implementation.
- Read the immutable design handoff and its final overrides. The original
  workspace delivery and `Website/design/` were compared by SHA-256; all
  mirrored files are identical.
- Found no project-local `.claude/` directory and no `.claude/rules/` folder.
  The Claude configuration is global at `C:\Users\qusai\.claude`; its safe
  settings, global instructions, skills, hooks, plugin inventory, and the
  project-specific transcript were audited. Credentials were deliberately not
  read or copied.
- Recovered the final Phase 2 answer and the owner's reply from the transcript,
  because no new screenshot was present in the workspace or conversation. The
  two answered questions are now E-040 and E-041 instead of stale open items.

### Codex workspace setup

- Added `H:\Ex libris Project\AGENTS.md` as the durable Codex instruction file.
  It captures authority and document precedence, project/product boundaries,
  the current checkpoint, stack, design fidelity rules, storage and migration
  invariants, the exact Phase 3 contract, the full verification gate, licensing
  and zero-cost policy, and the session-handoff protocol.
- Compared 27 standalone Claude skills with the Codex skill inventory. Twenty-
  three already exist here. The four unmatched packages were not copied
  blindly: `gstack` brings its own Bun, Git, telemetry, and synchronization
  workflow; `web-design-guidelines` fetches remote instructions at runtime;
  `i-have-adhd` and `research-first` are Claude-oriented workflow wrappers whose
  useful durable rules are already represented in `AGENTS.md`.
- Audited the 17 enabled Claude plugins and the available Codex plugin/skill
  equivalents. No third-party plugin or skill was installed during the
  transition, and no external account was connected or written to.
- No application, pipeline, schema, style, or design source file was changed.

### Verification

`npm run gate` passed after the documentation transfer:

- Prettier, ESLint, and strict TypeScript: passed.
- Five structural checks: passed across 34 source files.
- Unit tests: 112 passed across 8 files.
- Production-build end-to-end tests: 11 passed at the Android/Pixel 7 project.
- Production build: 396.45 kB JavaScript raw, 120.25 kB gzip; Workbox precache
  55 entries at 5,532.47 KiB.

Vite repeated one non-failing warning: `src/db/dates.ts` is both dynamically and
statically imported, so the dynamic import does not create another chunk. No UI
source changed in this transition, so a new visual-parity claim was not made;
the production browser journey did run as part of the gate.

### Screenshot confirmation and source re-audit

The owner supplied four screenshots of the missing final Claude exchange. They
were read at original resolution and match the transcript recovered during the
transition: Phase 2's measured results, the AniList comic/novel mismatch, the
web-novel source failure, Q-023/Q-024, and the owner's complete reply were all
captured correctly. No lost instruction was found.

The owner clarified the design boundary further: the Claude Design frontend is
not to be changed. Any visible upgrade also requires explicit permission first.
This is now E-044 and is reflected in the workspace `AGENTS.md`.

The production source permissions were then verified against current primary
documentation. This found a material issue the Phase 2 handoff had missed:
AniList prohibits mass collection and restricts competing list/tracker services.
The existing sample remains useful as a local runtime fixture but cannot ship as
the catalogue. Open Library bulk metadata and Wikidata CC0 are the permitted
offline leads; MangaDex's published API policy supports a credited, free,
ad-free integration but does not clearly grant bulk snapshot redistribution.
The recommended replacement source composition is recorded as Q-025. No source
data was downloaded and no application code changed during this re-audit.

---

## Phase 3 · Corpus runtime — in progress, 2026-09-05

### Built and proved so far

- Added schema-checked manifests with whole-file and contiguous 4 MiB chunk
  hashes, safe versioned OPFS paths, resumable ranged installation, and atomic
  active-version promotion. Old files are removed only after promotion and
  cleanup failure cannot turn a successful install into a false error.
- Added a dedicated FTS5 worker and a narrow synchronous read-only OPFS VFS.
  The corpus is never loaded into JavaScript memory and no query blocks the main
  thread.
- Pinned `@journeyapps/wa-sqlite` 0.4.2. Upstream's default WASM omits FTS5;
  this MIT-licensed PowerSync/JourneyApps build explicitly enables it and does
  not carry the newer fork's post-install download.
- Production builds mechanically reject/remove the AniList/MangaDex engineering
  fixture. Vite test mode retains it only so Playwright can exercise the real
  HTTP Range to OPFS to SQLite path.
- Ported the approved Everything/genre-filter screen over the real library and
  added local-library search data access. The new empty-state wording and the
  catalogue/add-sheet connection remain behind Q-026's visible-change approval.
- Added manifest/query/MangaDex/installer unit tests and real browser tests for
  a fresh ranged install, FTS result, exact next-chunk resume after interruption,
  and network failure with manual entry still usable.

### Defects the browser path found

- A filename carrying `?immutable=1` without the `file:` URI scheme let the VFS
  see the flag but not SQLite, which then attempted journal work against a
  read-only handle. The real OPFS test caught it.
- Upstream wa-sqlite's default artifact has no FTS5. The database opened but
  failed at its virtual table. The dependency was replaced with an exact,
  licensed FTS5 build rather than weakening the corpus schema.
- FTS5 quick-check uses a special write internally and therefore fails against
  a healthy immutable database. Full quick-check now runs in the writable build
  pipeline; runtime still requires exact chunk hashes, byte size, row count, and
  a real FTS query before promotion.
- The first worker query was 70-89 ms through the general async OPFS example.
  A purpose-built immutable synchronous VFS and prepared/JIT-warmed search path
  reduced this to roughly 46-55 ms on the development desktop, with subsequent
  runs at 1-4 ms. Physical Android remains the only acceptance measurement.

### Current verification and remaining gate

Targeted catalogue unit tests: 11 passing. The full interim project gate is
green: 123 unit tests across 10 files, 14 production-build browser tests, all
structural checks, and a normal build at 121.92 kB gzipped application
JavaScript with no corpus, worker, WASM, or test-bridge fixture assets. The final
visual comparison waits until the visible Phase 3 flow is approved and
connected. Phase 3 is not complete until Q-026, Q-027, and Q-028 are closed.

## 2026-09-05 · Phase 3 continuation (in progress)

Recorded Q-026/Q-027 approvals, accurate connection feedback and later-phase
guide ideas as E-052–E-055. Downloaded and streamed the Inventaire audit (counts
and checksum in PIPELINE-NOTES). Owner chose to retain Open Library + Wikidata,
not Inventaire, after the audit (E-056). Asked separately about the smaller
4.84 GB works/authors-only source acquisition; nothing downloaded from OL yet.

Connected library search, catalogue search, catalogue add prefill/status
confirmation, optional installation screen and Settings door. Preserved the
prototype vocabulary; unknown formats and all catalogue candidates are labelled.
Manual save now reports storage failure and prevents duplicate pending taps.

Integrity regression: corrupted OPFS bytes plus an intact resume marker failed
the new range assertion before the fix, then passed after stored-chunk rehashing.
Concurrent-opens browser test failed with the exclusive access-handle error,
then passed after worker serialization. Verification moved off the active reader
worker to preserve the atomic-update boundary. WASM added to shell precache.

Current targeted UI results: local-only library search, explicit-only online
search, and connection transitions pass. Offline cold reload reaches Home but
Chromium reports `navigator.onLine: true` despite Playwright's network being
offline. This is observed harness behavior, not proof of Internet reachability;
split cache/worker offline verification from deterministic initial-status testing.
Full gate and visual review are still pending this continuation.

## 2026-09-05 · Phase 3 completion attempt — external gates remain

Completed the approved visible Phase 3 flow without redesigning the Claude
Design frontend. Four Phase 3 journeys pass together: local-only private-library
search; catalogue install/search/add with visible format, reader-selected status,
cold offline restart and reduced motion; explicit-only MangaDex search with
stale-result cancellation; and accurate offline/reconnected notices. All
catalogue and manual fallbacks are real actions rather than placeholder controls.

Inspected local search, catalogue results and the ready index at the approved
390x720 phone size in dark and light themes. The first visual pass exposed two
clear actions in each HTML search field: Chromium's native cancel glyph plus the
app's accessible clear button. A CSS-scoped suppression removed only the native
duplicate. The second pass is clean; screenshots are under
`.impeccable/review/`. The Impeccable detector reported one existing
`transition: width` in `ProgressBar`; it is retained because the immutable
`design/MOTION.md` explicitly requires progress bars to animate only after the
reader changes the value.

Added a production-browser service-worker replacement journey. A changed worker
installs and waits while the existing session remains open, activates after the
app closes, and relaunches offline with both IndexedDB user data and the OPFS
catalogue intact. The test also proves the FTS5 WASM is in shell precache and no
catalogue response under `/corpus/` is in Cache Storage.

The independent finish review found four additional valid design-contract
regressions. The FAB had been unmounted with its own menu even though D-062 says
the menu scrim sits below it; it now remains, rotates 45 degrees into Close, and
is the shared `add-surface` source for catalogue/by-hand sheets. Small accent
text on the dark overlay measured below AA and now uses the approved readable
text tiers. Two middle-dot metadata strings now use hairline separators, per
D-007. A visible Cover reference field only stored a dormant URL for Phase 4
and was removed. Targeted browser regressions prove FAB/menu z-order,
shared-surface naming and close cleanup, no cover field, and no middle dots.

The reviewer also called matching note articles dead destinations. That change
was rejected for this phase: the current result renders the full matching note
as readable content and has no button semantics, while opening/editing notes is
the explicitly deferred Phase 7 surface. Adding a fake route or new note sheet
would violate both the no-dead-control rule and the instruction to stop before
later phases.

Re-review found one more real edge: `ViewTransition.finished.finally(...)`
could create an unhandled rejected promise when rapid navigation aborts a
transition. The single helper now consumes `ready`, `updateCallbackDone`, and
`finished` with `Promise.allSettled`, performs cleanup in one place, and avoids
a duplicate state emission if transition startup throws after invoking the
update. A deterministic Playwright probe substitutes rejected lifecycle
promises; it failed the old ownership model in review and passes with no page
error after the correction.

Mutation proof: temporarily restored the old `finished.finally(cleanup)` line.
The new browser test failed with six unhandled `AbortError: interrupted probe`
page errors. Restored the `Promise.allSettled` fix and the same test passed with
an empty page-error list.

Final gate after restoring the fix: formatting, ESLint, strict TypeScript, all
five structural checks over 50 source files, 127 unit tests across 10 files, 21
production-build Playwright journeys, and the normal production build all pass.
Production application JavaScript is 434.72 kB raw / 130.85 kB gzip; worker
75.27 kB; FTS5 WASM 842.76 kB; Workbox precache 57 entries / 6,466.43 KiB. The
normal build removed the engineering corpus fixture from `dist`. The final
Impeccable re-review returned PASS with no remaining in-scope actionable defect.
Vite's existing non-failing static/dynamic `dates.ts` import warning remains.

Hardened the production corpus path after tracing the actual runner rather than
trusting its comments. The old default `all` and `merge` commands included
AniList/MangaDex whenever their cache files existed, even though those rows are
now an engineering fixture. Production merge now accepts resolved Open Library
rows only, requires a complete Wikidata checkpoint, and ignores restricted
caches mechanically. `fixture-merge` is the explicit local-test escape hatch.

Added the missing Open Library author resolution stage. It streams and
checkpoints only referenced author names, then writes the author-searchable work
input; production merge fails when that output is missing. Fixed Wikidata
checkpoint truth: reaching a page cap is no longer “done,” resumed counts stay
cumulative, a failed page is retried, and production joins only unambiguous P179
memberships through P648 Open Library work IDs. Focused production-boundary,
identifier and author-resolution tests pass.

No Open Library source bytes were downloaded. Q-029 records the separate 4.84 GB
works/authors approval still needed; “resume” was not treated as permission for
that external transfer. No Phase 4 work was started. Q-028 still needs a physical
Android device and an under-50-ms result. Update this entry with the final gate
counts after the complete chain runs.

The required owner-review checkpoint was then built separately with
`npm run build -- --mode test` after confirming no listeners on ports 5173 or 4173. It is hosted at `http://127.0.0.1:4173/`; an HTTP request returned 200,
and `dist/corpus/corpus.sqlite` is the expected 4,825,088-byte, 3,722-work
engineering fixture. This deliberately non-shippable preview lets the owner
inspect the Phase 3 flow while the production-data and physical-phone gates
remain open. The preceding full gate used the normal production mode and
proved that this fixture is excluded from the shippable build.

## 2026-09-05 · Isolated two-concept design exercise

The owner explicitly approved the bounded 4.84 GB Open Library works/authors
transfer, with editions still excluded, then asked that a separate design task
be completed first. The transfer therefore remains not started; this is a
priority pause, not missing permission.

Recorded three Phase 4-only corrections without changing the production UI:
the missing spotlight onboarding must be restored after Welcome/Bookplate;
Books, Novels, and Manhwa need persistent book/spine markers even when empty;
and the bottom navigation may be replaced with a surprising premium treatment.
All three must extend the Claude Design system rather than redesign the app,
and nothing should add unnecessary controls, duplicate paths, or empty states.

Built two isolated, static, navigable comparison artifacts under the workspace
root `design-experiments/`, not inside the production frontend. Concept A is a
dark late-night route system with a four-stop rail; Concept B began as a cool
printed registration/index system with a five-zone thumb footer and central Add
action.
Both reuse one representative product dataset and implement Home, shelves,
Everything/filtering, detail/progress, local search, Wishlist/Surprise me,
catalogue/manual Add, Settings, catalogue management, Trash, About, and honest
later-phase placeholders. First-run Welcome and Bookplate are replayable from
About. The artifacts do not persist state or call a backend.

Automated 390×720 journeys passed for both concepts: shelf to detail, progress
change, return to Library, Add, catalogue result, and prefilled manual
confirmation. Escape dismissal, page errors, and horizontal overflow were also
checked. Phone and 1440×900 screenshots were inspected in a bounded visual
pass. The Impeccable detector returned no findings. The prototypes are served
at `http://127.0.0.1:4181/concept-a/` and
`http://127.0.0.1:4182/concept-b/`; each returned HTTP 200.

## 2026-09-06 · Two-concept correction and final review

The independent finish review found eight concrete prototype issues. Both
concepts now require the reader to choose status, preserve and expose the
catalogue candidate's actual format, and show unit, current position, total,
and publication before saving. Shelf sorting, Everything Any/All genre
matching, wishlist/note/tag search, detail tags, and a real progress-session
task were restored. Browser history now owns screens and sheets; Back and
Escape close the top layer, focus enters and stays in sheets, and returns to the
trigger. Night Route draws its format line during shelf entry and Registered
Index moves its registration cursor; reduced motion snaps both.

Previously announcement-only prototype controls now make honest state changes:
theme switches are visible, export downloads JSON, explicit online search adds
a separately labelled representative result, and Trash supports reversible
move/restore. The unused Compact rows control was removed. Contrast and small
labels were corrected, and redundant title eyebrows were removed.

Concept B's five-zone footer was replaced with the product's four stable
destinations. Its Add control was first placed persistently above the footer,
but final review showed it covering records and competing with progress. The
final version scopes a 52px square Add control to Home's ruled action register
beside local search; it is absent from shelf and detail screens. The follow-up
review returned `PASS`, remaining issues `clear`, disposition `ship`.

The expanded 390×720 Playwright journey passes both concepts: Home search,
four Concept B tabs, Everything Any/All controls, reading-session save, visible
theme state, actual JSON download, trash/restore, explicit online result,
Piranesi-to-Book handoff, unselected required status, Escape and browser Back,
focus entry/restoration, page errors, and horizontal overflow. Fresh phone and
1440×900 screenshots were inspected. Both localhost URLs still returned HTTP 200. Production application source and the approved Open Library transfer were
not touched by this isolated task.

## 2026-09-06 · Phase 3 production acquisition resumed

The owner approved the unified Phase 3-10 execution plan and explicitly asked
implementation to begin, with the working build hosted and durable documentation
kept current. Phase 3 remains a solo phase; no Phase 4 UI work has started.

Confirmed the live Open Library `latest` URLs still resolve to the approved
dated 2026-08-31 works and authors files, totaling 4,838,146,621 bytes. Retrieved
the files' published SHA-1 and MD5 values from Archive.org metadata and started
the default resumable `acquire` stage. Editions remain excluded. The existing
3,722-work review build stays hosted at `http://127.0.0.1:4173/` during source
acquisition and remains clearly an engineering fixture.

Before streaming the source, found a real durability defect: the Open Library
works transform claimed to resume but truncated its partial JSONL and replayed
from the beginning. Added a paired source-position/output-byte checkpoint,
flush-before-checkpoint boundary, uncommitted-tail truncation and safe restart
for a short output. Applied the same boundary to Wikidata and flushed author
rows before their cursor advances. The focused pipeline suite passes 23 tests;
strict TypeScript and formatting checks pass. The new tail-recovery assertion
was temporarily run with truncation removed, failed on the duplicated
uncommitted row, and passed after the fix was restored.

## 2026-09-06 · Phase 3 production core built; physical phone gate remains

Completed the approved works/authors-only Open Library acquisition in 2,122.3
seconds. The 4,058,336,593-byte works dump and 779,810,028-byte authors dump
both matched the dated Archive.org SHA-1 values before parsing; editions were
not requested.

The first full filter pass retained 9,302,140 of 41,591,088 rows and produced a
5,434,168,408-byte JSONL, proving that title/author/cover alone was not a bounded
core. That output was preserved as a measured cache artifact and not built. A
streaming distribution probe showed no usable work-level language field. The
retuned predicate keeps title, author and positive-cover records that either
have at least four subjects including fiction but not non-fiction, or are
explicit Open Library members of a completed Wikidata series result. It staged
476,612 rows; the author pass resolved 476,547, with 65 unresolved works and 9
partial coauthor records left out or honestly partial.

The Wikidata stage now fetches only P179 rows that also have P648 Open Library
work identifiers—the only rows this merge can consume—and correctly treats a
page-bounded run as incomplete. It exhausted after 8 pages with 14,440
memberships, 4,524 series labels and 8,170 explicit ordinals. Production merge
emitted 438,584 Open Library works, 2,185 series and 7,222 linked works while
leaving 352 multi-series claims unassigned rather than guessing.

Built the production database at 273,784,832 bytes (261.1 MiB), split across 66
manifest chunks, with 438,584 cover identifiers and no missing authors. The
manifest is marked `production`, lists only Open Library rows, and its declared
and actual SHA-256 both equal
`1d5c9eba8347481ab55db124378c15d1d6ac05264f7012160fc0954a0a7272c7`.

Separated the Playwright fixture mechanically. `fixture-merge` now reads only
the 4,000 AniList/MangaDex rows and `fixture-build` writes its 3,722-work,
4,825,088-byte database under `pipeline/.cache/fixture-corpus`. Test-mode Vite
validates and copies that artifact after building; normal Vite retains the
production public corpus. Rebuilding the fixture left the production checksum
byte-for-byte unchanged.

The real production quality probe found a ranking defect: raw BM25 placed
“Dunedin” above “Dune”. Exact normalized titles and then title prefixes now rank
before BM25. The worker and inspection tool share the same SQL/bindings; a unit
test covers those bindings. The hosted app visibly returns Frank Herbert's
**Dune** first.

`npm run gate` passed with formatting, lint, strict TypeScript, frozen-design
checks, 131 unit tests, 21 Pixel 7 Playwright journeys and the final production
build. The Phase 3 UI regression includes input-event to next-painted catalogue
results under 100 ms in desktop Pixel emulation. The final distributable keeps
application JavaScript at 434.72 kB raw / 130.85 kB gzip, a 75.60 kB worker and
57-entry / 6,466.75 KiB precache, while excluding catalogue bytes from Workbox.

Hosted the production build at `http://127.0.0.1:4173/`. In a clean browser it
downloaded all 66 ranges, verified and opened 438,584 works from OPFS, displayed
261.1 MiB, and searched the real index. Pixel 7-sized 412×839 light and dark
states were inspected; the approved Phase 4 shelf-marker/nav corrections remain
deliberately untouched.

Phase 3 is not called complete. No physical Android device or `adb` executable
was available, so Q-028's under-50-ms input-to-painted-results measurement is
the sole remaining gate. Phase 4 has not started. The owner's complete approved
Phase 3–10 sequence is now preserved in `docs/EXECUTION-PLAN.md` and linked from
the workspace `AGENTS.md`, rather than depending on chat history.

## 2026-09-06 · Phase 4 approval prototype started

The owner explicitly deferred physical-phone testing for now and authorized the
roadmap to continue. Q-028 remains recorded as unpassed release evidence; the
deferral was not described as a successful benchmark. Phase 4 starts alone, as
the approved execution plan requires.

The first Phase 4 deliverable is the isolated four-screen design approval
prototype on port 4184. Production UI remains untouched until the owner approves
the exact rendered Home, Everything/format shelf, Work detail, and hybrid
navigation/drawer treatment in the warm light and Claude blue-grey dark themes.
The direction retains Claude Design's shell, constellation, FAB, illustration
rules and motion language; Registered Index supplies operational hierarchy;
Night Route contributes only progress and persistent shelf-state motifs.

## 2026-09-06 · Phase 4 production implementation approved

The owner reviewed and approved the separately hosted Registered Folio
prototype, then ended the prototype-only checkpoint and authorized production
implementation. The approval includes five precise corrections: slower drawer
entry and exit, no destination separator rules, restoration of Claude's
two-action FAB bloom and Notes pencil, a neutral rather than cover-tinted Home
Continue surface with the whole record clickable, and constellation artwork
that fills the complete Home canvas.

Started the real Vite application locally at `http://127.0.0.1:5173/` for live
review. Phase 4 remains a solo phase. Cover storage/metadata, onboarding,
navigation motion, and the main production surfaces are being implemented in
parallel with non-overlapping ownership. The requested series/universe
recognition, relationship positions and whole-set add choices remain the
approved Phase 5 suggest-and-confirm work; they are not being silently folded
into Phase 4.

## 2026-09-07 · Phase 4 production checkpoint complete

Applied the approved Registered Folio system to the real PWA without editing
the immutable Claude handoff, frozen tokens, or frozen taxonomy. Restored the
five-step spotlight tour after Welcome/Bookplate; made Home's constellation
span the page; replaced Continue tint with a neutral, fully clickable record;
kept three-spine identity markers on every shelf; built the four-zone editorial
dock; slowed the Claude drawer and removed only its destination separators; and
restored the two-icon FAB bloom plus the Notes pencil.

Upgraded Everything, format lists, Detail, and the baseline spine view inside
the approved hierarchy. Everything retains real format, genre Any/All, sorting,
and virtualized rows. Format shelves keep list/spine switching and truthful
empty states. Detail keeps Claude's cover-led editing flow and adds a factual
record ledger. Baseline Notes and spine surfaces are now working rather than
dead routes, while their advanced Phase 7 and Phase 9 scope remains explicitly
deferred.

Built the OPFS cover subsystem and custom-cover UI. Cover candidates are
validated, decoded, downscaled without upscaling to about 600 px maximum width,
and stored under separate user/API namespaces before the Dexie pointer changes.
User covers beat late API results; failed writes and replacements clean their
files; work purge cleans its cover best-effort. Home, shelves, Everything,
Detail, Wishlist, Search, and Trash render from OPFS object URLs. Removed the
Workbox runtime image cache after proof, so covers are not duplicated for 30
days. Added a low-volume official Open Library work/edition metadata client
with strict parsing, ID validation, 429/`Retry-After` handling, and no guessed
edition page count. Q-020 is resolved by E-071.

During a genuine new-device visual run, React StrictMode started two settings
loads together. The previous separate get/add sequence raced into a singleton
`ConstraintError` and could leave first launch blank. Wrapped the read/create/
version update in one Dexie transaction and added a concurrency regression. The
corrected regression was observed passing; with the transaction temporarily
removed it failed with the original constraint error; the fix was then restored.

The first complete production browser run found one FAB accessibility collision:
the visible close control and invisible scrim both said `Close add menu`. Renamed
the scrim `Dismiss add menu`; its focused production journey passed, followed
by the full gate. Moved sorting helpers out of a React screen and made a private
catalogue formatting helper non-exported so live Fast Refresh no longer
invalidates those modules for non-component exports.

Verification observed on this machine:

- `npm run gate` passes with formatting, ESLint, strict TypeScript, all frozen
  structural checks across 64 source files, 153 unit tests in 13 files, 26
  Playwright Pixel 7 production journeys, and the normal production build.
- The settings mutation check failed under the restored defect and passed under
  the final transaction.
- Pixel 7 412x839 Home light/dark, drawer dark after its complete 460 ms entry,
  format dark, and spine dark screenshots were inspected under
  `.impeccable/review/`. The approved palettes, full constellation, neutral
  hero, permanent shelf marks, drawer content, and dock rendered without clipping.
- The final application JavaScript is 473.66 kB raw / 141.24 kB gzip; worker
  JavaScript is 75.60 kB; FTS5 WASM is 842.76 kB; the 57-entry precache is
  6,504.94 KiB and still excludes catalogue bytes.
- All thirteen illustration names remain accounted for; only their approved
  currently implemented states render them. Future Finish, Backup, and Stats
  placements remain reserved for their roadmap phases.

Hosted the exact verified build at `http://127.0.0.1:4173/`; it returned HTTP
200 and was opened in the in-app browser for owner review. Phase 4 stops here.
Phase 5 series/universe suggest-and-confirm work has not started. Q-028 remains
deferred and unpassed exactly as the owner instructed.

## 2026-09-07 · Phase 4 review corrections and partial Phase 5 handoff

The apparent missing-production-illustration defect was reproduced and traced to
an older service worker still controlling the 4173 origin. Closing and reopening
the origin showed the current production UI; source did not need a duplicate
fix. The Phase 4 preview was then stopped and live work moved to Vite on 5173.

Implemented the owner's approved theme correction without changing any immutable
design file. A deterministic OKLCH generator emits light and dark variants for
all 13 illustrations, preserves source lightness and distinct colour roles, and
copies `magic-tree-cuate` unchanged. All active call sites now use one
theme-aware `Illustration` component. A 13-row source/light/dark contact sheet
was inspected at `.impeccable/review/illustration-themes.png`; structural tests
also prove source hashes, all 26 outputs, deterministic generation, and no global
colour collapse.

Implemented a shared interaction-feedback boundary for real asynchronous work.
Catalogue open/search, online search, cover operations, work/status/session/
genre writes, notes, Wishlist, Trash, and backup preparation use a named pending
entry. It reveals only after 180 ms so fast work does not flash a loader. The
visible mark is a small registering-book glyph, is accessible through a polite
status region, and becomes static under reduced motion. Immediate sheet and FAB
transitions remain the acknowledgement for synchronous actions.

The shared mechanism is present but the audit is not complete: Detail's direct
remove/restore calls were identified as remaining wrappers. This is recorded for
the next thread rather than being falsely reported as a finished global pass.

Phase 5 began with the existing schema and catalogue architecture. Added exact
catalogue relationship SQL and worker/client messaging; a conservative pure
resolver; explicit ordinal parsing; unique high-threshold local-series matching;
transactional series/universe confirmation; truthful completion facts; and an
additive Dexie v2 migration for multiple named reading orders and entries.
Confirmed corpus series persist a Publication order with local and ghost entries.
An explicit bulk action adds verified missing entries to Wishlist in one
transaction, deduplicates corpus identities, and rejects the entire batch when a
shelf is unknown.

The Golden Son fixture resolves as Red Rising entry 2, identifies the earlier
missing entry, proves resolution causes no write, and proves confirmation and
bulk rollback. Series/universe screens, Detail relationship rows, manual
relationship editing, catalogue relationship labels, and the post-add
confirmation card are wired. These visible pieces compile but have not yet had
focused E2E or Pixel 7 visual review. Named reading-order editing UI and the
complete starting-point flow are still missing. No Add-whole-universe action was
built because the measured production catalogue has zero verified universe
rows and no complete membership evidence.

Verification at handoff: strict TypeScript passes; frozen token/taxonomy and
source checks pass across 75 source files; 30 targeted tests pass across
relationships, illustrations, interaction feedback, Dexie migration, and
backup. The interaction tests currently emit React `act(...)` environment
warnings while passing. The complete format/lint/unit/E2E/build gate has not run
since these changes, and Phase 5 is not complete. No commit, push, publish, or
deployment occurred.

The owner then requested a context-efficient durable transfer. Root `AGENTS.md`,
`HANDOFF.md`, `EXECUTION-PLAN.md`, `DECISIONS.md`, `OPEN-QUESTIONS.md`,
`SCHEMA.md`, `PIPELINE-NOTES.md`, `PRODUCT.md`, and this progress log were
cross-checked against the working tree and updated. The immutable `design/`
package was deliberately not edited.

## 2026-09-08 · Phase 5 implementation checkpoint

Finished the remaining named reading-order and starting-point work through the
existing router, sheet, Dexie, and design architecture. Added a `Reading orders`
sheet for series and universes that creates and selects several named orders,
renames and explains them, reorders/removes/re-adds linked entries, and uses a
double-arm permanent delete. Added the separate universe starting-point editor
with save and clear. Series pages now expose honest order management and empty
copy; universe pages distinguish `Start here` from the named sequences. No order
is silently canonical.

Added `repo.saveReadingOrder`, which validates and commits name, description,
and complete sequence in one Dexie transaction. Extended relationship unit tests
to prove rename/reorder and to prove an invalid replacement rolls back both the
prior metadata and sequence. Starting-point set/clear tests prove named orders
remain intact.

Completed the interaction-feedback audit for the current scope. Wrapped manual
relationship save, suggestion confirmation, verified missing-entry Wishlist
addition, order create/save/delete, starting-point save, catalogue ghost open,
and direct Detail remove/restore around the real asynchronous work. Instant
inputs and selection still rely on immediate feedback rather than an artificial
pending state. Enabled React 19's act environment in the test setup so the
interaction tests are warning-free.

Built a test-mode-only relationship bridge and four focused production-mode
Pixel 7 journeys. They cover exact high-confidence Golden Son/Red Rising evidence
and its missing-earlier warning, medium title-pattern and low unique-fuzzy offers,
rejection with no relationship write, explicit group and rollback-safe bulk
Wishlist add, known-total ring, Wishlist/owned/ghost rows, order create/rename/
reorder/delete, synthetic storage failure with draft retention and durable
rollback, universe starting point, multiple named orders, reduced motion, and
44 px enabled editor buttons.

The first focused E2E pass found a real StrictMode defect: the first exact corpus
lookup effect was cancelled, while a `checkedCorpusId` guard suppressed the
replacement effect. Re-keyed the effect to the current corpus identity/version;
the exact suggestion then appeared reliably. A proposed fuzzy typo below the
conservative 0.9 threshold correctly produced no offer, so the fixture was moved
to the actual low-confidence boundary rather than weakening the matcher.

Inspected the resulting Pixel 7 light/dark UI plus the focused production-mode
captures under `.impeccable/review/phase5-*.png`. High/medium/low suggestions,
long titles, ring/no-ring series, Wishlist/owned/ghost rows, the order editor,
universe starting point, multiple orders, focus, reduced motion, and error states
fit the approved warm-cream/blue-grey system without overflow or hierarchy drift.
The only demonstrated polish issue—an enabled Clear action with no stored starting
point—was corrected and rechecked. Immutable design files and frozen token and
taxonomy files stayed untouched.

The first full gate exposed two unrelated completion blockers and one scheduling
problem. Formatting and lint identified three local review/source files plus an
empty marker interface; those were corrected without behavior change. The router
unit test then reproduced a missing `matchMedia` crash in an environment that did
provide View Transitions. Feature detection was hardened; the assertion was
observed failing before the fix and all 13 router tests passed afterward. The
real catalogue latency journey passed alone but failed twice under four-browser
CPU contention (one cold result was 196.6 ms). Playwright now uses one worker;
the unchanged strict thresholds pass deterministically without weakening Q-028.

Final observed verification:

- Focused relationship/interaction Vitest: 11/11 passed.
- Focused Phase 5 production-mode Playwright: 4/4 passed together.
- `npm run gate`: formatting, ESLint, strict TypeScript, frozen structural checks
  across 77 source files, 170/170 unit tests in 16 files, 30/30 production-mode
  Pixel 7 E2E tests, and production build all passed.
- Final JS is 525.00 kB raw / 153.87 kB gzip; worker JS is 77.68 kB; FTS5 WASM
  is 842.76 kB / 411.47 kB gzip; Workbox precaches 83 entries / 15,691.91 KiB
  and excludes catalogue bytes.
- Port 5173 was stopped before the gate. The exact build is hosted at
  `http://127.0.0.1:4173/`, returned HTTP 200, and serves
  `index-BoR-VBsu.js` plus `index-BpeTa2kQ.css`.

No production corpus acquisition, dependency, schema migration, immutable design
edit, commit, push, publish, or deployment occurred. Phase 5 stops at this owner
checkpoint; Phase 6 has not started. Q-028 remains deferred and unpassed.

## 2026-09-08 · Owner acceptance, Wishlist disclosure, and Phase 6 hold

The owner accepted the proposed consent improvement and explicitly continued to
Phase 6. Added a bounded, scrollable preflight list after series confirmation;
it names every catalogue entry and stated series position that the bulk Wishlist
transaction will add. The existing all-or-nothing transaction is unchanged.
Strict TypeScript and the focused production-mode Pixel 7 journey pass, and the
captured light-theme state at
`.impeccable/review/phase5-wishlist-preflight-light.png` was inspected. The list
uses the approved ruled hierarchy and remains directly adjacent to the action.

Stopped the Phase 5 preview on 4173 before beginning the new working cycle. The
approved disclosure post-dates the last full build and will be included in the
Phase 6 completion gate. No dev or preview listener is currently required while
the blocking product choice is unresolved.

Phase 6 is authorized but no Phase 6 code has been written. Q-017 is now
blocking: the earlier instruction to skip the translation gate can mean either
omit that axis entirely or show it for every work. The durable docs recommend
showing it because it preserves the meaningful Rough-to-Fluent distinction, but
the choice remains the owner's. The immutable Phase 6 visual contract and
engineering rules were reread before pausing.

## 2026-09-08 · Phase 6 begins

The owner settled Q-017 in favour of Translation always appearing and explicitly
started Phase 6. Translation is a seventh optional editing step but is not part
of the approved six-axis recommendation calculation. Implementation began in the
existing axisRating table; no schema migration or new dependency is required.

## 2026-09-08 · Phase 6 implementation checkpoint

Implemented the seven-step optional axis flow on the existing `axisRating`
table. Added centralized validated writes, partial-profile clearing, Finished-
only Ending/Unfinished enforcement, mutual exclusion, and cleanup of ending
facts when a mistaken Finished status is corrected. Translation is always the
seventh editing step under E-087 but remains outside recommendation matching.

Implemented the frozen FinishMoment for both explicit status changes and
sessions reaching the end of complete works. `Later` returns to Detail and `Set
the axes` replaces the moment with the editor so Done returns to Detail. Added
the approved type-only AxisLine with partial/unrated/locked/Unfinished notes and
direct editing from each named word. The axis sheet supports nearest-stop
pointer input, drag, arrows/Home/End, focus, Clear, accumulated haptic pulses,
reduced motion, and delayed feedback only for perceptibly slow saves.

Implemented local explainable More Like This. It requires three shared rated
axes, ignores nulls, excludes Wishlist/Trash/current work, uses settled 3/3/3,
1/1/2 weights, requires an exact shared stop, and displays up to three shared
words without the internal score. Translation is not part of that calculation.

Focused tests first exposed a semantic mismatch: the visible More Like This
title was a `div`, so the heading query failed even though the region and result
were present. It is now a real h2. The first visual pass also exposed leading
hairline separators on wrapped profile lines; moving each separator to trail
its word matched the frozen rule. A rapid Playwright sequence could press the
old slider before the asynchronous save advanced to the next axis; the journey
now waits for each named dialog, matching the actual state boundary rather than
masking it with a timeout. The UI disables repeated navigation during that
write and retains draft state on failure.

Observed verification:

- Focused Vitest: 52/52 passed across axis and repository tests.
- Focused production Pixel 7 Playwright: 3/3 passed, including pointer,
  keyboard, direct named-axis editing, reduced motion, synthetic storage
  failure/rollback, manual finish, session finish, Translation, `endingNone`,
  and explained recommendations.
- Explicitly inspected dark FinishMoment/AxisScale and light Detail profile /
  recommendation captures in `.impeccable/review/phase6-*.png`; no overflow,
  orphaned rule, palette drift, or bottom-furniture collision was observed.
- Definitive `npm run gate`: formatting, lint, strict TypeScript, 82-file frozen
  structural scan, 178/178 unit tests in 17 files, 33/33 production Pixel 7 E2E
  tests, and build passed.
- Final PWA: `index-BaHcViYQ.js` 543.03 kB / 158.96 kB gzip,
  `index-DXm9LgQ2.css` 24.18 kB / 4.87 kB gzip, worker 77.68 kB, WASM
  842.76 kB / 411.47 kB gzip, 83 Workbox entries / 15,709.91 KiB.
- Exact build hosted at `http://127.0.0.1:4173/`, HTTP 200; port 5173 stopped.

No dependency, migration, production corpus acquisition, immutable-design or
frozen-token edit, commit, push, publication, or deployment occurred. Phase 6
stops for owner review. Q-029 records one unimplemented visible improvement:
explain why More Like This is absent when its honest threshold cannot be met.

## 2026-09-08 — Phase 7 Notes complete

- Added transactional note creation and editing with optional title, body,
  pinning, case-insensitive tag resolution, tag-count refresh, and validated
  work attachments through the existing `noteLink` table. Added batched context
  hydration, pinned-first feed ordering, per-work note queries, soft delete,
  restore, permanent purge, and expiry/Empty Trash coverage.
- Kept the data contract additive and migration-free. “Attachment” resolves to
  the frozen design's attached work, not a speculative binary/file entity.
  Active tag usage now truthfully includes both active works and active notes.
- Rebuilt the Notes feed and editor against the frozen Claude Design hierarchy:
  reusable NoteCard, attached-work pills, inline local work finder, nested
  history-owned tag picker, custom tags, content-warning gating, pin switch,
  error retention, and delete flow. Linked notes now appear on Detail, Notes
  participate in cross-search through body/title/tags/linked works, and note
  Trash supports restore and permanent deletion.
- Preserved the approved theme-specific illustration system exactly as the owner
  requested: detailed warm-light and blue-grey-dark derivatives rather than a
  uniform recolour. Notes swaps `no-notes` and `studying-bro` by theme and avoids
  showing both illustrations behind the editor. Perceptibly slow note writes use
  the established delayed feedback; immediate interactions use press, transition,
  or state feedback without loader flashes.
- Added repository tests for pinned order, two-work attachments, tags, failed
  attachment rollback, Trash restore/purge, and backup fidelity. Added three
  production Pixel 7 E2E journeys covering theme-swapped empty/editor states,
  attachments, tags, pin ordering, Detail, cross-search, failed-write draft
  retention, and note/work deletion semantics. Scoped one pre-existing Phase 6
  locator to its first visible match after the richer Notes data made the old
  global text assertion ambiguous.
- Inspected six Pixel 7 light/dark captures in
  `.impeccable/review/phase7-*.png`. The first review found an outgoing shared-
  surface capture and cramped Trash actions; capture timing and the note Trash
  row were corrected, then re-inspected.
- Definitive `npm run gate` passed: formatting, lint, strict TypeScript, frozen
  token/taxonomy and 84-source-file structural checks, 181/181 unit tests in 17
  files, 36/36 production Pixel 7 E2E tests, and production build.
- Exact output: `index-D6lqf8Bp.js` 560.73 kB / 162.79 kB gzip,
  `index-DXm9LgQ2.css` 24.18 kB / 4.87 kB gzip, worker 77.68 kB, WASM
  842.76 kB / 411.47 kB gzip, and 83 Workbox entries / 15,727.20 KiB.
- The exact gate build is hosted at `http://127.0.0.1:4173/` with HTTP 200 and
  matching asset names; port 5173 is stopped. Existing chunk-size and mixed
  dates-import build warnings remain non-blocking.

No dependency, migration, production corpus acquisition, immutable-design or
frozen-token edit, commit, push, publication, or deployment occurred. Phase 7
stops for owner review; Phase 8 has not begun.

## 2026-09-12 — Phase 8 data safety complete

- Replaced the partial JSON-only export surface with a dependency-free complete
  ZIP archive. `data.json` is read in one Dexie transaction; `manifest.json`
  records versions, counts, kind, and cover membership; every user cover is
  copied from OPFS. API-cover bytes/pointers and the API key are excluded.
- Added automatic app-open snapshots after onboarding, a 48-hour due interval,
  millisecond-bearing names, and newest-ten OPFS rotation. Failed archive writes
  leave the prior timestamp and snapshots untouched. Added honest history and
  never-exported states to Backup and Settings.
- Added strict ZIP and data validation before restore preview: safe/unique
  paths, matching local/central headers, stored method, CRC32, count integrity,
  IDs, references, reading-order context, normalized tag uniqueness, and every
  user cover. Older schema-v1 JSON is normalized with empty reading-order
  collections.
- Implemented Merge as the default and Replace behind a forced local safety
  snapshot whenever any user table has data. Database replacement is one Dexie
  transaction; prewritten cover files are removed on failure and superseded
  user covers only after success. Current device catalogue flags, backup times,
  and API key never come from the imported file.
- Centralized work-batch creation for manual, catalogue, paste, and CSV inputs.
  Paste removes normalized duplicate lines and accepts only exact normalized
  catalogue matches. CSV handles quoted fields and maps title, writer/author,
  status, format, progress, rating, and tags. Both flows show editable/skippable
  confirmation and write all selected rows transactionally.
- Completed the GET share target: title/text/URL survives cold start into the
  existing catalogue over Wishlist, then remains prefilled in Add by hand with
  Wishlist selected.
- Applied the approved interaction-feedback boundary to export, restore,
  catalogue matching, and batch import. The visual implementation stayed in the
  frozen Claude hierarchy. The existing thirteen theme-specific illustration
  derivatives and immutable source SVGs were preserved.
- Focused tests first found three harness/mapping issues: jsdom's File/Blob
  implementation lacked `arrayBuffer`, “Writer” was not recognized, and an
  empty progress cell parsed as zero. The OPFS mock now stores bytes directly,
  writer maps to author, and blank progress remains absent.
- Focused UI review found that a file-picker action could leave the restore
  preview at the Backup page's prior scroll offset. Each subflow now resets to
  the top. A concise layout-effect callback initially returned an unexpected
  cleanup value in Chromium; changing it to an explicit block and `scrollTop`
  removed the runtime error. Counts now pluralize and metadata uses hairline
  separation instead of punctuation dots.
- Focused Vitest passed 64/64. Focused production Pixel 7 Playwright passed 4/4
  for empty/history, ZIP download/restore merge, paste/CSV, and share target.
  Explicitly inspected five light/dark captures under
  `.impeccable/review/phase8-*.png`.
- The first complete gate passed all 188 unit tests and 39/40 E2E tests; one
  accepted Phase 7 synthetic rollback journey observed its controlled textarea
  before React owned the just-filled value. It passed immediately alone. The
  test now explicitly waits at that state boundary; no requirement was relaxed.
- The second `npm run gate` passed: formatting, lint, strict TypeScript,
  90-source-file frozen checks, 188/188 unit tests in 18 files, 40/40 production
  Pixel 7 E2E tests, and production build.
- That output was `index-Bs5_81_f.js` 595.19 kB / 173.50 kB gzip,
  `index-DXm9LgQ2.css` 24.18 kB / 4.87 kB gzip, worker 77.68 kB, WASM
  842.76 kB / 411.47 kB gzip, and 83 Workbox entries / 15,760.85 KiB.
- A final failure-state audit found that unreadable automatic snapshots and a
  Settings export failure could be silent. Backup history now distinguishes
  unavailable storage from corrupt entries and reports the unreadable count;
  Settings exposes export failure through an alert. The added unit test covers
  mixed valid/corrupt automatic history.
- The definitive post-audit `npm run gate` passed formatting, lint, strict
  TypeScript, 90-source-file frozen checks, 189/189 unit tests in 18 files,
  40/40 production Pixel 7 E2E tests, and the production build.
- Final output: `index-BiacwbWt.js` 595.81 kB / 173.69 kB gzip,
  `index-DXm9LgQ2.css` 24.18 kB / 4.87 kB gzip, worker 77.68 kB, WASM
  842.76 kB / 411.47 kB gzip, and 83 Workbox entries / 15,761.45 KiB.
- The exact gate build is hosted at `http://127.0.0.1:4173/`, returns HTTP 200,
  serves `index-BiacwbWt.js`, and exposes the GET `/share` manifest target with
  title, text, and URL parameters. Port 5173 is stopped; production `dist`
  contains no test bridge.

No dependency, Dexie migration, production corpus acquisition,
immutable-design/frozen-token edit, commit, push, publication, or deployment
occurred. Phase 8 stops for owner review; Phase 9 has not begun.

## 2026-09-13 — Phase 9 Stats and spine view complete

- Replaced the Stats placeholder with the approved editorial register: current
  year figures, truthful library/Wishlist status, all-versus-finished genre
  scope, the single segmented genre bar, series completion, most-read author,
  finishing outcomes, and prior local calendar years. The snapshot is one Dexie
  read transaction; Wishlist and Trash do not inflate the library, and page
  sessions never become chapters read.
- Retained the existing truthful Home figures. Restored both Stats illustration
  placements through the existing warm-light and blue-grey-dark derivative
  system without editing any immutable source SVG.
- Settled approved Q-019 with independent chapter/page ladders. Forty known
  lengths activates strict 20/40/60/80-percentile boundaries and live Width Key
  labels; smaller samples use D-027's fixed logarithmic ladder. The derived
  settings cache has a deterministic library signature, is portable in backups,
  and is ignored when malformed or stale. No Dexie migration was required.
- Packed shelf spines into fixed-height rows and windowed them to the viewport
  plus bounded overscan. A 500-work Pixel 7-emulated fling measured 58.7 fps on
  the 60 Hz viewport, 49.9 ms worst frame, and no more than 13 mounted rows.
  Cover-to-Detail transition naming is applied only to the tapped spine and is
  cleared after every resolved, rejected, or interrupted transition.
- Added focused spine/statistics, backup, router, and production Pixel 7
  coverage for truthful populated/empty Stats, both themes and illustrations,
  adaptive and fixed Width Keys, bounded mounting, and the 500-work performance
  budget.
- Proved the two core regression assertions by temporarily restoring full-row
  mounting and all-unit chapter sums. They failed at 100 mounted rows and 92
  falsely counted chapters, then passed after the fixes were restored.
- Explicitly inspected `.impeccable/review/phase9-stats-top-light.png`,
  `phase9-stats-top-dark.png`, `phase9-stats-history-light.png`,
  `phase9-stats-history-dark.png`, `phase9-spines-light.png`, and
  `phase9-spines-dark.png`. Theme detail, ledger hierarchy, long wrapping,
  Width Key legibility, dock clearance, and the flat shelf grammar remained
  correct.
- The first gate stopped at lint on one `prefer-const` error and one hook warning;
  both were corrected locally. The next full run passed 204 unit tests but two
  earlier E2E journeys failed: rapid synthetic numeric fills lost the first
  controlled value, and one cold fixture catalogue query took 124.7 ms. The edit
  draft now merges against React's latest queued state, the journey verifies
  both inputs after user-like sequential typing, and the unchanged catalogue
  threshold passed alone and in the definitive full run. No gate threshold or
  product requirement was weakened.
- Definitive `npm run gate` passed: formatting, lint, strict TypeScript, frozen
  token/taxonomy checks across 93 source files, 204/204 unit tests in 20 files,
  43/43 production Pixel 7 E2E tests, and the production PWA build.
- Final output: `index-B2ql31YH.js` 608.64 kB / 177.38 kB gzip,
  `index-DXm9LgQ2.css` 24.18 kB / 4.87 kB gzip, worker 77.68 kB, WASM
  842.76 kB / 411.47 kB gzip, and 83 Workbox entries / 15,773.98 KiB.

No dependency, Dexie migration, production corpus acquisition,
immutable-design/frozen-token edit, commit, push, publication, or deployment
occurred. Phase 9 stops for owner review; Phase 10 has not begun.

## 2026-09-13 — Phase 10 final polish complete

- The owner accepted Phase 9 by instructing work to continue. Phase 10 began as
  the final documented roadmap phase; no later phase was inferred.
- Completed Settings/About against the frozen ruled-ledger and bookplate
  designs. Settings and About now receive the app's single loaded settings row,
  eliminating their transient blank/stale copies. Added an honest boot error,
  settings-write rollback, theme rollback, live export timestamp, duplicate
  export guard, and explicit unavailable storage state.
- Replaced presentation-only Settings/About titles with semantic headings,
  raised segmented controls, switches, and the bookplate save action to 44px
  targets, and implemented arrow/Home/End radio-group keyboard behavior.
- Resolved Q-008 with a bounded ruled maintenance route. Rename preserves tag
  identity; exact rename-to-existing performs an explicitly confirmed merge;
  unused removal requires confirmation. Merge rewrites active and soft-deleted
  work/note tag IDs, deduplicates them, combines groups, refreshes counts, and
  commits transactionally. Tags referenced only in Trash are named and kept.
  No similarity suggestions were implemented.
- Added focused repository and production Pixel 7 coverage for Settings
  success/failure, theme rollback, touch targets, keyboard selection, long
  bookplate names, About, tag rename/merge/delete, failed tag writes,
  Trash-only protection, empty tags, back navigation, and reduced motion.
- The focused repository suite passed 55/55 and the focused production E2E
  suite passed 3/3. A required restored-defect proof temporarily removed the
  note-side merge rewrite: the new assertion failed on the source tag ID, then
  passed after restoration.
- Applied the `impeccable` audit criteria manually because its optional local
  engine executable was absent. No download or installation was attempted.
  Static audit found no new hardcoded colours/durations, diff whitespace error,
  frozen-file change, or listener on 5173/4173 before the build.
- Explicitly inspected Settings top/bottom, About top/bottom, and tag
  maintenance in both themes under `.impeccable/review/phase10-*.png`. The long
  About footer clears the dock at maximum scroll. The native 192px and maskable
  512px bookplate icons were also inspected; Q-018 remains the owner's final
  launcher-size judgment.
- Definitive `npm run gate` passed: formatting, lint, strict TypeScript, frozen
  token/taxonomy checks across 95 source files, 207/207 unit tests in 20 files,
  46/46 production Pixel 7 E2E tests, and the production PWA build. The gate
  reran real worker/OPFS, offline, service-worker-upgrade, reduced-motion, and
  500-work performance journeys.
- Final output: `index-Bz51j1Lk.js` 617.33 kB / 179.59 kB gzip,
  `index-DXm9LgQ2.css` 24.18 kB / 4.87 kB gzip, worker 77.68 kB, WASM
  842.76 kB / 411.47 kB gzip, and 83 Workbox entries / 15,782.47 KiB.
- No `adb` executable or physical Android device was available. Q-028 remains
  deferred and explicitly unpassed; Pixel emulation was not reported as the
  physical measurement.
- The exact gate build is hosted at `http://127.0.0.1:4173/`, returns HTTP 200,
  serves `index-Bz51j1Lk.js`, and contains no Phase 10 test bridge. Port 5173 is
  stopped.

No dependency, Dexie migration, production corpus acquisition,
immutable-design/frozen-token edit, commit, push, publication, or deployment
occurred. Phase 10 stops for owner review; there is no authorized later phase.

## 2026-09-13 — Public phone-release extension ready

- The owner accepted the release candidate, supplied the final reader-circle
  logo, authorized publication to the public
  `Qusai-Badwaniwala/Ex-Libris` repository, and asked for one bounded Phase 10
  extension before publishing: a real install control in Settings and the final
  onboarding spotlight on that control. No Phase 11 was inferred.
- Used the supplied artwork to make separate checked regular and maskable PNG
  masters. Regenerated the manifest's 192px, 512px, and 512px maskable icons;
  the earlier conservative SVG icon was removed. Q-018 is resolved by E-103.
- Added one browser installation store around `beforeinstallprompt`,
  `appinstalled`, standalone display detection, and iOS detection. Settings now
  opens the native prompt when available, gives honest manual Safari/browser
  steps otherwise, keeps dismissal retryable, and shows a green tick plus
  `Installed` in standalone or after an accepted current prompt.
- Extended the in-place first-run tour from five to six steps. Its last step
  navigates to the actual Settings route, spotlights the installation row, and
  offers Install or manual instructions. The overlay prevents background touch
  scrolling while that cross-route step is open.
- Made the application, manifest, service-worker navigation exclusions, share
  target, catalogue request, illustration paths, favicon, and Apple icon work
  from the GitHub Pages `/Ex-Libris/` project base without changing localhost's
  `/` base.
- Added the public Pages workflow and a checksum-locked corpus packaging step.
  Sixty-six committed parts reconstruct the exact 273,784,832-byte production
  Open Library/Wikidata database. Local assembly matched SHA-256
  `1d5c9eba8347481ab55db124378c15d1d6ac05264f7012160fc0954a0a7272c7`;
  a Pages-base preview returned HTTP 200 for the app, manifest, and production
  catalogue manifest. The engineering fixture remains ignored.
- Added production Pixel 7 coverage for the accepted native-prompt path, the
  Installed state, persistence of tour completion, and the no-prompt manual
  fallback. Explicitly inspected warm-light and blue-grey-dark tour captures,
  the dark installed state, the light manual instructions, and both launcher
  masters. No clipping, theme mismatch, lost icon detail, or dead control
  remained.
- The first gate attempt found one unused import in the Pages utility. A later
  full-suite run exposed an old test-bridge race: automatic-backup bookkeeping
  could consume the synthetic “next settings write” failure before the theme
  write under load. The fixture now reserves that failure for a change carrying
  `theme`; the production path was not changed. The restored focused journey
  and definitive full run passed.
- Definitive `npm run gate` passed: formatting, lint, strict TypeScript, frozen
  token/taxonomy checks across 96 source files, 207/207 unit tests in 20 files,
  47/47 production Pixel 7 E2E tests, and the production PWA build. Final shell
  output is `index-BNZBCYIL.js` at 621.67 kB / 180.73 kB gzip,
  `index-DXm9LgQ2.css` at 24.18 kB / 4.87 kB gzip, worker 77.68 kB, and FTS5
  WASM 842.76 kB / 411.47 kB gzip. Workbox precaches 82 entries / 15,784.70
  KiB and still excludes catalogue bytes.
- Public-file audit found no high-confidence credentials in the working tree or
  existing Git history. The only broad “secret” matches are deliberate fake
  backup-test values that prove `aiApiKey` never travels. `.env`, local corpus,
  test cache, Playwright output, and review screenshots remain ignored. No
  untracked file exceeds 5 MB; catalogue parts are each at most 4 MiB.

At this checkpoint nothing has yet been committed, pushed, or deployed. The
verified public file set is ready for the explicitly authorized Git operation.

## 2026-09-13 — Release commit pushed; Pages setting required

- Committed the complete audited release as
  `b41ac679f9527cc5a47799852a889c4297c7e3ca` (`Complete Ex Libris PWA and
prepare phone release`) on `master` and pushed it to the owner's public
  `Qusai-Badwaniwala/Ex-Libris` repository.
- GitHub rejected the first push before publishing because the local commit
  inherited a private email address. The unpushed commit was amended to use the
  account's GitHub no-reply address, then pushed successfully. The rejected
  commit is not in remote history and the private address was not published.
- GitHub Actions run `34745951062` completed the checkout, dependency install,
  project-site build, and exact production-catalogue reconstruction. It stopped
  only at `Configure GitHub Pages` because Pages is not yet enabled for this new
  repository; the deploy job was correctly skipped.
- The required owner action is one repository setting: **Settings → Pages →
  Build and deployment → Source → GitHub Actions**. The available in-app browser
  is not signed in, so it could not make that account-level change. The public
  app URL is not reported as live until a fresh workflow and network checks
  succeed.

## 2026-09-13 — Public phone release deployed and verified

- The owner enabled GitHub Pages with GitHub Actions as the source. Empty trigger
  commit `f64901a` started workflow run `34747574260`; checkout, dependency
  installation, checksum-locked catalogue reconstruction, production build,
  artifact upload, and Pages deployment all succeeded.
- The live PWA is `https://qusai-badwaniwala.github.io/Ex-Libris/`. It opened at
  Pixel 7 dimensions and reached the real first-run Welcome screen with its
  privacy promise and working `Open the library` action.
- Direct network checks returned the app, manifest, icon, service worker, and
  catalogue manifest successfully. The manifest's start URL and scope are both
  `/Ex-Libris/`; the icon returned 59,232 bytes. The catalogue manifest declares
  273,784,832 bytes and SHA-256
  `1d5c9eba8347481ab55db124378c15d1d6ac05264f7012160fc0954a0a7272c7`.
  A byte-range request returned HTTP 206 and the `SQLite format 3` header.
- The public service worker excludes the catalogue from precache. GitHub Pages
  returns the custom app shell for `/share` with HTTP 404 before service-worker
  control; the installed app's navigation fallback then handles the share-target
  route. No user library data is sent to GitHub.
- Phase 10 remains the final planned phase. Q-028 is still deferred and
  explicitly unpassed; this desktop and Pixel-emulated verification is not a
  physical Android latency measurement.

## 2026-09-20 — Isolated Reading Room adoption

Implemented the approved light-preserving production candidate: near-black/slate
dark theme, deterministic illustration derivatives, consolidated runtime tokens,
original install identity, test-only evaluation launcher, onboarding replay and
safe update offer. Removed the Spine UI/layout and added append-only preference
migration 3. Added central relationship queries, a transactional organiser,
series/world pages and the optional Three.js Codex.

Hardening found real session atomicity/concurrency defects, an optimistic
onboarding-completion race and orphan group references. New membership guards
reject stale edits and preserve Trash/legacy conflicts. Complete safety ZIPs are
read back and checked before destructive group edits or replacement restore.
Missing user cover bytes block the operation. Background backup failures are
visible and active backups defer app updates.

Observed regression proof: restoring transaction-free session logging failed
the orphan/double-count assertions; removing organiser safeguards failed stale
membership/Trash assertions; restoring optimistic settings publication failed
the held-write completion assertion. Fixes were restored. The first Codex stress
run measured 22.7 fps; three instanced batches, matte lighting and bounded canvas
resizing improved the same 500-work emulated sweep to 60.0 fps, with at most five
rows mounted. Idle rendering and GPU loss passed. This is desktop emulation,
not a physical-phone measurement.

An intermediate complete run passed 216 unit tests and 53/54 browser tests,
finding the first-run persistence race above. The corrected candidate is being
regated with enlarged-text, scroll-restoration and all-artwork review coverage.
Final results belong in HANDOFF; the intermediate result is not release approval.
Production checkout and deployment remain untouched. No commit or push.

## 2026-09-21 — Owner-authorised Reading Room release

The owner authorised commit/push/publication and reported unreachable onboarding
actions and weak selected form options. Reproduced the tour at 360x640 with
enlarged text: action bottom 948.7px. Bounded the measured card, kept its action
row separate from scrollable copy, prevented focus scrolling and retained target
scrolling. All six steps now pass the same regression. Shared segmented controls
use theme accent plus a checkmark and arrow/Home/End operation. Restoring the old
unmarked selection makes the new assertion fail; the fix was restored byte-for-byte
to the gated source. Both themes were visually reviewed.

The definitive repository gate passed: format, lint, strict types, token/source
integrity, 218 unit tests, 58 browser journeys and a normal production build.
This includes first run, all major reading/library/editor flows, relationship
organisation, old schema migration, complete ZIP/cover restore, failed writes,
offline restart and waiting-worker upgrade with saved data preserved. Corrected
test helpers wait for persisted onboarding completion and explicitly account
for shared-title startup, which opens acquisition before the Home-only tour.

The final 500-work desktop-emulated sweep measured 60.004fps with five mounted
rows maximum; idle rendering, GPU context loss and scroll restoration passed.
All thirteen light/dark art derivatives were reviewed as contact sheets; the
study/bibliophile accent families were corrected without changing original SVGs.
Q-028 physical Android latency and physical assistive-technology checks remain
unpassed. Publication and exact Pages-path build evidence follow in HANDOFF.

## 2026-10-02 — Release resumed and exact build reviewed

Resumed the authorised publication after interruption. The restored selected
control source still matches the gated hash. Normal Pages-path output excludes
the test launcher/bridges; its catalogue is the verified 438,584-work production
distribution. A broad text scan initially matched the manifest parser's allowed
engineering-fixture enum, not fixture data; narrowed runtime/manifest checks
confirmed the correct distribution.

Hosted at 127.0.0.1:4275/Ex-Libris/ with the same base setting as build. Omitting
the base from Vite preview initially served HTML at nested asset URLs; corrected
the preview command, without changing application code. Browser review covered
360x640 and 390x844, all tour steps, replay, clear light/dark selections, real
manual save and Codex/detail navigation. No runtime errors were captured.
Only a clearly labelled disposable record was created on the local origin.

Committed application release 4fa9e934eb75698f8eeaa3284cd0c0049a8ce548, fast-forwarded
the clean production master checkout and pushed normally. Pages run 36963081036
completed successfully. Public JS/CSS asset names match the reviewed normal
build; public install/share identity and catalogue checksum/count are preserved.
A real public-origin browser upgrade first showed the cached original frontend;
closing/reopening activated the new release with the existing two records and
onboarding intact. Inspected the live phone Collection/Codex; no runtime errors.
No local review record was exported or added to the public origin.

Installed the exact lockfile in Website. The refreshed registry audit now reports
five development-only entries (one high, three moderate, one low), versus two at
the earlier checkpoint; zero production vulnerabilities. Recorded new transitive
tooling advisories and a separate targeted maintenance recommendation. No force
fix, bulk upgrade, or unverified dependency change was made to the gated release.

## 2026-10-02 — Launcher, broader lookup and relationship follow-up

The owner supplied a phone screenshot showing the old reader-circle launcher
rendering very small and requested a new logo, broader catalogue lookup and
easier series/world creation. Replaced the icon and toolbar letter seal with a
large folio-under-arch mark, kept ordinary/maskable masters reproducible through
`npm run icons`, and removed the unused raster masters from `public/`.

Added an explicit bounded Open Library online book lookup beside the existing
MangaDex comics lookup. Real in-app browser search for Piranesi returned ten
works; a work opened the editable Add sheet. The initial phone layout buried
online actions below ten results, so they moved next to the query. Source facts
remain leads, not inferred series/world data. Series offers remain available
after reopening Detail, and one tap on a series page can create or join a
same-named, clearly reader-authored world.

The complete gate passed after these code changes: 220 unit tests, 60 phone
browser journeys, production build, types, lint, formatting and structural
checks. The online-book add and reopened-series/world creation journeys pass.
The physical Android catalogue latency and physical TalkBack checks remain
unpassed. Final Pages-path inspection and publication are recorded in HANDOFF.

Committed the follow-up as `3a11f3a` and pushed `master` normally. GitHub
Pages run 36995073107 completed successfully. Public HTML served the reviewed
`index-D6zqd1zy.js`; manifest scope and icons stayed under `/Ex-Libris/` and
the public 192px icon hash matched local. The public production catalogue
manifest retained 438,584 works and the original SHA-256. In the live browser,
the waiting update activated while the prior two records remained; a real
Open Library search returned Piranesi results. No public data was modified.

## 2026-10-02 — EX identity revision

The owner rejected the folio logo and requested a minimally artistic `EX` with
both theme accent families. Replaced both vector masters with a large custom
vermilion-orange/slate monogram, regenerated the three launcher PNGs, and used
the same mark in the toolbar and startup. Inspected native 192px and 512px
maskable raster output, plus the 390px local app header in both themes. The
light and dark screen palettes were untouched. Final gate and publication
evidence belong in HANDOFF.

The final full gate passed (220 unit, 60 browser journeys), and the exact
`/Ex-Libris/` build was inspected at 390x844 in both themes. Its header SVG is
in the offline precache; generated PNGs matched the build copies. Committed
`e46cd28` and pushed `master` normally. GitHub Pages run 36998803870 passed;
public HTML served the reviewed `index-pwWpQDW9.js`, and the public 192px icon
SHA-256 matched local. Activating the live waiting worker revealed the EX mark
while preserving the existing two browser-origin records. The installed Android
launcher itself was not inspected.

## 2026-10-02 — Owner-supplied quill identity

The owner supplied and selected a new image after reviewing the geometric EX.
Copied its 1254px original byte-for-byte into `assets/brand/`, then changed the
existing icon script to export cropped ordinary and safe-zone maskable PNGs.
The same icon now appears in toolbar/startup; its 192px file is explicitly
precached so the toolbar works offline. Removed the superseded SVG masters.
Visually inspected the generated 192px and 512px maskable files and the local
390px header in light and dark. Build, release and physical-launcher evidence
belong in HANDOFF.

The final full gate passed (220 unit tests, 60 browser journeys). The exact
Pages-path build was inspected at 390x844 in both themes, with the locally
waiting worker activated. Manifest scope, catalogue checksum and icon paths
were preserved; the generated PNGs match their build copies. The 192px header
image is precached and the original master stays outside the shipped output.
Public deployment remains to be verified.

The first maskable export left more black surround than necessary. Adjusted only
that export's scale and centre, keeping the pen tip and feather tip within the
Android safe circle. Inspected the revised 512px file, reran the complete gate
(220 unit, 60 browser journeys), rebuilt at `/Ex-Libris/`, reassembled the
verified 273,784,832-byte catalogue, and checked the final 390px local app.

Committed the selected artwork as `9ad1246` and pushed `master` normally.
GitHub Pages run 37048612948 completed successfully. Public HTML served the
reviewed `index-BerBxkZz.js`; public ordinary and maskable icon SHA-256 values
matched local. The live browser activated the waiting worker, loaded the quill
toolbar icon and retained its two pre-existing records. Physical Android
launcher appearance remains unverified.

## 2026-10-03 — Current-documentation reconciliation

The owner requested a quick check of documentation currency. Confirmed clean
`master` aligned with `origin/master`, application commit `9ad1246`, successful
Pages runs 37048612948 / 37049057760, and the live site's current JS/CSS names.
Corrected README's obsolete Spines/font references, updated adoption/release
status and schema version wording, and labelled superseded logo/phase/brief
instructions as historical. Rewrote the canonical handoff around one current
release and next-action list; older release evidence remains in this chronology
and Git history. The workspace AGENTS checkpoint now points to the adopted
design and the owner's no-prescriptive-skills instruction.

Port 4278's old preview did not respond; documentation no longer claims it is
running. No application code, data contract or reader data changed. The earlier
220-unit / 60-browser gate remains the application evidence; this session checks
documentation formatting and diff integrity only. Physical Android latency,
TalkBack and launcher appearance remain unverified, and tooling advisories and
re-read history remain deferred.

Prettier checks passed for all changed documentation, including the workspace
guide; `git diff --check` passed. No application tests or build were rerun for
this documentation-only change.

# 2026-10-04 · Product evolution Pass 1 (complete), Pass 2 in progress

Owner explicitly approved the four-pass plan, app-wide Motion and all six
consequential boundaries, including publication after verification (E-117).
Clean `master` baseline; identity/immutable assets and schema are preserved.
Implemented storage probe sharing, failed-write abort, atomic field-rule-based
work edits, handled status/genre/caught-up errors, explicit drop-reason save,
full known restore shape validation, collision disclosure and verified safety
archives before overlapping merge. Retained snapshots now offer review/export;
catalogue repair uses an inactive verified slot; immutable catalogue readers
request compatible read-only handles. Wishlist removal now uses Trash/Undo.

Focused tests: 27 passed. Temporarily restored the prior behaviors: twelve new
assertions failed across concurrency, partial edits, validation, merge safety and
repair; restored fixes and observed all pass. Strict types passed before the
latest manifest-validation refinement. Full gate passed: 232 unit / 60 E2E,
format/lint/types/frozen checks and normal build. Snapshot review/collisions
inspected on desktop and 390×844 in both themes; preview stopped. Codex measured
60.0fps with five mounted rows.
No production release or commit yet. Archive work remains synchronous until
Pass 4. No additional acquisition or dependency was added in Pass 1.

Pass 2 installs pinned MIT Motion 14.0.0 and integrates LazyMotion/domMax,
shared reviewed presets, immediate inert exits, modal focus/isolation, bounded
disclosures, route/query/order context, proper backup step history and broader
draft guards. Native transitions now commit a pending action before cancellation.
The generated update helper's unconditional cross-client reload is replaced by
a platform registration with per-client draft protection and a bounded on-demand
window coordination check. Partial changes are not yet gate/browser verified.

Pass 2 checkpoint: unweakened gate passed with 237 unit / 64 E2E and normal
build. Fixed stale online result eligibility, order-editor presence identity,
dynamic modal isolation, async focus restoration and virtual scroll ownership.
Real phone light/dark add/acquisition/draft and local update inspected on 4291;
preview stopped. Codex 60.0fps/five rows/top 68186. Unit regression proofs
restored screen guards and update protection, observed failures, then passed.
Pass 3 now in progress; record/history/stats and secondary-screen changes are
not yet verified. Pass 4 worker/CI patches are prepared separately under .astra.

## 2026-10-04 · Integrated evolution and final review

Pass 3/4 code is integrated: record hierarchy, directly attached notes, read-only
session history, current-year page/chapter totals, secondary-screen refinement,
stable form actions, archive worker, offline asset trimming and reproducible
release CI. The first combined gate passed 251 unit tests and 60 of 68 browser
journeys. Eight browser failures identified stale selectors/new truthful-stat
expectations and an attachment count that needed to expose attached titles.
Focused reruns passed after correction.

Sequential real-browser phone review in both themes covered Reading, Collection,
Detail/session/history, note writing and nested tags, axes/editing, groups/worlds/
orders, Wishlist/Surprise, Stats, Settings/About, backup/restore/paste import,
catalogue/manual fallback and empty Trash; wider Stats/Settings hierarchy was
also inspected. Review found a segment selection escaping its button, native
disclosure button chrome, long-cover truncation, axis-underlay scroll loss and
Surprise focus loss. Fixed these and reachable filter/session footers. Restoring
the segment defect failed its bounding assertion; restoring the axis and reroll
defects failed both new browser assertions, then both passed with repairs. The
menu's underlying draft guard was missing; its new unit assertion failed before
the fix and all 24 router tests passed after it. Browser acceptance is in the
final gate. Native snapshots now allow live controls to receive immediate input.

Archive/client suite passed 23 focused assertions including 16 MiB cover-byte
fidelity; restoring synchronous ZIP parsing failed its structural boundary, then
passed after repair. Authored synthetic fixture regenerated twice identically;
production catalogue bytes and all deployment-part hashes were unchanged.
Release guards passed/fail/passed and rejected the explicit test artifact.
Normal shell precache: 41 entries/11520.57 KiB, formerly 53/15935.49 KiB.
Motion code attribution: 42.8 KiB gzip; the 40 KiB target is missed by 2.8 KiB.
Rejected fragile private Motion imports and a renderer rewrite. Final gate is
running. Physical Android/TalkBack/launcher checks remain unpassed. No push or
publication yet.

The integrated gate completed: 252 unit / 72 E2E, normal production build,
Codex 60.0fps/five rows/top 68186. Subsequent sequential theme→finish-profile
review reproduced a swallowed rapid tap. A real-pointer assertion failed even
with all snapshot pseudo-elements ignoring pointers: native capture suppresses
hit testing before its callback. Replaced only the theme's native snapshot with
a 200ms CSS colour handoff, retaining cover/add native transitions. Restored the
native defect and observed the updated assertion fail again; restored the colour
handoff and it passed. Programmatically focused headings retain screen-reader
orientation without a decorative focus box; interactive keyboard focus remains.
Final 73-journey gate is next. Production dependency audit: zero vulnerabilities.

Final local gate passed: 252 unit / 73 E2E and normal build. Codex 60.0fps, five
rows, exact top 68186. Archive worker: 16,781,472-byte archive, two faithful cover
digests, 756ms, 46 frames, 16.8ms maximum frame gap and zero observed main-thread
long tasks in this desktop-emulated run. Final tablet review caught the new nav
indicator retaining its phone orientation from 768–899px; the extended assertion
failed before aligning its breakpoint with the existing sidebar, then passed.
No other production changes followed that targeted correction.

Built normally for `/Ex-Libris/`, assembled the checked 273,784,832-byte catalogue
and passed `check:release`: seven scripts without test bridges, approved licensed
works/checksums and both offline theme derivatives. Candidate entry/CSS:
index-C3h3hIoJ.js / index-ov2LJl_S.css. Actual Pages precache: 38 entries /
11521.37 KiB. Publication next; CI will verify the committed state again.

## 2026-10-04 · Product evolution publicly released

Committed the complete approved four-pass evolution as
`53fa87dcd6cfe307e2f3c9f17ed0de5d340ff0d0` (94 named files, 5,428 insertions /
1,720 deletions) and pushed `master` normally under the owner's explicit
authority. [Pages run 37187502145](https://github.com/Qusai-Badwaniwala/Ex-Libris/actions/runs/37187502145)
completed successfully: complete gate on the final commit, normal Pages build,
checksum-verified production catalogue assembly, exact release checks and deploy.
The final tablet breakpoint correction is therefore covered by the release's
complete CI gate as well as its local regression proof.

Built the exact clean commit locally before hosting it. Public entry
`index-DiZDPZr2.js` (660,890 bytes), CSS `index-ov2LJl_S.css` (44,373 bytes),
archive worker (15,155 bytes), ordinary and maskable icons match that artifact
byte for byte. Entry SHA-256:
`744eb8d7bafc67b2911701be666426101905f34813b40683f55d607bbb85b2af`.
Final Pages precache is 38 entries / 11521.36 KiB. Public catalogue manifest
retains 438,584 works / 273,784,832 bytes and approved checksum
`1d5c9eba8347481ab55db124378c15d1d6ac05264f7012160fc0954a0a7272c7`.
A streaming range request read only 32 bytes: HTTP 206,
`bytes 0-31/273784832`, `SQLite format 3`; no full catalogue re-download.

Activated the live browser's waiting-worker Update; its two pre-existing works,
bookplate, theme, progress and completion survived. Settings visibly identifies
Build `53fa87dc`. Read-only follow-up inspected actual 390×844 published Reading
and Detail, plus wider Settings. No public records were added, removed or
imported. Full sequential both-theme local review and performance measurements
remain recorded above; physical Android, TalkBack and launcher checks are unpassed.

The exact released build is hosted on `http://localhost:4292/Ex-Libris/`
(preview session 92915). The first preview omitted `VITE_BASE_PATH` and served
incorrect asset responses; setting `/Ex-Libris/` for preview corrected this
environment issue without a source change. The previous 4291 server is stopped.
Do not rebuild while 4292 serves this artifact. Windows sandbox network reads
required escalation; anonymous GitHub REST release verification then succeeded.

Reconciled the canonical handoff, execution checkpoint and release notes with
the successful public release. This evidence-only follow-up changes no code or
data contract; named-file formatting and diff checks are the appropriate checks.
Documentation-only pushes skip deployment and preserve the released Build
`53fa87dc`. All approved implementation/publication work is complete; no further
owner approval is needed. Physical device evidence and separate tooling/reread
work remain distinct from this finished upgrade.
