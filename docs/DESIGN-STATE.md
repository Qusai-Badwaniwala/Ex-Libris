# Current design state

Updated 2026-09-08. This mutable document records approved production evolution.
The visual source of truth in `../design/` is immutable and must not be edited.

## Foundation

- Claude Design owns the product identity: onboarding, constellation, dark
  blue-grey palette, drawer, FAB bloom, sheets, Wishlist/Surprise Me, Trash,
  personal reading moments, illustrations, and restrained motion.
- Registered Folio/Concept B supplies the approved editorial hierarchy, Sansita
  display type, Montserrat Alternates interface type, Taviraj reading copy,
  controlled colour, ruled information layouts, catalogue presentation, and
  four-zone dock.
- Night Route/Concept A contributes only useful progress, shelf, and relationship
  motifs. It is not a second visual identity.
- Light is warm cream; dark retains Claude's blue-grey character. Colour is
  intentional. No gradients, ornamental dashboard treatment, ambient motion, or
  generic loading chrome.

## Approved production differences from the immutable prototype

- Spotlight onboarding runs over the real Home screen after Welcome/Bookplate.
- Home Continue is a neutral cover-led whole-record target; the constellation
  spans the full page.
- Books, Novels, and Manhwa keep a three-spine identity even when empty.
- Navigation is the approved four-zone editorial dock. The drawer is slower and
  has no separator rules. The FAB uses Claude's two-icon bloom; Notes uses the
  pencil.
- Everything and Detail use the approved editorial record hierarchy while
  retaining Claude's screens and interaction model.
- All 13 illustration placements remain unchanged. Immutable sources are
  preserved; theme-aware derivatives use warm-paper light and blue-grey-night
  colour systems while retaining every drawing's detail. `magic-tree-cuate`
  remains unchanged.
- A named registering-book status mark appears only when real async work remains
  pending for 180 ms. Immediate press/transition feedback handles instant work.
  The shared treatment is approved and the current interaction audit includes
  Detail remove/restore plus every perceptible Phase 5 lookup and write.

## Phase 5 visual state

Series/universe pages, dashed ghosts, the 52 px completion ring, relationship
offers, manual relationship editing, the named-order sheet, and the universe
starting point follow the existing Claude component specification and Registered
Folio hierarchy. Their implementation checkpoint passed visual review on Pixel 7
in warm light and blue-grey dark. The observed states covered:

1. post-add high/medium/low-confidence offers and rejection;
2. missing-earlier-entry warning and explicit Wishlist bulk action;
3. series with and without a known total, owned rows, Wishlist rows, and ghosts;
4. universe description, starting point, and several named orders;
5. long titles, empty relationships, keyboard focus, storage errors, reduced
   motion, and a measured 44 px minimum for enabled editor buttons.

The one demonstrated defect—an enabled Clear action when no stored starting point
existed—was corrected. Captured production-mode states live at
`.impeccable/review/phase5-*.png`; no overflow, illegible hierarchy, accidental
dim treatment, or palette drift remained. Visual inspection records implementation
evidence, not owner acceptance.

Do not invent an Add-whole-universe surface: the current production catalogue
contains no verified universe membership. The owner accepted Phase 5 and
authorized Phase 6 on 2026-09-08. Its frozen visual contract is `AxisLine`,
`AxisScale`, `UnfinishedControl`, `FinishMoment`, and explained More Like This in
`design/COMPONENTS.md`. Q-017 is settled: Translation always appears as the
seventh editing step, without entering the six-axis recommendation score.

Phase 6 implementation review on 2026-09-08 inspected explicit Pixel 7 dark
FinishMoment and AxisScale states plus the light Detail AxisLine and More Like
This state. The themed cherry tree remains at 14%; the sheet retains the dimmed
Detail context; the type-only profile uses trailing hairlines that never lead a
wrapped line; and recommendation rows expose matching words, not a score. The
axis scale supports pointer, drag, keyboard, focus, accumulated stop haptics,
and reduced motion. Captures are under `.impeccable/review/phase6-*.png`.

One visible improvement is proposed but not approved: when a rated work cannot
meet the three-shared-axis threshold with any other owned work, More Like This
could explain why it is absent and link to rating another work. See Q-029.

## Phase 7 Notes review — 2026-09-08

Phase 7 faithfully implements the frozen Notes states: the feed uses the
approved type-led `NoteCard`, pinned notes remain fully rendered and carry a
textual pin marker, attached works appear as compact cover-and-title pills, and
the editor keeps title, body, work attachment, nested tag selection, pinning,
save, and delete in one focused surface. The same card hierarchy appears under
Detail without repeating the current work as an attachment pill. Trash exposes
note restore and permanent deletion with actions below long note content at
Pixel 7 width.

The owner's earlier illustration direction was reconfirmed during this phase:
illustrations must be deliberately recoloured for each theme while preserving
their internal detail, not uniformly tinted. Phase 4's thirteen deterministic
warm-light and blue-grey-dark derivatives remain the implementation. Notes uses
the matching `no-notes` empty art and `studying-bro` blank-editor art; opening the
editor suppresses the underlying empty illustration so two scenes never compete
on one screen. No immutable design source was changed.

Pixel 7 captures were inspected in both themes for the light empty feed, dark
blank editor, dark populated feed, light tag picker, light Detail notes section,
and dark note Trash state. Captures are under
`.impeccable/review/phase7-*.png`. The review caught and corrected an outgoing
View Transition snapshot in capture timing and a cramped Trash action row; the
final states preserve the approved palette, hierarchy, readable wrapping, and
bottom clearance.

## Phase 8 data-safety review — 2026-09-12

Phase 8 adds only the missing approved Backup and import states; it does not
reinterpret the frozen identity. The Backup page uses the established large
display heading, quiet explanatory copy, hairline-separated actions, full-width
accent action, and four-zone dock. Empty Backup uses the dedicated
`bibliophile-pana` scene and never competes with another illustration.

The owner's illustration direction remains exact: the empty state uses the
detailed warm-paper derivative in light mode and its blue-grey-night partner in
dark mode, not a filter or uniform recolour. The immutable source SVG and all
thirteen placements remain untouched.

Pixel 7 captures were explicitly inspected for the light empty Backup, dark
populated history, light restore preview, dark paste confirmation, and mapped
CSV screen under `.impeccable/review/phase8-*.png`. The first restore capture
exposed that a file-picker action could preserve the scrolled Home offset and
clip the next heading; every Backup subflow now starts at the top. Counts use
hairline-separated metadata rather than punctuation dots, long ZIP names wrap,
CSV source values remain horizontally inspectable, and all actions clear the
fixed dock. No palette drift, illustration mismatch, clipped final heading, or
unreadable long content remained in the reviewed states.

## Phase 9 Stats and spine review — 2026-09-13

Stats now follows D-036's editorial ruled ledger rather than a dashboard. The
opening `knowledge-rafiki` plate and the `cherry-tree-amico` year divider retain
their distinct detailed warm-light and blue-grey-dark derivatives. Current-year
figures, library status rows, the one approved segmented genre bar, series,
authors, finishing outcomes, and prior years all come from live data; zero-data
Stats remains a real, honest ledger rather than an ornamental empty screen.

The spine view retains D-027 through D-034's five widths, flat cover colours,
vertical titles, deterministic non-semantic heights, reading foot bars, shelf
rules, and Width Key. The owner approved Q-019's visible evolution: a unit with
at least forty known lengths displays its library-derived quintile boundaries;
smaller shelves display the fixed logarithmic ladder. The key names which mode
is active. Fixed-height shelf rows are windowed with bounded overscan, and only
the tapped cover receives the shared Detail transition name.

Pixel 7 captures under `.impeccable/review/phase9-*.png` were explicitly
inspected for Stats top/history and the 500-work shelf in light and dark. Long
labels remained readable, both illustration pairs retained theme-specific
detail, and no palette or hierarchy drift was observed. A 500-work automated
fling measured 58.7 frames per second on the 60 Hz emulated viewport with at
most 13 rows mounted. This is desktop Pixel emulation, not Q-028's deferred
physical-phone evidence.

## Phase 10 final-polish review — 2026-09-13

Settings remains the frozen ruled dossier: no cards, row icons, dashboard
chrome, or palette reinterpretation were introduced. Semantic headings replace
presentation-only title elements, while segmented controls, switches, and the
bookplate save action now have full 44px targets. The segmented control supports
the standard arrow/Home/End keyboard pattern without changing its appearance.

The new Q-008 maintenance route extends that same ruled language. It states the
rename/merge/delete consequence in prose, keeps counts tabular, exposes Edit
and eligible Remove actions without ornamental containers, and uses a second
press for permanent removal or merge confirmation. Empty, failed-write,
Trash-only, long-name, and reduced-motion states were exercised. The Settings
dock remains selected on the child route.

About retains the permanent bookplate, existing `magic-tree-cuate` placement,
typography, quiet metadata rows, and privacy statement. Long owner names and
values wrap within the Pixel 7 width, and the final paragraph scrolls fully
above the fixed dock. The illustration's established light/dark presentation
was preserved; no source SVG or derivative was modified.

Explicitly inspected `.impeccable/review/phase10-*.png` for Settings top and
bottom, tag maintenance before and after edits, and About top and bottom in both
warm light and blue-grey dark. Also inspected the native 192px launcher icon
and 512px maskable icon. No clipping, dock collision, palette drift, illegible
metadata, theme mismatch, or lost illustration detail remained. Final launcher
approval remains the owner's non-blocking Q-018 call.

## Phone-release installation review — 2026-09-13

The owner supplied and selected the final launcher artwork, resolving Q-018.
The release masters preserve its cream paper, expressive ink ring, seated
reader, falling leaves, and red seal at native square size. The maskable master
uses the same mark with sufficient quiet paper around it, so Android may crop
the icon without losing the reader, ring, leaves, or seal.

The new installation surface extends Settings' existing ruled dossier rather
than adding a promotional card. One plain row states the device-local benefit,
then shows either the existing accent-outline action or a green tick plus the
word `Installed`. Manual browser steps occupy a temporary ruled paragraph below
the row. The sixth and final first-run spotlight navigates to this real Settings
control, so onboarding teaches the same place the reader can return to later.

Pixel 7 captures under `.impeccable/review/release-install-*.png` were
explicitly inspected in warm light and blue-grey dark. The tour spotlight,
card, native-prompt state, manual fallback, green installed state, wrapping,
and fixed-dock clearance retain the approved hierarchy. No immutable SVG,
frozen token, or unrelated illustration was changed.
