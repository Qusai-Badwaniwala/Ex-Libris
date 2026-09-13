# DECISIONS.md

Append-only. Dated. Every non-obvious engineering decision, its reasoning, and
what was rejected. Design decisions live in `design/DECISIONS.md` (D-001 to
D-106) and are not repeated here; these are numbered E- to keep the two apart.

---

## 2026-09-03 · Phase 0

### Schema changes, all approved by the owner before implementation

**E-001 · `work.genres: GenreIndex[]` added.** The design package's taxonomy
(v1, `design/docs/taxonomy.md`) makes genre a **closed set of twelve, separate
from tags**: a work carries at most two, primary first. `SCHEMA.md` v1 predates
that work and has only `tagIds`. Without this field, D-095/D-096 cannot be
built at all.
_Rejected:_ modelling genres as tags with a reserved group — it puts a closed
vocabulary and an open one in the same table, and every read site then has to
remember which is which.

**E-002 · `work.notes` dropped.** A short free-text field on the work itself,
separate from the Notes feature. It is in `SCHEMA.md` and on no screen in the
finished design. The owner chose to drop it rather than design a field for it.

**E-003 · `tag.colorIndex` dropped.** Colour belongs to the genre index now.
Tags render as uncoloured hairline pills (D-096), so a colour on a tag is a
value nothing reads — and a value nothing reads is a value that will eventually
be read by mistake.

**E-004 · `tag.groups: TagGroup[]` added, replacing single membership.** Closes
Q-016. "Body Horror" is both a Subgenre and a Content warning; "Slavery" is both
a Theme and a Content warning. Treating warning membership as winning meant
switching warnings off also removed a legitimate subgenre tag from a work —
correct by the letter of the rule and wrong in spirit. A tag is now hidden only
when Content warnings is its **only** group.
_Rejected:_ deduplicating the vocabulary so each string lives in one group —
that loses real information, because those strings genuinely are both things.

**E-005 · `readingSession` table added.** Stats leads with "chapters read"
(D-086) and nothing in `SCHEMA.md` produces it. Summing `progressCurrent` across
works is wrong the first time a value is corrected downward, and wrong forever
once re-reads exist. The sum of `delta` over logged sessions is the only honest
source. `delta` is denormalised so Stats is one query rather than a scan.

**E-006 · `settings.firstTrackedAt` added, stamped once.** "Years tracked" needs
an origin. The obvious stand-in — the earliest `dateAdded` — shrinks when the
oldest record is deleted, so the figure would silently go down. It is written on
first run in `loadSettings` and never again.

**E-007 · `settings` gained `contentWarningsOn`, `genreFilterMode`,
`welcomeSeenAt`, `tourCompletedAt`, `corpusSkippedAt`, `aiCallsDate`.** All are
state the finished design needs and v1 does not carry. `aiCallsDate` exists so
the daily cap resets on a real day boundary rather than on app launch.

### Engineering

**E-008 · `body` takes `--surface-base`, not the prototype's `#0A0E15`.** In the
prototype the body was the host page _around_ the 390×720 phone frame — a
surface that does not exist in the real app. Everything else in `base.css` is
ported verbatim. This is the only substitution and it is not a visual change.

**E-009 · The audit list is built in Phase 1, from the existing component
vocabulary.** [owner's call] An audit of the finished design found nineteen
places where a person could create or set something and never change it — most
importantly, no control anywhere changes a work's **status**, its **format**,
its **title**, or its **progress total**. The owner approved building all of
them, on the condition that nothing feels out of place. So each one is assembled
from components the design already specifies (LedgerRow, SegmentedPill, the
bottom sheet, the tag-picker pattern) rather than invented. Anything that turns
out to need a genuinely new shape stops and goes back to the owner.
_Not built, by the owner's decision:_ a star rating UI (the six axes do the job
better), the translation axis, and the per-work notes field.

**E-010 · No router library; the History API directly.** Roughly sixty lines in
`src/router/router.ts`. The design models the app as a screen plus a stack of
modal sheets, which maps onto pushState more directly than nested routes do, and
the behaviour that actually matters — back closes the topmost sheet before it
touches the screen — is easier to state explicitly than to configure. Keeps the
bundle at 97.5 kB gzipped against a 250 kB budget.
_Rejected:_ react-router (about 15 kB for a nesting model this app does not
have). _Ceiling, marked in the file:_ back only, no forward. In `display:
standalone` there is no forward affordance. Used as an ordinary browser tab it
would need popped layers kept in a redo stack.

**E-011 · Lateral tab moves replace rather than push.** Back from Stats returns
to what you were doing, not to the previous tab you happened to touch. Matches
the design's own treatment of lateral moves (D-057 / MOTION M-02), which skips
the cross-fade on the same reasoning.

**E-012 · `installHistory` is idempotent.** Found by a test that failed for the
"wrong" reason: two calls left two `popstate` listeners, so one back press
unwound two layers. React StrictMode's double-invoke and every HMR reload both
cause exactly that. Guarding inside the function makes the bug impossible
instead of making it something the call site has to remember.

**E-013 · `tag.normalizedName` is a UNIQUE index.** `SCHEMA.md` §7 says tags
merge on collision. A unique index makes the duplicate impossible to write,
rather than a rule every call site has to remember. Same reasoning for
`noteLink`'s compound `[noteId+workId]` primary key: attaching the same note to
the same work twice is not a second link.

**E-014 · Storage is UTC; every question is local.** `src/db/dates.ts` is the
only place allowed to turn an instant into a calendar day or year, and
`check:tokens` fails the build on any `.slice(0, 4|7|10)` elsewhere. Found by
opening the Phase 0 panel at 01:50 IST and seeing "first tracked 2026-09-02".
The same bug on 1 January would drop a book out of "finished in 2026".

**E-015 · The design contract is byte-compared in the gate.** `check:tokens`
diffs `src/styles/tokens.css` against `design/tokens.css` and
`src/data/taxonomy.json` against `design/ex-libris-taxonomy.json`, and checks the
twelve-row genre index table in tokens.css against the taxonomy. A work stores
the genre _index_, so a reorder recolours the whole library with no error
anywhere — it is the one drift that cannot be spotted by looking at the app.
This check caught Prettier silently reformatting `taxonomy.json` within an hour
of being written.

**E-016 · Fonts are self-hosted via `@fontsource`, not the Google CDN.** The
prototype linked `fonts.googleapis.com`. An offline-first app that fetches its
own typefaces renders in a fallback face the first time it is opened without
signal, which is exactly when it matters. Only the nine weights `tokens.css`
names are imported.

**E-017 · The catalogue is excluded from the Workbox precache.** It is
downloaded at runtime into OPFS. Precaching would put a second copy of hundreds
of megabytes into the Cache Storage API alongside the one in OPFS.

**E-018 · The app icon is assembled from the bookplate frame.** Claude Design
produced no icon. Rather than invent a mark, `scripts/icon.svg` reuses the
bookplate frame from the prototype — three nested rules, four corner diamonds,
four tick marks — on the dark page colour. The maskable variant is inset to 80%
because a circular launcher mask cuts exactly where the corner diamonds sit.
Flagged for the owner as Q-018.

**E-019 · Phase 0's UI is a diagnostics panel in the mono developer voice.** The
design package uses that voice for its own scaffolding (the jump bar, the state
pills), so a Phase 0 screen written in it cannot be mistaken for shipped UI. It
reports real state — an actual OPFS write/read/delete round trip, not a
capability sniff — so Phase 0 can be checked by hand rather than asserted. It is
deleted in Phase 1.

---

## 2026-09-03 · Phase 1

**E-020 · `setFormat` leaves `progressUnit` alone.** SCHEMA §1 says format is
decided by how a work is read and is never auto-corrected. Deriving the unit
from it would turn a page count into a chapter count on a shelf move: the number
on screen changes meaning without changing value, and nothing tells the reader.
The unit is a separate control on the same sheet, and the sheet says so.
_Rejected:_ following the format's default unit, which is what the creation path
does — correct at creation, wrong forever after.

**E-021 · Correcting a position and logging a session are different writes.**
`setProgressCurrent` may go backwards and records nothing; `logSession` may only
go forwards and records a `readingSession`. Without the split, fixing a mis-tap
would inflate "chapters read" permanently, because the figure is a sum over
sessions and a correction is not reading.

**E-022 · `nav.swap()` and `nav.closeAndPush()`.** Closing a sheet and opening
another is a race that loses: `close()` rewinds history and popstate arrives on
its own schedule, so a queued `open()` can land before the pop that then cancels
it. The FAB's "Add by hand" door opened nothing whenever the tap was faster than
a person's. Both new methods reuse the existing history entry rather than
adding one — the menu and the sheet it becomes are one step, and back from
either returns to the screen underneath.
_Rejected:_ a `setTimeout` past the pop, which is the same race with a longer
fuse.

**E-023 · Unbuilt screens are labelled in the mono developer voice.** The four
bottom-nav tabs all route somewhere, and three of them have no implementation
yet. A plausible-looking empty state there is indistinguishable from a screen
whose data failed to load, so each says "not built yet · phase N" in the same
voice the design package uses for its own scaffolding.

**E-024 · The axis line is absent from detail until Phase 6, not stubbed.** The
design shows it on every detail screen. Rendering it with no way to rate is the
switch-with-nothing-behind-it the design itself refuses (Q-014), so it is left
out entirely and named in HANDOFF.md.

**E-025 · B1, the manual cover override, moves to Phase 4.** A user-supplied
cover and a fetched one share one path — store into OPFS, downscale, extract the
dominant colour, compute the contrast flag. Building that path in Phase 1 for
one caller and again in Phase 4 for the other is how the two diverge. Stated
rather than quietly dropped.

**E-026 · The trash screen does not promise a countdown it cannot run.** There
is no server and no background job, so thirty-day retention is enforced when the
app is opened. Leave it shut for two months and everything expires at once on
the next launch. The copy says "cleared the next time you open the app after
that" instead of implying a running clock. Closes Q-021.

**E-027 · `src/ui/design-literals.ts` holds the values the design uses that
tokens.css does not define** — the two scrims, the gold-leaf gradient, three
sets of stagger delays, and one unmount timeout. `tokens.css` is byte-frozen so
they cannot go there, and scattering them through components is how a value ends
up with two slightly different answers. Every line carries `tokens-allow`, and
being forced to write that word is the point: adding a literal is a deliberate
act. Past a dozen entries, that is the signal to ask for a tokens.css revision
rather than keep appending.

**E-028 · Reaching the published edge ASKS, once.** [owner's call, closing
Q-022] A session that reaches the last chapter released so far of an ongoing
serial does not close the sheet — it becomes an offer to mark the work Caught
up, with "Leave it as Reading" beside it. Declining closes the sheet and the
question is not asked again.
Chosen over leaving the contradiction (the progress row saying "published"
while the pill says Reading) and over deriving the status, which SCHEMA §1
forbids outright: `status` describes the reader. The offer shape is the app's
existing one — the same suggest-never-apply the series suggestion uses.
_Why in the sheet rather than on detail:_ the moment it becomes true is the
moment the session is saved, and asking there needs no stored "already
declined" flag. Asking later would.

**E-029 · Export ships in Phase 1, as data.json alone.** SCHEMA §11's finished
export is a .zip with user covers and a manifest; that is Phase 8. But the
design's Settings has an "Export a copy" row with no handler, and that is the
wrong row to leave inert — it is the only protection against losing the device.
Today data.json IS the whole library, because there is no cover pipeline until
Phase 4, so nothing is silently omitted.

**E-030 · The add sheet takes its defaults from the screen it was opened
from.** Adding from the Wishlist means adding to the wishlist; adding from the
Books shelf means adding a book, counted in pages. Defaulting to Reading and
Novels everywhere made the reader correct the same two controls every time.

**E-031 · Every hairline-divided meta string trails its rule.** The rule goes
AFTER each part except the last, inside the same nowrap span, so a wrapped line
never begins with an orphaned separator. The design established this for the
axis line (D-010); it was not written down as a general rule, and the wishlist
row got it wrong until a screenshot showed a hairline sitting alone at the start
of a line.

---

## 2026-09-03 · Phase 2 — the corpus pipeline

**E-032 · `node:sqlite`, not better-sqlite3 or sql.js.** Node 24 ships SQLite
3.50 with FTS5, `unicode61 remove_diacritics 2` and prefix indexes — every
option SCHEMA §10 names. Verified before the pipeline was written rather than
after. The alternative was a native module needing a C++ toolchain on Windows.
_Ceiling, marked in the file:_ it is flagged experimental, so the API could move
under a Node upgrade. Contained: it is a build-time tool run by hand on one
machine, and what it produces is a plain SQLite file the app reads through
wa-sqlite. Nothing at runtime touches it.

**E-033 · The pipeline imports the app's `sortTitleOf` rather than its own.**
`title_normalized` is what the FTS5 index holds and what the app builds its side
of the comparison with. Two implementations would drift and search would quietly
stop finding things — the exact failure the one-source-of-truth rule exists to
prevent.

**E-034 · JSONL between stages, never JSON.** A 600,000-row array must be
complete before it parses, so a crash costs the whole stage. A line is a row and
a torn final line costs one row.

**E-035 · `acquire` is excluded from `all`.** It downloads 16.2 GB. A command
called "all" should not start that without being asked, and the editions dump
(11.7 GB) is skipped even then unless `--force` is passed, because nothing in
the current filter predicate reads it.

**E-036 · `format_hint` records what an AniList row IS, not what was searched
for.** The most consequential decision of the phase, and it came from reading
one sample rather than from reasoning. AniList's `type: MANGA` covers comics and
light novels, and for Chinese and Korean web fiction it very often holds ONLY
the comic adaptation, under the novel's name, with the comic's chapter count.
Verified live: Reverend Insanity returns a 96-chapter CANCELLED manhua where the
novel is 2,334 chapters; Lord of the Mysteries returns a 65-chapter manhua where
the novel is 1,432. Shadow Slave and Kill the Sun return nothing at all.
So a MANGA row is labelled `manhwa` and the add flow must show that label. A
mislabelled record is worse than a missing one: the reader would get a chapter
count wrong by a factor of twenty-four and no signal that anything was off.

**E-037 · Cross-source merging is a second pass on title, with two rules learned
from the data.** Matching on title AND author left 256 duplicate title groups —
6.5% of a 4,000-row sample — because AniList reads a "Story" staff credit and
MangaDex an author relationship, and the two romanise names differently. The
second pass matches on normalised title and then applies:

1. **Never merge two records from the same source.** AniList already dedupes
   itself, so two of its rows sharing a title are two works — the sample
   contains Toradora!, Shield Hero, Konosuba and Eminence in Shadow, each
   appearing twice because AniList holds the light novel AND its manga.
2. **Country must agree where both know it.** It is the one field separating
   same-titled works from different traditions — the Korean "Wind Breaker" from
   the Japanese one.
   A group holding two rows from one source is left alone entirely rather than
   guessed at. Result: 240 further merges, 16 groups correctly left apart, and
   every one of those 16 checked by hand.
   _Why conservative:_ merging two different works is invisible and permanent;
   failing to merge two of the same shows up as a duplicate in search, which the
   reader can see and report. The visible failure is the better one.

**E-038 · `total_entries` and universes stay NULL and empty until Wikidata
runs.** What the corpus knows about a series is not what exists, and only
Wikidata states that several series share a continuity. A count derived from a
relation cluster would be a wrong denominator under a completion ring, and an
invented universe is a confident wrong grouping — both are exactly what the
series cascade is written to avoid.

**E-039 · `synonyms` added to `corpus_work` and to the FTS index.** SCHEMA §10
lists title, title_normalized and authors. Alternate and native titles are how a
reader actually finds a translated work — "Na Honjaman Level Up" for Solo
Leveling — and without them a search for the name someone knows it by returns
nothing. Corpus-internal: the table is read-only, never backed up, and
`CorpusMatch` (SCHEMA §9.1) is unchanged, so nothing design-visible moves.

---

## 2026-09-04 · Codex transition and Phase 3 direction

**E-040 · The catalogue ships as a small core plus an optional Open Library
module.** [owner's call, closing Q-023] The owner chose the third option: put
the comics/light-novel catalogue on the device first, and make the much larger
Open Library portion a separate explicit download. The 608 MB projection came
from an all-comics sample and remains an upper-bound estimate until the full
source mix is measured. The app shell, core catalogue, optional catalogue, and
cover cache must report their sizes separately rather than pretending there is
one fixed final-build number.

**E-041 · Do not contact the unlicensed web-novel dataset owner, and do not use
the dataset without a compatible licence.** [owner answered Q-024; licensing
constraint closes it] No GitHub issue or other outward contact will be made.
The absence of a LICENSE file means the data cannot be ingested or redistributed
by this project. Manual entry and paste-list import remain the safe fallback for
pure web novels until a legitimately licensed metadata source is found.

**E-042 · Every frontend phase is checked against the approved design and then
hosted locally for owner review.** "Same but better" means preserving the
accepted visual language, copy, hierarchy, and interaction behavior while
making implementation-level improvements. A phase report must say what was
compared and must not claim visual parity without a real browser check. After
the gate, expose the completed build on localhost for the owner's review.

**E-043 · Phases may be paired only when both are genuinely small.** Each still
keeps its own acceptance checkpoint and documentation. Phase 3 is not small: it
adds a WASM database runtime, worker boundary, resumable OPFS installation,
search UI, and a real-device latency gate, so it runs alone.

**E-044 · The Claude Design frontend is frozen unless the owner approves a
specific upgrade first.** [owner's explicit clarification] Faithfully porting
an already approved state is implementation, not redesign. Any change to the
visible composition, typography, colour, copy, motion, hierarchy, navigation,
or interaction language must be proposed concretely and approved before it is
made. "Same but better" is a quality target, not standing permission to change
the design.

**E-045 · The Phase 2 AniList sample is an engineering fixture, not shippable
catalogue data.** A source re-audit before Phase 3 found that AniList's current
terms prohibit hoarding or mass collection and restrict competing list/tracker
services. This supersedes the source-composition part of E-040, not its modular
size decision. Offline catalogue builds must use data with express bulk-reuse
permission. Open Library bulk metadata and Wikidata CC0 are the safe leads;
MangaDex remains a possible credited on-demand integration, not a bulk snapshot,
until its redistribution permission is clear.

**E-046 · Phase 3 uses the recommended mixed licensed catalogue.** [owner's
call, closing Q-025] The offline corpus is built from a deliberately small,
filtered Open Library/Wikidata core, with broad Open Library data as a separate
optional download. MangaDex is a credited, user-initiated live lookup that
caches only the work the reader chooses. AniList is excluded from production;
pure web novels remain manual/paste entry until a legitimate metadata source
exists.

**E-047 · Every product surface has to earn its place.** [owner's explicit
rule] A feature, screen, control, or state ships only when it serves an obvious,
useful reader task and appears where the reader would reasonably expect it.
Every visible control must perform the action its label promises. Speculative
features, ornamental or empty screens, duplicate routes or search fields for the
same task, and inert controls do not ship. Expected recovery, empty, loading,
offline, and error states are part of a feature rather than optional polish. At
phase boundaries Codex may propose a useful improvement with a before/after
comparison, but E-044 still requires approval before any visible change.

**E-048 · The attached data-source guide is research input, not product
authority.** [owner's explicit clarification] Keep source and licensing facts
that survive verification against current official material. Treat its feature,
architecture, and design suggestions lightly: compare any promising suggestion
with the approved Ex Libris design and obtain permission before adopting it.
Nothing in the guide supersedes the on-device, offline-first, no-account product
contract.

**E-049 · Runtime uses the pinned JourneyApps wa-sqlite FTS5 build.** Upstream
wa-sqlite intentionally omits FTS5 from its default WebAssembly artifacts. The
MIT-licensed PowerSync/JourneyApps fork compiles `SQLITE_ENABLE_FTS5`; version
0.4.2 is pinned because it retains the small upstream API and OPFS VFS shape and
has no post-install network script. This is still wa-sqlite, not an in-memory
`sql.js` substitution, and the corpus continues to be paged from OPFS.

**E-050 · Catalogue integrity is proven before and during delivery, without
making the runtime database writable.** The build runs FTS5-aware
`PRAGMA quick_check(1)` before emitting a manifest. The manifest contains a
whole-file SHA-256 plus a contiguous 4 MiB chunk map. Installation verifies
every chunk before it advances its resume marker, then checks final byte size,
row count, and a real FTS5 query before switching the one-row active-version
pointer. FTS5 implements its own quick-check path as a special write, so running
that command against the immutable runtime handle fails even for a healthy
database; it belongs in the writable build stage, not behind a relaxed runtime
open mode.

**E-051 · Pixel emulation is a regression test, not the Phase 3 performance
gate.** The real worker/OPFS test currently measures roughly 46-55 ms for the
first cold three-character query and 1-4 ms for subsequent queries against the
3,722-work engineering fixture on this desktop. The test alarms above 100 ms
for the cold path and requires every warmed run under 50 ms. Only a physical
mid-range Android measurement can close the brief's strict under-50-ms gate;
viewport and user-agent emulation do not emulate phone storage or CPU.

## 2026-09-05 · Owner's Phase 3 continuation approvals

**E-052 · Q-026's five-part bundle is approved, with "search online" wording.**
Catalogue Add opens the existing editable add sheet with known metadata and an
explicit reader-selected status. Show linked MangaDex credit and truthful source
scope. The catalogue explanation reads "Search the downloaded index, or search
online. Anything you add stays in your library." The skip line reads "Skip it —
you can add by hand or search online." The real Everything empty-library and
Any-filter empty states are approved. This is not permission to redesign.

**E-053 · Q-027's Inventaire download and evaluation are approved.** Download
one current own-entity dump, inspect actual records and quantify usable coverage
before recommending its role in the core. The old 16.2 GB acquisition is still
not authorized. Preserve source provenance and keep images outside bulk data.

**E-054 · Connection changes receive quiet, accurate in-app feedback.** The
owner requested connection feedback. Use the existing toast language to report
initial offline state, loss of connection and reconnection; do not announce
"offline" when online. Browser connectivity is not proof an API is reachable.
This permits in-app status feedback, not push notifications or background calls.

**E-055 · Guide ideas are accepted for their relevant later phases.** Multiple
named reading orders and a mid-series/starting-point warning belong to Phase 5.
Edition-specific page counts may be adopted in Phase 4 if the real metadata
supports them usefully. Exact visible departures still need a concrete design
comparison. These approvals do not authorize starting Phase 4 during Phase 3.

**E-056 · Inventaire stays research-only; keep Open Library + Wikidata.** After
the real Inventaire audit, the owner explicitly declined a proposed Inventaire

- Wikidata core and selected the previously approved Open Library + Wikidata
  core. Do not ingest Inventaire into the shipped catalogue. The approved
  Inventaire download is retained locally as audit evidence; this is not
  permission for the separate Open Library source acquisition.

**E-057 · Production and engineering-fixture corpus builds use mechanically
separate merge paths.** The default and `all` pipeline paths accept resolved
Open Library rows plus a complete Wikidata stage and ignore any AniList or
MangaDex cache already on disk. Rebuilding the local 3,722-work runtime fixture
requires the explicitly named `fixture-merge` stage; its manifest remains
marked `engineering-fixture`, so a normal Vite build removes it. Open Library
author keys are resolved against the authors dump before production merge, and
only unambiguous Wikidata P179 memberships are attached through P648 work IDs.
This makes source permission a property of the command path rather than a
remembered warning.

**E-058 · A waiting service-worker release activates on app relaunch, not in
the middle of a session.** Keep prompt-style Workbox registration. The next
worker may install while the current app remains open, but it takes control
after the reader closes and reopens the PWA. A production-browser regression
test proves that the upgrade preserves IndexedDB user data and the OPFS
catalogue and that the replacement shell works offline. No reload prompt or
new visible design is added in Phase 3.

**E-059 · The bounded 4.84 GB Open Library transfer is approved.** The owner
explicitly approved downloading the dated 2026-08-31 Open Library works dump
(4,058,336,593 bytes) and authors dump (779,810,028 bytes) for the licensed
Open Library + Wikidata production core. Editions remain excluded. The owner
then assigned a separate two-concept design task and instructed that it be
completed first, so the approved transfer has not started yet.

**E-060 · Phase 4 owns the next approved design corrections.** Do not implement
them during Phase 3 or the isolated concept exercise. When Phase 4 starts:
restore the missing spotlight onboarding after Welcome and Bookplate; give
Books, Novels, and Manhwa persistent book/spine markers even when a shelf is
empty; and replace the current bottom navigation with a surprising, premium,
smooth treatment. These are upgrades inside Claude Design's established system,
not permission to discard its screens or visual identity. Necessary additions
are allowed when they serve an expected reader task, but they must remain
intentional, uncomplicated, and visibly part of the same product.

## 2026-09-06 · Unified design and execution approval

**E-061 · The approved visual evolution keeps Claude Design as the product
identity and uses the two concepts only in bounded roles.** Claude continues to
own onboarding, the constellation, dark palette, drawer, FAB and sheets,
Wishlist/Surprise me, Trash, illustrations, personal reading moments and motion.
Registered Index supplies the operational hierarchy, restrained colour, rules,
metadata and catalogue grammar. Night Route contributes only functional
progress paths, shelf markers and state transitions; it does not add a third
palette or type system. Light remains warm cream, dark remains Claude's
blue-grey, and the final type roles remain Sansita display, Montserrat
Alternates interface and Taviraj reading copy. Phase 4 begins with a separately
hosted four-screen approval prototype before these changes enter production.

**E-062 · All thirteen approved illustrations and their placement rules are
preserved.** The files, harmonisation and established Bookplate/About, empty,
finish, Stats and blank-editor assignments in `design/ILLUSTRATION-NOTES.md`
remain authoritative. One illustration appears per screen; populated product
screens and navigation chrome do not acquire decorative art. The finish moment
and empty note body remain the only approved behind-content exceptions.

**E-063 · Active builds stay reviewable, while phase gates remain truthful.** A
Vite development build is exposed on port 5173 during frontend implementation;
the Phase 4 approval prototype uses 4184; a completed production checkpoint uses 4173. A dev/preview server is stopped before the repository build or gate, then
the verified result is hosted again. Phase 3 and Phase 4 run alone. Later phases
may be paired only when both are genuinely small, are announced first, and keep
separate gates and documentation checkpoints. Work stops after one phase or an
announced pair for owner review.

**E-064 · Large production JSONL transforms checkpoint source position and
exact output bytes together.** A review before streaming the Open Library dump
found that the works stage advertised resumability but truncated its partial
output on restart. The corrected boundary flushes output before checkpointing,
truncates any uncommitted tail on resume, and restarts instead of skipping input
if the file is shorter than the checkpoint promise. Wikidata uses the same
paired boundary. A regression test was observed failing with tail truncation
removed and passing after the correction was restored.

**E-065 · The first production catalogue is the measured 438,584-work bounded
Open Library/Wikidata core.** [supersedes E-040's size projection and E-059's
pending state] A title/author/cover-only pass kept 9,302,140 rows and produced
5.43 GB of JSONL, so it was rejected without building or shipping it. The core
requires title, author and a positive cover, then keeps either at least four
subjects including standalone `fiction` but not `non-fiction`, or an explicit
Wikidata P179 membership joinable through P648. The completed result is
273,784,832 bytes (261.1 MiB), contains 438,584 resolved and conservatively
merged works, and carries 2,185 series with 7,222 linked works. Open Library's
work dump supplied no usable language field, so this boundary does not claim
English-only coverage. Broad Open Library remains an optional later module;
manual entry remains the honest web-novel fallback.

**E-066 · Production and Playwright catalogue artifacts are physically
separate.** `public/corpus` holds only the licensed production artifact.
`fixture-merge fixture-build` reads only the AniList/MangaDex engineering
inputs and writes the 3,722-work fixture to
`pipeline/.cache/fixture-corpus`. A test-mode Vite build validates its
`engineering-fixture` marker before copying it into test `dist`; a normal build
retains the production-marked public corpus. A measured fixture rebuild left
the production SQLite SHA-256 unchanged. This supersedes E-057's earlier layout
without changing its source-permission boundary.

**E-067 · Exact normalized titles outrank broader prefix matches through one
shared query definition.** The production quality probe exposed raw BM25
placing “Dunedin” above Frank Herbert's “Dune”. The worker now ranks an exact
normalized title first, then a title prefix, then weighted BM25, popularity and
title. The worker and post-build inspection tool import the same SQL and
binding builder so their result order cannot drift silently. The hosted
production build visibly returns Frank Herbert's **Dune** first.

**E-068 · The physical Android catalogue benchmark is deferred, not waived or
passed.** The owner explicitly said phone testing is not needed right now and
authorized progression to the next planned phase. Phase 4 may therefore begin,
but Q-028 remains an unpassed release-quality check. Desktop Pixel emulation,
desktop OPFS measurements and a missing device must never be rewritten as a
physical-phone result.

**E-069 · The Phase 4 Registered Folio prototype is approved with five exact
production corrections.** The owner approved the unified Claude/Registered
Index direction and authorized production implementation. The drawer keeps its
Claude structure but opens and closes more deliberately and drops separator
rules between destinations. The floating Add control returns to Claude's
two-action icon bloom instead of opening a card, and becomes the established
pencil action on Notes. Home's Continue record keeps its cover-led hierarchy
but uses a neutral surface rather than a cover-derived background; the whole
record opens its detail, and the constellation spans the complete visible Home
canvas. These changes are the approved Phase 4 design boundary, not permission
for a broader redesign. The separate prototype is now a frozen reference;
further review happens in the production PWA.

**E-070 · Series and universe discovery remains a Phase 5 suggest-and-confirm
workflow.** Catalogue and manual-add flows may show a work's detected ordinal,
series, series position within a universe, and choices to add the whole series
or universe once Phase 5 is built. Detection must not silently reorganize the
reader's library: incomplete, conflicting, or ambiguous relationships are
presented for confirmation, and standalone works remain standalone. Phase 4
does not pull this relationship engine forward.

## 2026-09-07 · Phase 4 production checkpoint

**E-071 · OPFS is the only durable runtime cover cache.** User and API images
occupy separate unique paths under `covers/user/<work>/` and
`covers/api/<work>/`. A candidate is decoded, downscaled to at most about 600 px
wide without upscaling, and committed to OPFS before Dexie points to it. A user
cover wins over a late API response. `coverSource` describes a locally committed
file, so a remote URL alone remains `none`; failure preserves the last good
cover and exposes retry. The former 30-day Workbox image cache is removed to
avoid keeping the same image twice. This resolves Q-020.

**E-072 · Phase 4 restores useful baseline Notes and spine surfaces without
claiming their later phases.** Notes now supports truthful plain-text create and
edit through Claude's pencil/card interaction; Phase 7 still owns links,
pinning, tags, attachments, cross-search, and full deletion behavior. Spine
view now renders the established fixed logarithmic widths and real work
navigation; Phase 9 still owns adaptive thresholds, virtualization, and the
60 fps gate. A visible Phase 4 control may not lead to a dead placeholder, but
that does not authorize pulling the complete later phase forward.

**E-073 · First-run settings creation is a serialized transaction.** React
StrictMode reproduced simultaneous first-load effects: two independent
get/add sequences raced on the `singleton` key and could leave a genuinely new
launch blank. `loadSettings` now reads, creates, and updates inside one Dexie
read-write transaction. The regression test was observed failing with the
transaction removed and passing after restoration.

**E-074 · Phase 4 is implemented and stops for production review.** The five
corrections approved in E-069 are present in the real PWA together with the
spotlight tour, permanent shelf markers, editorial Everything/detail hierarchy,
working custom covers, the Open Library per-record metadata client, and the
four-zone dock. The complete gate passes with 153 unit tests and 26 production
Pixel 7 journeys. This records an implementation checkpoint, not permission to
begin Phase 5; the owner must review the hosted production build first.

## 2026-09-07 · Post-review corrections and Phase 5 start

**E-075 · Phase 5 is authorized and active.** The owner reviewed the approved
Phase 4 direction, asked for the remaining illustration/interaction corrections,
and explicitly said to continue the next phase. This supersedes E-074's hold.
Phase 5 still runs alone and must stop before Phase 6 for a gate, hosted build,
documentation update, and owner review.

**E-076 · Illustration colour treatment is theme-specific while source art stays
immutable.** [Supersedes the single rendered palette portion of E-062 and design
D-020.] The owner observed that the dragon belonged in dark mode while the
orange Wishlist blossom belonged in light mode and asked for every illustration
to be art-directed for both themes without flattening its detail. The 13 source
SVGs remain byte-identical; a deterministic OKLCH build step emits warm-paper
and blue-grey-night variants while preserving per-colour lightness and
distinctions. `magic-tree-cuate` stays unchanged in both sets. Placement and
one-illustration-per-screen rules remain unchanged.

**E-077 · Perceptible work gets named delayed feedback; instant state changes do
not flash loaders.** Every tap receives immediate physical/transition feedback.
Only a real asynchronous operation still pending after 180 ms shows the compact
Ex Libris registering-book status mark with accurate text. The mark is not a
spinner, fake percentage, skeleton, or artificial delay; reduced motion leaves
it still. The originating action retains responsibility for success, failure,
and rollback.

**E-078 · Relationship resolution is evidence-first and write-free until a
separate confirmation.** Exact `corpusId` relationship evidence wins. Without
it, only explicit ordinal title patterns may propose a series; matching an
existing local series requires a unique high similarity. Corpus, pattern, and
low-confidence library evidence are labelled distinctly. Series and universe
are separate offers and separate transactions. A standalone or ambiguous work
is never silently grouped.

**E-079 · Confirmed catalogue series preserve ghosts and bulk-add only to
Wishlist.** Confirmation stores a named Publication order with real local rows
and dashed catalogue ghosts. A known series total powers `finished / known
total`; no total means no ring. If the reader explicitly chooses the whole-series
action, verified missing entries with known formats are added transactionally to
Wishlist, deduplicated by `corpusId`. Unknown-format entries require individual
shelf confirmation. The production catalogue contains zero verified universes,
so Add whole universe is intentionally absent until complete membership evidence
exists.

**E-080 · Remaining work optimizes for correct completion, not maximum
process.** Use the minimum cohesive change, current architecture, relevant-file
inspection, batched work, proportional testing, and a single agent by default.
Do not widen scope, add speculative abstractions, repeatedly rediscover the repo,
or polish beyond the phase definition of done. Delegate only independent work
that materially improves time or correctness. Stop when the phase is integrated,
adequately verified, documented, and free of known blockers.

## 2026-09-08 · Phase 5 implementation checkpoint

**E-081 · Reading orders remain named, plural, non-canonical records.** A series
or universe may keep several independently named sequences. The editor may
create, rename, explain, reorder, remove/re-add entries, and delete an order, but
selecting or saving one never silently makes it the default. Saving an existing
order commits its metadata and complete sequence in one transaction. A universe
starting point remains a separate optional note that can be saved or cleared
without mutating any named order.

**E-082 · Phase 5 perceptible operations use the shared delayed feedback
boundary.** Exact catalogue relationship lookup and every current Phase 5 write
that may remain pending—confirmation, missing-entry Wishlist addition, manual
relationship save, order create/save/delete, starting-point save, ghost open,
and Detail remove/restore—uses the 180 ms registering-book acknowledgement from
E-077. Immediate field entry, selection, and purely synchronous navigation keep
press/transition feedback and do not flash a loader.

**E-083 · Browser E2E runs serially when enforcing real worker/OPFS latency.**
The unchanged catalogue latency journey passed alone but failed twice while four
emulated phones competed for the same desktop CPU, including a 196.6 ms cold
measurement. The gate now uses one Playwright worker so its strict cold and warm
thresholds measure the app rather than deliberate host contention. No assertion,
timeout, catalogue implementation, or physical-phone Q-028 requirement was
relaxed.

**E-084 · Phase 5 implementation is complete and stops for owner review.** The
series/universe resolution cascade, explicit confirmation, ghosts, Wishlist bulk
addition, truthful rings, series/universe pages, manual relationship editor,
post-add offers, multiple named-order editor, separate universe starting point,
and interaction-feedback audit are present. Pixel 7 light/dark review and the
full 170-unit / 30-E2E gate passed; the exact production build is hosted on 4173.
This is an implementation checkpoint, not authorization to begin Phase 6.

**E-085 · Bulk Wishlist addition discloses every exact title before writing.**
The owner approved the post-checkpoint proposal. After series confirmation, the
suggestion card lists each missing catalogue title and any stated series position
in a bounded scroll region immediately above the bulk action. The transaction,
format gate, deduplication, and rollback semantics from E-079 are unchanged; the
reader now sees the complete consequence rather than only a count.

**E-086 · Phase 5 is accepted and Phase 6 is authorized.** The owner accepted
the disclosure proposal and explicitly instructed work to continue with the next
phase. Phase 6 still runs alone and stops before Phase 7. Q-017 is now blocking
because omitting translation and showing it for every work produce different
axis walkthroughs; the former per-work gate is not the owner's stated intent.

**E-087 · Translation always appears, but matching remains six-axis.** [Settles
Q-017 and supersedes design COMPONENTS' per-work `isTranslated` gate.] The owner
chose the always-visible option because almost everything they read is
translated and Rough-to-Fluent remains meaningful. Translation is therefore the
seventh optional editing step for every work. The recommendation distance and
minimum-overlap rules continue to use protagonist, power system, world, pacing,
prose, and ending only; `work.isTranslated` remains compatibility data and does
not control the interface.

**E-088 · Phase 6 matching is sparse, local, weighted, and word-explained.** A
candidate is another non-Wishlist, non-deleted work in the reader's library. At
least three of the six matching axes must be rated on both works; missing values
are ignored. Protagonist, power system, and world carry weight 3; ending carries
2; pacing and prose carry 1. Normalized distance ranks candidates, but a result
must share at least one exact stop and the interface displays up to three exact
matching words rather than the score. Translation is excluded under E-087.

**E-089 · Phase 6 implementation stops at the owner checkpoint.** The existing
axisRating store now has validated transactional writes; Ending and Unfinished
are Finished-only and mutually exclusive; correcting Finished clears those two
facts. Both finish entry paths open the frozen FinishMoment, each Detail profile
word opens its named axis, and slow saves use E-077's delayed feedback boundary.
Explicit Pixel 7 light/dark review and the full 178-unit / 33-E2E gate passed;
the exact build is hosted on 4173. Phase 7 is not authorized by this checkpoint.

**E-090 · A note attachment is a link to a work, not a binary file.** Phase 7
implements the frozen editor's “Attach to a work” control through the existing
`noteLink` table. The current schema and product brief define no binary note
attachment entity, so files and media are outside this phase rather than being
silently invented.

**E-091 · Notes, links, tags, and their counts share one transactional
boundary.** Creating or editing a note validates every attached work, resolves
and deduplicates tag names, replaces links, and refreshes affected usage counts
in one transaction. A tag's usage count includes active works and active notes.
Notes use the established soft-delete, restore, expiry, and permanent-purge
semantics. Soft-deleting a work preserves its note links so restore is lossless;
permanently deleting it removes only those links, never the note.

**E-092 · Phase 7 is complete and stops at the owner checkpoint.** The frozen
notes feed and editor now support pinned-first ordering, work attachments, the
nested tag picker, cross-search, linked notes on Detail, and complete Trash
behavior. Pixel 7 light/dark review and the full 181-unit / 36-E2E gate passed;
the exact gate build is hosted on 4173. Phase 8 has not begun.

**E-093 · A complete backup is one verified ZIP with portable data and only
irreplaceable cover bytes.** Automatic and manual snapshots share the same
transactionally read `data.json` and manifest. Every user-supplied cover is
included; replaceable API-cover bytes are removed with their local pointer, and
`aiApiKey` is excluded. Catalogue-install flags, backup timestamps, and the API
key remain local to the restoring device because the archive does not carry the
corresponding OPFS catalogue or secret.

**E-094 · Restore and import show their consequence before one transactional
write.** Restore validates ZIP structure, checksums, counts, relationships, and
complete user covers before offering Merge (default) or Replace. Replace makes
a local safety snapshot when any user table contains data, not only when works
exist. Paste and CSV imports remain editable/skippable until confirmation;
catalogue replacement requires an exact normalized title. A CSV-only “Caught
up” value becomes visible Reading because publication state is unavailable and
the app may not silently assert an ongoing/hiatus relationship.

**E-095 · The share target enters the existing acquisition path through
Wishlist.** A shared title, text, or URL opens the catalogue with the shared
words intact over Wishlist. If no catalogue record is available, Add by hand
keeps those words and defaults the new work to Wishlist. This is one existing
search/add experience, not a duplicate share-only screen.

**E-096 · Phase 8 implementation stops at the owner checkpoint.** Automatic
48-hour OPFS snapshots with ten-file rotation, complete ZIP export/restore,
legacy JSON normalization, paste/CSV import, share-target cold start, and
cover-safe rollback are integrated. Pixel 7 light/dark review and the full
189-unit / 40-E2E gate passed; the exact build is hosted on 4173. Phase 9 has not
begun and is not authorized by this checkpoint.

**E-097 · Phase 8 is accepted and Phase 9 is authorized.** After confirming the
apparently missing Notes controls were only a stale already-open bundle, the
owner accepted the data-safety checkpoint for sequencing and explicitly asked
to continue with the next phase. Phase 9 runs alone and stops before Phase 10.

**E-098 · Adaptive spine widths use per-unit quintiles only with enough real
lengths.** [Settles Q-019 and visibly evolves D-027/D-034.] The owner approved
the proposal by instructing work to continue. Chapter and page distributions
are independent. At least forty known lengths in a unit produces four strict
20/40/60/80-percentile boundaries and live Width Key labels; smaller samples
retain the fixed logarithmic ladder. A library signature caches the exact
derived profile in settings and invalidates it after any relevant library or
length change. Unknown and percent-only lengths remain ordinary bucket 2 under
D-028.

**E-099 · Phase 9 implementation stops at the owner checkpoint.** Stats is a
live editorial ledger; Wishlist and Trash never inflate library counts, and
only chapter-unit sessions contribute to “chapters read.” Both approved Stats
illustrations retain their theme-specific derivatives. Spine shelves use
E-098's adaptive/fixed ladders, fixed-height row virtualization, and a shared
transition name only on the tapped cover. The definitive 204-unit / 43-E2E gate
passed, explicit Pixel 7 light/dark review passed, and the exact build is hosted
on 4173. Phase 10 has not begun and is not authorized by this checkpoint.

**E-100 · Phase 9 is accepted and Phase 10 is authorized.** The owner accepted
the Phase 9 checkpoint by explicitly instructing work to continue. Phase 10 is
the final documented roadmap phase and does not authorize an undocumented
later product phase.

**E-101 · Tag maintenance is explicit, exact, and restore-safe.** [Resolves
Q-008.] Settings offers manual rename, exact-destination merge, and deletion of
genuinely unreferenced tags. Rename-to-existing requires an explicit merge
confirmation. Merge rewrites both work and note ID lists, preserves group
membership, deduplicates links, and refreshes counts in one transaction. A tag
referenced only by Trash is visibly named as such and cannot be deleted, because
restoring the record must remain lossless. Similarity suggestions remain
unapproved and unimplemented.

**E-102 · Phase 10 implementation stops at the release-candidate checkpoint.**
Settings/About completion, settings rollback, tag maintenance, semantic and
touch-target corrections, keyboard behavior, final state/motion/navigation
audit, performance reruns, and explicit Pixel 7 light/dark inspection passed.
The definitive 207-unit / 46-E2E gate produced `index-Bz51j1Lk.js`, which is
hosted on 4173. Q-028 remains a deferred and unpassed physical-device gate;
emulation is not substituted for it. No Phase 11 exists in the current plan.

**E-103 · The owner-supplied reader-circle artwork is the release icon.**
[Resolves Q-018.] The supplied square artwork replaces the conservative
bookplate-frame icon after the owner explicitly asked that it be used for the
phone release. The regular master preserves the cream paper, ink circle,
reader, leaves, and red seal while removing the black mockup surround. A
separate maskable master keeps the full mark inside the platform safe zone.
`scripts/make-icons.mjs` deterministically produces the manifest's 192px,
512px, and maskable PNGs from those checked masters.

**E-104 · Installation is a real Settings state and the final first-run tour
step.** The final onboarding spotlight moves to the existing Settings screen.
When the browser exposes `beforeinstallprompt`, Install opens its native prompt;
otherwise the same control gives platform-appropriate manual steps. A launched
standalone app, or an accepted current prompt, shows a non-colour-only green
tick with `Installed`. Dismissal remains retryable, failure falls back to the
manual steps, and no unreliable installed flag is persisted in user data.

**E-105 · The public phone release uses a verified GitHub Pages project-site
build.** The owner authorized publication to
`Qusai-Badwaniwala/Ex-Libris`. Vite's base path, manifest, share target,
catalogue URL, illustration URLs, and route fallback all support
`/Ex-Libris/`. Because GitHub rejects the 261.1-MiB SQLite file as one Git blob,
the exact licensed production catalogue is stored as its existing 4-MiB
checksummed chunks. The Pages workflow reassembles and verifies all 273,784,832
bytes and the whole SHA-256 before upload. The AniList/MangaDex fixture remains
ignored and cannot enter the Pages artifact.
