# HANDOFF.md
Written for someone with no memory of the conversation.

**New session? Read `START-HERE.md` first.** It is the full onboarding: what the project is, how the user works, where the work stands, and the traps. This file is the detail underneath it.

**Project:** Ex Libris — personal reading tracker PWA. Mobile-first, offline, single user.
**This session owns:** the entire visual system, every screen, all copy. Claude Code builds from the output.
**Read first:** `CLAUDE.md`, then `docs/brief.md` and `docs/schema.md` (extracted from the .docx uploads — read these, not the .docx).

## Current phase
**Phases 0 through 7 complete.** Phase 8 (loading skeletons, error states, virtualisation at 2,000 items) is next.

Standing instruction: **stop after every phase**, and raise questions or suggestions either before starting or after finishing one.

Phase 7 built: Wishlist with Surprise me, Stats, Notes, the note editor, Settings, Backup and restore with its three import paths, Corpus download, Trash, the left drawer, and About. The four tabs and the drawer are all live; the theme control in Settings drives the real theme. Two answered questions changed earlier work: the bookplate name is now required (Q-003, D-042) and `w6`'s corrupted author string is fixed.

Phase gates 2 and 3 were never formally answered — the cover flight and the axis scale both need a real thumb on a real phone. They are built and running; they have not been felt.

## Revisions after the Phase 7 review
The user reviewed Phase 7 and asked for eleven changes; all are in. Palette: light theme is cream and its overlay plane is now darker than the page (D-048); `--danger` added (D-047). Chrome: the bottom bar floats as a glass pill (D-049), the home wordmark is gone and search shares the drawer row (D-054), a boot splash gates the first paint until the illustrations are cached (D-050). Behaviour: back from Notes/Trash/Backup/About goes home (D-051), the FAB is a pencil on Notes and note cards open the editor (D-052). Motion: routine opens moved to `--ease-out` at 240ms, springs reserved for the FAB and its sheets (D-053).

Still open from that review: **Q-009**, what search means versus what the FAB means. A form is out with the user; nothing is built on it yet.

## Motion audit and the search/FAB split (1 September)
Ran the design-motion-principles audit skill in Audit mode against the whole system; the report is `Motion audit.dc.html` (nine findings, per-lens, severity-ranked, plus what already passes). All nine are applied or recorded — see DECISIONS D-057.

Q-009 is resolved (D-055): **search** is a full screen over works, notes and tags and never touches the catalogue; the **FAB** blooms into two named doors, "Add by hand" and "Search the catalogue". New in the prototype: the search screen, the FAB menu, the add-by-hand sheet, and a "Read one more" control on book detail. Jump bar gained search / catalogue / by hand.

Open: whether "corpus" should be renamed "catalogue" everywhere in the UI, or only where the user meets it.

## Palette, type and Phase 8 (1 September, later)
The user supplied a four-colour palette (Burnt Coffee, Champagne, Whiskey Sour, Honey Garlic) and three faces (Sansita, Montserrat Alternates, Taviraj). Both are in, both themes rebuilt — D-059, D-060. **Fraunces and IBM Plex Sans are gone from the UI**; `--display-vf` is a font WEIGHT now, not a variation axis, so never write `font-variation-settings` again in this project.

A tactile animation layer was added at the user's instruction (D-061): press-scale on every button, radial ripple on `[data-ripple]` controls, a GPU-hinted drawer whose rows cascade, 12ms haptics. Its tokens are `--duration-*` / `--ease-fluid-out` / `--ease-spring-back` / `--ease-standard` and they coexist with `--dur-*`; do not merge the two sets.

**Phase 8 is done** (D-063): skeleton, error states, and a windowed 2,000-row library. Jump bar: `skeleton`, `errors`, `2,000`.

## Dark theme, second pass (1 September, late)
Dark is now cool blue-grey off the user's ramp (D-064) — page at black-90, not black-100. Light stays cream and warm; the two themes are deliberately not mirrors. Drawer slowed to 380ms (D-065), light nav bar fixed (D-066).

Dark went monochrome on 1 September (D-067): no warm accent, the accent is a lifted blue-grey and reads by lightness. Light keeps Whiskey Sour — the themes are deliberately not the same theme inverted. The nav bar is liquid glass in three layers (D-068), and "Everything" is now the last row of Shelves on home (D-069).

## Phase 9 — the critique pass (2 September)
Four decisions, three of them removals. `--cool`/`--cool-deep` deleted, six usages folded into the existing text and surface tiers (D-070). "Corpus" became "catalogue" in every user-facing string while the schema keeps its word (D-071). The row numbers and the DOM-window counter came off the Everything screen (D-072). The warm genre chips were considered and deliberately kept as the only colour in the dark app (D-073).

**All nine phases are complete.** The remaining open questions in `OPEN-QUESTIONS.md` are for Claude Code or for real data, not for design.

## Onboarding (2 September)
Rebuilt from swipeable cards into: welcome screen → bookplate → a four-step spotlight tour on the real home screen (D-074). The tour measures its targets live from `[data-tour]` attributes — do not hardcode the rects when porting. Also fixed: the nav bar blending into the Everything list (D-075), the constellation's own colour tier (D-076), no chrome on welcome (D-077).

## Genre filter and a fifth tour step (2 September)
Everything now filters by genre with an Any/All toggle (D-078); the tour gained a step for it (D-079). Filtering runs before windowing — keep that order.

## Deletion and the theme control (2 September)
Delete affordances added in four places, graded by reversibility (D-080, D-081); sun/moon theme buttons on home (D-082). The prototype fakes removals with a `gone` array and an `armed` flag in state — Claude Code replaces both with real deletes against the store.

## Prototype state keying (2 September)
All fake mutations are keyed per entity now (D-092): `logs` is a map by work id, and `gone` uses namespaced keys (`wish:`/`note:`/`trash:` plus bare work ids). When you replace these with the real store, keep the namespacing — index keys and record ids sharing one array is what caused a wishlist removal to delete a library work.

## Reading sessions and five honesty fixes (2 September)
Sessions built and feeding Stats (D-086, closes Q-007). Search now names wishlist matches (D-087); note tags, attach-to-work search and the wishlist empty state were all non-functional and now work (D-088/089/090); "By Qusai" in the drawer (D-091). Re-reads remain deferred (Q-013) and **Ask a model still has a switch with nothing behind it** (Q-014) — read that before building the add flow.

## Genres and tags (2 September)
`docs/taxonomy.md` v1 implemented: 12 fixed genres mapped onto the existing palette (D-095 — **the index-to-genre table in tokens.css must not be reordered**), genre chips and tag pills visually separated (D-096), a full-screen tag picker over all 242 tags (D-097/098/099), content warnings opt-in behind one `tagPills()` gate (D-100), and the Stats bar merging sub-2% genres (D-101).
Works now carry `genres: [index]` (≤2, primary first) and `tags: [string]`. Section 6 of the taxonomy — source mapping — is unimplemented and is yours: nothing in the prototype ingests metadata.

---

## TRANSFER TO CLAUDE CODE

**Send all of these. They are written to be read in this order.**

| file | why it goes |
|---|---|
| `docs/brief.md` | the original brief. Everything else answers to it. |
| `docs/schema.md` | the data contract. Field names in the prototype match it. |
| `tokens.css` | **the design contract.** ~130 custom properties, both themes, reduced-motion block. Nothing in the build should hardcode a value that exists here. |
| `Ex Libris.dc.html` | the prototype. Twenty-three screens, dev jump bar, theme toggle. Read it as a specification of behaviour, not as source to port. |
| `DECISIONS.md` | 66 decisions with reasoning and what was rejected. Read before changing anything that looks arbitrary — most of it isn't. |
| `MOTION.md` | every duration, curve and choreography rule, plus what is deliberately NOT animated. |
| `COMPONENTS.md` | per-component anatomy, states, missing-data behaviour, tokens used. |
| `ILLUSTRATION-NOTES.md` + `illustrations/` | the thirteen SVGs and the `--il-*` recolour ramp. Inline them; `<img>` cannot resolve custom properties. |
| `OPEN-QUESTIONS.md` | what is still undecided, and who has to decide it. |
| `START-HERE.md` + `HANDOFF.md` | orientation. |
| `Motion audit.dc.html` | optional. The motion audit and its nine findings, all applied. |

**Not needed:** `support.js` (prototype runtime), `Direction.dc.html` and `Illustration plan.dc.html` (Phase 0 gate pages, superseded), `CLAUDE.md` (rules for this design project, not for the build).

### Sample data — ship it, do not clean it
The prototype goes over **with its fake data intact**. A cleaned prototype shows empty states and nothing else, and every layout decision in it was made against realistic content — long titles that wrap, a 1,140-chapter progress count, a series with a missing volume. Stripping that hides the reasoning.
Every fake constant is uppercase, declared at the top of the logic class, and carries a comment naming it for deletion:
`WORKS`, `NOTES`, `GENRES`, `SHELF_FILLER` (spine view only), `BIG` (the 2,000-row windowing demo), `ERRORS` (error-state copy — this one is real copy, keep the strings).
One known defect left in deliberately: sample work `w6` has a half-Cyrillic author string (`InesВарга`). It is a genuine encoding case worth testing against.

## Files
| file | what it is |
|---|---|
| `tokens.css` | the contract with Claude Code. 112 custom properties, both themes. |
| `Ex Libris.dc.html` | the running prototype. Ten screens, dev jump-bar at the top, theme toggle. |
| `Direction.dc.html` | Phase 0 gate page: type specimens, both palettes, scales, live motion curves |
| `Illustration plan.dc.html` | all thirteen illustrations with the screen each belongs to |
| `illustrations/*.svg` | harmonised, backgrounds stripped, literal hex. Originals untouched in `uploads/`. |
| `MOTION.md` | six choreography entries with real code, haptic points, what is deliberately still |
| `COMPONENTS.md` | eighteen components, each with a mandatory missing-data row |
| `ILLUSTRATION-NOTES.md` | the harmonisation method, the placements, the superseded method and why it failed |
| `DECISIONS.md` | D-001 to D-026, dated, append-only |
| `OPEN-QUESTIONS.md` | Q-001 to Q-006 |

## Screens in the prototype
Bookplate · Home · Novels (format list) · Novels (spine view) · Book detail · Add sheet · Series page · Universe page · Finish moment · Axis scale · Wishlist (plus the Surprise me card) · Stats · Notes · Note editor · Settings · Backup and restore (healthy and mid-restore) · Corpus download (downloading and update-ready) · Trash · About · the left drawer · Empty states (six, behind a switcher).

Backup and Corpus each carry two states, switched by mono pills inside the screen. Those pills are prototype scaffolding in the dev voice, not app UI.

Reach any of them from the mono jump-bar above the phone. `theme` toggles light and dark. Both are real.

## Decided by the user
- Serif **Fraunces** with `'SOFT' 20, 'WONK' 1` always. Interface **IBM Plex Sans**, not Inter.
- Theme: both equally. Density: between. Checkpoints: gates 0, 2, 3. Stop after Phase 5.
- Illustration: thirteen supplied Storyset SVGs, harmonised not flattened. `magic-tree-cuate` ships as drawn.
- **File size is never a constraint on this project.** Recorded in CLAUDE.md.

## Not built
- **Phase 8** — loading skeletons, error states, 2,000-item virtualisation behaviour.
- **Phase 9** — the critique pass. Nothing has had an accessory removed yet.
- Low-confidence series suggestions are specified in COMPONENTS.md but only the high-confidence card is rendered.
- Real cover images never arrived; covers are dominant-colour blocks, which double as the genuine `coverSource: 'none'` state (Q-001).

## Next three actions
1. Feel the cover flight and the axis scale on a real Android phone. Adjust `--ease-settle` / `--dur-slow` and the stop feel if they are wrong. These are gates 2 and 3, still unanswered.
2. Phase 8 — loading skeletons, error states, virtualisation behaviour at 2,000 items.
3. Phase 9 — the critique pass. Nothing has had an accessory removed yet.

## Things that will bite whoever picks this up
- Two live elements may never share a `view-transition-name`. The FAB is unmounted while the add sheet is open for exactly this reason, and a list cover only holds the name for the duration of the flight.
- `--font-display` is useless without `font-variation-settings`. Use `--display-vf`, `--display-vf-sm` or `--display-vf-xs` every time.
- `--text-muted` and `--text-faint` are **role-restricted**, not free choices. All metadata under 18.66px is `--text-secondary`. See D-016 and the comment block in tokens.css.
- `--cover-tint-amt` and `--genre-ink-amt` differ by theme on purpose. Hardcoding either reintroduces a measured AA failure.
- The axis track needs `touch-action: none`, or the gesture becomes a scroll on a phone.
- Spine heights come from a hash of the work id and **must stay deterministic**. Spine view virtualises by row; a random height makes spines jump as rows recycle.
- `SHELF_FILLER` in the logic class is prototype-only sample data for spine view. Delete it when wiring real data.
- The phone frame is 390×720 so the whole prototype fits a normal viewport at scale 1. Making it taller makes the host scale the page down, which is what "zoomed out" was.
- Illustrations are literal hex now, not `var()`. The `--il-*` tokens in tokens.css are inert.
- **The note editor shares `add-surface` with the add sheet.** It is the FAB's second expansion, so the FAB is unmounted while it is open and the transition name is reapplied inside the `setState` callback on close. `isEditor` is `s.editor && s.screen === 'notes'` and `nav()` clears `editor` — without both, the sheet leaks onto other screens.
- Phase 7 sample data (`WISH`, `NOTES`, `GENRES`, `TRASH_ITEMS`, `BK_HISTORY`, `ATTACH_HITS`) is prototype-only, same status as `SHELF_FILLER`.
- Two Stats figures are not in SCHEMA — chapters read and years tracked. See OPEN-QUESTIONS Q-007 before treating them as real.
