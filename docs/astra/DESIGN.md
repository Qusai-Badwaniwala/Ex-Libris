# Ex Libris — The Reading Room

**Historical first-experiment design record.** The owner subsequently approved
adoption on 2026-09-20. Dark colours, illustrations, relationship semantics and
Spines below are superseded by [the canonical design state](../DESIGN-STATE.md)
and [the adoption record](ADOPTION.md). This file preserves the original review.

This is an alternate frontend for evaluation, not an adopted production design.
The implementation stays in `astra/frontend-redesign` and uses the existing
React, Dexie, OPFS, catalogue worker, repository operations and history router.
No data migration, backend change, account, sync or new reading feature is added.
No prescriptive design skill was used.

## The idea

The book, the reader's place, and the next useful action should own the screen.
Ex Libris becomes a private reading room: typography and careful proportions
give it character, while lists and quiet rules make a substantial collection
easy to use. The identity is deliberately less ornamental than the current app.
It should reward repeated daily use, not just the first screenshot.

The opening view puts the current title in full, next to its real position and
session action. Other active works are compact, immediately readable rows.
Collection is the same library seen as an index, with formats, statuses, genres
and sorting together. Finished works keep their full colour and visual weight.
Unknown totals never become invented percentages.

## Visual system

- Literata variable is the voice of titles, records and reading prose. Source
  Sans 3 handles navigation, controls and supporting information. Both are
  self-hosted OFL fonts; only two Latin variable WOFF2 files are requested.
- Daylight uses mineral off-white, near-white raised surfaces, deep green-black
  text and a vermilion action colour. Night uses pine-charcoal, visibly distinct
  raised surfaces, warm pale text and a softer coral-vermilion accent. Neither
  theme is an inversion. Existing genre identities remain stable.
- New values live in `astra-tokens.css`; the original frozen token file remains
  byte-identical. `astra.css` owns the alternative composition. This separation
  makes evaluation reversible, but merging the two layers should be considered
  if the design is adopted.
- Rules separate records. Covers and modal sheets carry depth. Corners are
  restrained; plain rows do not become ornamental cards. Placeholder covers
  use typographic book treatment and do not pretend to be publisher artwork.
- Large title scales coexist with ordinary, readable controls. No content is
  made faint merely because the work is finished.

## Navigation and interaction

Phone destinations are Library, Wishlist, Notes and Stats. The centre action
adds a work, or writes a note inside Notes. Library contains Reading and
Collection. Search is always explicitly local; catalogue acquisition starts
through Add. The toolbar provides search, theme and a utility menu containing
Settings, Catalogue index, Backup and restore, Trash and About.

Existing screen and overlay routes remain in use. Each overlay owns history;
Back closes the top layer before returning through screens. Dirty notes now
require Keep editing or Discard changes. Session logging accepts a directly
typed destination as well as increments, through the existing repository call.
These are frontend protections and input changes, not new stored concepts.

Controls target at least 44 CSS pixels in height, with visible keyboard focus.
Sheets share a focus trap and restore focus to their trigger. The note editor
has a persistent bottom Save action and scrollable content. Search, filters,
publication state, axis editing, confirmation-only relationship writes and
transactional imports retain their real semantics.

## Motion and speed

Short press feedback, sheet arrival and existing cover continuity communicate
what caused a change. Navigation does not choreograph every row. Durations and
easing come from central tokens; reduced-motion disables unnecessary travel.
The old intentional boot delay and all-illustration preload gate are removed:
storage readiness, not a decorative timer, determines when the library opens.

Collection and spine shelves remain virtualized. No animation framework,
component framework or remote font request was introduced. Artwork is reused,
not replaced with large new assets. The optional catalogue stays outside the
service-worker precache and user backups.

## Responsive composition

At phone sizes, one scrollable task surface sits between the reachable bottom
navigation and compact utility toolbar. Detail gives the title the full width,
then puts cover and reading controls side by side. Sheets rise from the bottom;
the note editor fills the viewport.

From 768 pixels, destinations move to a left rail. Reading separates the current
book and the secondary register; Wishlist and Stats gain useful columns. Detail
uses a sticky reading summary beside its record. Collection becomes a two-column
virtualized index when its available width supports it. Utility pages have a
bounded measure. Notes use a centred writing sheet rather than a permanent
split editor: this keeps the same explicit draft-dismissal boundary on all sizes.

## Existing artwork

All thirteen original illustrations and their existing theme derivatives are
retained. Magic tree serves welcome/bookplate and About; dragon serves the empty
library; library-pana explains catalogue installation; cherry-tree-pana marks
finishing; knowledge-rafiki and cherry-tree-amico accompany Stats; cherry-blossom
serves the empty Wishlist; research-paper-amico serves empty Notes; studying-bro
appears only in the blank editor; library-rafiki serves empty Collection;
bibliophile illustrations remain available in search, Trash and Backup contexts.
No original SVG was edited. Artwork is given a bounded place in a composition,
not used as a giant low-opacity wallpaper behind controls.

## Adoption implications

Review the entire prototype before merging. Retain existing database and OPFS
contracts, reset/export/import/restore paths and licensed catalogue boundaries.
The preview manifest name/id, localhost ports and explicit `?evaluate` launcher
are evaluation infrastructure and must be removed or deliberately resolved for
adoption. The launcher writes real sample records only into the preview origin
and refuses to overwrite existing data; it is not a second fake renderer.

Review the route mapping from old format pages to Collection and the new note
dismissal guard. Retire the unused old Format component only after adoption is
settled. Consolidate presentation CSS and update canonical design documentation
only after owner approval. The immutable historical design package should remain
as history. Production audit recommendations are not permission to change it.
