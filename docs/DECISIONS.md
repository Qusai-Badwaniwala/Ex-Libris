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
