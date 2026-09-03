# COMPONENTS.md
Every component: anatomy, states, spacing, motion, tokens consumed, and what it does when data is missing.
Built through Phase 2. Phases 3–7 append.

**Text colour:** every piece of metadata under 18.66px uses `--text-secondary`. `--text-muted` is for large text and non-text UI only; `--text-faint` is never text. See DECISIONS D-016 and the comment at the top of the text block in tokens.css.

The **Missing data** row is mandatory on every entry. Brief §3.7: catalogue data is full of holes, and for web novels the holes are the common case.

---

## Cover
The most reused element in the app and the one the signature transition runs on.

**Anatomy** — a single `div`. No image element until a cover exists; the fill *is* the fallback.
**Sizes** — 132×198 Continue · 116×174 detail header · 44×66 list row · 40×60 recommendation · 36×54 search result · 32×48 Continue peek.
**Radius** — `--radius-button` at 66px tall and below, `--radius-card` above. One radius at every size is a tell.
**Fill** — `work.coverDominantColor`. When `coverSource === 'none'`, `--cover-fallback`.
**Inset** — `box-shadow: var(--cover-inset)`, which is a real 0.5px inset in light and `transparent` in dark. Covers float on a light page and separate on their own on a dark one.
**Title in the fill** — only at 132×198 and above, set in `--font-display` at 15px in `work.coverTextColor`, bottom-left, `--space-3` padding.
**Motion** — carries `data-cover` so the flight can find it. See MOTION.md §1.
**Tokens** — `--cover-inset` `--cover-fallback` `--radius-button` `--radius-card` `--font-display`
**Missing data** — no cover is the normal state, not an error. Never show a broken-image glyph, never show a placeholder icon, never show the word "cover".

---

## WorkRow
The format screen's list item.

**Anatomy** — Cover 44×66 · title · series position · tag chips · progress bar · progress figure.
**Spacing** — `--space-3` gap between cover and text, `--space-3` vertical padding, `--space-4` horizontal.
**States** — default; hover `background: var(--surface-raised)`; pressed inherits; no disabled state.
**Motion** — none of its own. Tapping starts the cover flight.
**Tokens** — `--space-3` `--space-4` `--hairline` `--surface-raised` `--genre-*` `--status-*`
**Missing data**
- no author → the row simply has no author line; nothing says "unknown" in a list
- no series position → the `#n` is absent, not `#?`
- no tags → the chip row collapses to zero height, no placeholder
- no `progressTotal` → the bar is **not rendered at all** and the figure reads "chapter 88". Never invent a denominator.
- very long title → single line, ellipsis. The detail page is where the whole title lives.

---

## ProgressBar
**Anatomy** — 3px track, 999px radius, fill.
**Reading** — continuous fill in `--status-reading`.
**Caught up** — D-009. Track and fill both `repeating-linear-gradient(90deg, C 0 5px, transparent 5px 8px)`, fill at 100%. Reads as the edge of what exists rather than as partway through. Same hue as Reading, deliberately.
**Finished** — continuous, 100%, `--status-finished`.
**Dropped** — continuous, stopped at `dropAtProgress`, `--status-dropped`.
**Wishlist** — no bar.
**Motion** — none. The bar is a fact, not an event; it does not animate in.
**Missing data** — no `progressTotal` → no bar. This is the common case for web novels and it must look deliberate.

---

## StatusPill
**Anatomy** — 8px status dot · label. 36px tall, `--radius-pill`, 0.5px `--hairline-strong` border, no fill.
**States** — default; hover border `--accent`; open (sheet showing) border `--accent`.
**Copy** — Reading · Caught up · Finished · Dropped · Wishlist. Sentence case, always.
**Rule** — `caught_up` is only offered when `publicationStatus` is `ongoing` or `hiatus` (SCHEMA §1). Never derive one from the other.
**Tokens** — `--status-*` `--radius-pill` `--hairline-strong`
**Missing data** — status is never absent; every work has one.

---

## PublicationBadge
Same shell as StatusPill, label in `--cool`, border `--hairline`.
**Copy** — Ongoing · Complete · On hiatus · Abandoned · Publication unknown.
**Why cool** — it is information about the world, not about the reader. The one cool note in a warm palette, and it keeps the two orthogonal facts visually separate.
**Missing data** — `unknown` is a real value and gets a real label, not a hidden badge.

---

## GenreChip
**Anatomy** — label only, 11px, `--radius-chip`, 2–4px padding.
**Colour** — fill 14%, border 34%, label `color-mix(in oklab, var(--genre-N), var(--genre-ink) var(--genre-ink-amt))`.
**Why the label is mixed** — the twelve hues were chosen to sit in one band against a *dark* page. As a label on a light chip they measure 2.5–3.9:1 and every one of them fails AA. `--genre-ink-amt` is 0% in dark, so the hue is untouched there, and 46% in light. `tag.colorIndex` never changes; this is a render adjustment, not a palette change (SCHEMA §7).
**Do not** set the label to `--text-primary` in light — a row of identical dark chips is exactly the wall of grey the spectrum exists to prevent.
**`white-space: nowrap`** — a two-word genre wrapping inside a 4px-radius chip breaks the box.
**Rule** — genre colour appears on chips and nowhere else in the app.
**Missing data** — no tags → no chip row.

---

## AxisLine
The rated profile as a line of type. No chart, no bars, no dots, no numbers.

**Explanation line** — "Matched on Monstrous, Merciless and Dense". Variable length, up to three labels, joined with commas and "and". Never shows the score.
**Anatomy** — words in `--font-display` at `--display-vf-sm`, 22px, separated by a 0.5px × 18px vertical rule in `--hairline-strong`.
**Order** — protagonist, power system, world, pacing, prose, then ending.
**Separator** — D-010. A hairline rule, not a middle dot (§3.6).
**Wrapping** — wraps freely; the rules wrap with the words.
**Note line** — 13px `--text-muted` beneath, one sentence: unrated, ending-locked, or unfinished.
**Missing data** — partial ratings are normal. Absent axes are skipped silently; nothing is imputed and no gap is left. Unrated shows the note alone.
**`endingNone`** — renders the word **Unfinished** at the end of the line and sets the note to explain that the author stopped. It is not a low score and is never averaged.

---

## DetailHeader
The landing site of the cover flight.

**Anatomy** — back control · Cover 116×174 carrying `view-transition-name: work-cover` · title `--display-vf` 30px · author · series line in `--cool` · universe line.
**Tint** — `color-mix(in oklab, <coverDominantColor> var(--cover-tint-amt), var(--surface-base))`.
**Why the amount is a token** — 22% in dark, **10% in light**. Tinting toward a cover darkens a light page, and mid-grey metadata on a darkened page drops under AA: at 22% light, `--text-secondary` measured 3.58:1 and `--cool` 3.81:1. 10% holds even against a pure black cover. Never hardcode the percentage; the whole point is that it differs by theme.
**Alignment** — cover and text are bottom-aligned, so the title sits on the cover's baseline rather than floating beside its middle.
**Tokens** — `--cover-tint-amt` `--cover-inset` `--radius-card` `--display-vf` `--cool` `--text-secondary`
**Missing data**
- no cover → `--cover-fallback` fills the block and the tint falls back to `--surface-base` with no mix at all. A tinted header with no cover to justify it looks like a bug.
- no author → the line is absent. On detail, unlike in a list, a manual entry may legitimately show a title and nothing else.
- no series → no series line and no position; never "Standalone".
- no universe → absent. Universes are rare and their absence is the norm.

---

## FAB
**Anatomy** — 56px, `--radius-sheet` (16px, not a circle — the corner radius is what lets it morph into the sheet), `--accent` fill, plus glyph in `--on-accent`.
**Position** — bottom right, `--space-4` from the right, 72px from the bottom so it clears the 56px nav. Never centred: it must not contest a thumb position with a tab.
**States** — default; pressed `scale(0.92)` over `--dur-fast`; hidden while the add sheet is open.
**Motion** — MOTION.md §2. It expands into the sheet; it never navigates.
**Shadow** — `--shadow-fab`. One of only two elements in the app permitted a shadow.
**Haptic** — one 10ms tick on open.

---

## AddSheet
**Anatomy** — grab handle · search field · "In your library" · "Add to library" · suggestion card.
**Surface** — `--surface-overlay`, `--radius-sheet` top corners only, `--shadow-sheet`, scrim `rgba(0,0,0,0.5)`.
**Sections** — `inLibrary` renders as rows that navigate; `fromCorpus` renders as rows with an Add button. Both from `SearchResults` (SCHEMA §9.1).
**Suggestion card** — `--cool` border on `--cool-deep` fill, because a suggestion is information, not an action taken. Two buttons: "Group them" and "Not a series". Never auto-applied.
**Confidence** — SCHEMA §9.2 requires `low` to be visually distinguished. Low-confidence suggestions drop the cool border to `--hairline` and prefix the line with "This might be". Not yet built; Phase 4.
**Meta lines** — parts separated by hairline rules, never middle dots (D-007).
**Missing data** — `authors` empty → "Author unknown" as a real part, because in a list of candidates the absence is information. No `chapterCount`, no `year` → those parts are simply absent.

---

## BottomNav
**Anatomy** — four equal targets, icon 18px over an 11px label. 56px tall plus `--safe-bottom`.
**Active** — `--accent` on both icon and label. Inactive `--text-muted`. No pill, no underline, no background.
**Tokens** — `--nav-height` `--hairline` `--surface-base` `--accent` `--text-muted`
**Note** — `backdrop-filter` is permitted here and nowhere else (§3.7), but is not currently used. It costs frames on mid-range Android and buys very little over an opaque surface.

---

## Bookplate
**Anatomy** — engraved frame (hand-drawn SVG) · "Ex Libris" in the upper band · illustration in the middle band · "From the books of" and the name field in the lower band · two buttons below the frame.
**Frame** — three nested rules, a corner diamond on each side, four tick marks where the band rules meet the frame. `--text-faint` for the outer rule, `--accent` for the inner work.
**Name field** — borderless, centred, `--font-display` at 22px, underlined with 0.5px `--hairline-strong` that goes `--accent` on focus. Placeholder "your name", lowercase, because it is an instruction not a label.
**Copy** — "Open the library" and "Skip for now". The name is optional; skipping is not failure.
**Reuse** — becomes the About screen unchanged, with the field replaced by the stored name as static text.

---

## AxisScale
The rating gesture. Brief §6 singles it out as the thing that must feel good under a thumb.

**Anatomy** — axis name · Clear · the word at `--display-vf` 40px · track with five stops and a thumb · end labels · note line · (Ending only) the Unfinished control · Back / Next.
**Interaction** — `pointerdown` on the track jumps to the nearest stop; drag continues to update. `touch-action: none` on the track or the browser steals the gesture for scrolling.
**Stops** — 10px dots, filled `--accent` up to and including the current value, `--hairline-strong` beyond.
**Thumb** — 26px. Filled `--accent` with `--shadow-fab` when set; transparent with a `--hairline-strong` outline and no shadow when unset. `transition: left var(--dur-fast) var(--ease-snap)`.
**Haptic** — one 10ms tick per stop crossed, in both directions. The only place in the app where ticks accumulate.
**Note line** — generated from the axis's own end labels: "Neither end is better. Plain is not worse than Dense." Ending instead reads "The only axis that judges."
**Never** — no number, no "3/5", no dots-as-rating, no stars. Display the word only.
**Missing data** — unrated is the resting state, not an error. Clear returns to it.
**Translation** — only rendered when `work.isTranslated`. It is not in the six-axis walkthrough order; it appears as a seventh step only for translated works.

---

## UnfinishedControl
**Anatomy** — dot · "Unfinished" · "the author stopped".
**Behaviour** — a toggle beside the scale, never a sixth stop. Setting it clears `ending`; they are mutually exclusive (SCHEMA §2).
**Copy** — the sub-label carries the fact. Reverend Insanity does not have a botched ending; it has no ending.
**Never** — averaged into anything, or treated as a low score.

---

## FinishMoment
**Anatomy** — illustration at 14% behind · 88px tick ring · "Finished" at `--display-vf` · title · count and date, tabular · "Set the axes" · "Later".
**Colour** — the tick and its ring are `--status-finished`. Nothing else on the screen is green.
**Haptic** — one tick, on the state change, not on the tap.
**Copy** — no congratulation, no exclamation mark, no streak. The user finished a book; they know.
**Dismissal** — "Later" is a real exit and the offer returns from the detail page. Never a nag, never twice.

---

## CompletionRing
**Anatomy** — 52px, 22px radius, 2px stroke. Track `--hairline`, progress `--status-finished`, rotated −90° so it starts at twelve o'clock. Label centred, tabular.
**Counts** — `completionRing.finished / total`. Not owned. Owning four and reading none is not a completed series.
**Missing data** — no `totalEntriesKnown` → **no ring**, and no substitute. Never a fake denominator.

---

## GhostEntry
A series entry the corpus knows about and the library does not.
**Anatomy** — position · 44×66 dashed 0.5px `--hairline-strong` outline where the cover would be · title in `--text-secondary` · Add.
**Why dashed** — it reads as a gap in a set rather than as a dimmed row. A greyed-out real cover would imply ownership.
**Missing data** — no position → the column is blank, the row still renders. Corpus order is not always numbered.

---

## EmptyState
**Anatomy** — illustration · headline at `--display-vf-sm` 30px · one line of body, max 30ch · one verb CTA.
**Sizes** — the illustration is sized per state, 58%–100% of the column. The empty library is the only one allowed to fill a screen.
**Copy shape** — headline names the space; body explains the rule of the space; CTA is a verb. Never "Nothing here yet", never an apology.
**No CTA** — Trash. An empty bin needs no action.
**Tokens** — `--display-vf-sm` `--text-secondary` `--accent` `--on-accent` `--radius-button`

---

## SpineView
Brief §7. The alternative to the cover list, on the same format screens.

**Anatomy** — header with a list/spine toggle · one block per section · per section, a heading with a count and one or more shelf rows · a width key at the foot.
**Shelf row** — `display: flex; align-items: flex-end`, 3px gap, min-height 196px, a continuous 0.5px `--hairline-strong` bottom rule, 20px below it. Rows are packed in JS to a 358px budget (D-029); `flex-wrap` is wrong here because wrapped rows share one rule and lose their baseline.
**Toggle** — the same two-icon control as the list view, mirrored. Both directions work.
**Motion** — hover `translateY(-6px)` over `--dur-fast` with `--ease-snap`. Tapping starts the normal cover flight; the spine carries `data-work` and its `[data-cover]` equivalent is the spine itself.
**Tokens** — `--cover-inset` `--hairline-strong` `--status-reading` `--display-vf-xs` `--display-vf-sm` `--dur-fast` `--ease-snap`
**Virtualisation** — §3.7 requires 2,000 items to scroll smoothly. Shelf rows are fixed-height and independent, so they virtualise by row. The height hash must stay deterministic (D-030) or spines will jump as rows recycle.

---

## Spine
**Width** — `widthBucket` → 12 / 18 / 26 / 36 / 48px. See D-027 for thresholds and D-028 for the missing-count case.
**Height** — 148–190px, deterministic hash of the work id. Carries no meaning.
**Fill** — `coverDominantColor`, or `--cover-fallback`. Radius 2px on the top corners only.
**Title** — bucket 2 and up. `writing-mode: vertical-rl`, `--font-display` at `--display-vf-xs`, 11px (buckets 2–3) or 13px (4–5), `text-overflow: ellipsis`, max-height 86%, in `coverTextColor`.
**Status** — a 3px `--status-reading` bar across the foot, for `reading` only. Nothing else.
**Missing data**
- no count → bucket 2, silently
- no cover colour → `--cover-fallback`; the spine still stands on the shelf
- no title → colour only, no placeholder text
- bucket 1 → no title at any length; 12px cannot hold type

---

## WidthKey
**Anatomy** — five outlined blanks at the five bucket widths, each labelled with its threshold, plus one explanatory line.
**Style** — `--surface-overlay` fill, 0.5px `--hairline-strong` border, no bottom border, so they read as spines rather than as swatches.
**Why it exists** — width encodes length. Five widths and no legend is a puzzle, and the answer is not guessable from a shelf.


---

## LedgerRow — Stats and Settings
**Anatomy** — label left, value right, `border-top: 0.5px var(--hairline)`; the last row in a group also takes a bottom border so the group closes. 13px vertical padding, 44px effective height. Values are `font-variant-numeric: tabular-nums` without exception.
**Variants** — value as a figure · value as a name (right-aligned, primary) · value plus chevron (navigates) · value replaced by a segmented pill or a switch (Settings).
**Group heading** — display-S, `--display-vf-sm`, 22px, 8px above the first row.
**Never** — an eyebrow label above the heading, a card around the group, a shadow, an icon per row.
**Missing data** — a figure that does not exist yet renders as `—` in `--text-secondary`, never as 0. A row whose value cannot be computed is omitted, not shown empty.
**Tokens** — `--hairline` `--display-vf-sm` `--text-primary` `--text-secondary`

## GenreBar
**Anatomy** — a 12px bar, `border-radius: 2px`, `overflow: hidden`, segments as flex children with `gap: 0.5px`. Widths are percentages of the summed counts. Beneath: top three names with counts, hairline-separated, then the remainder as one `--text-secondary` line.
**Colour** — `--genre-0` through `--genre-11` by `tag.colorIndex`, untouched. This is the one place the spectrum appears outside chips (D-037 amends the chips-only rule for the bar specifically).
**Scope** — a two-option pill, everything / finished only.
**Missing data** — fewer than four genres: no "and n others" line. One genre: the bar is a solid block and the line under it carries the count; that is honest, not broken. No tags at all: the whole group is omitted.
**Tokens** — `--genre-*` `--hairline-strong` `--surface-raised` `--text-secondary`

## NoteCard
**Anatomy** — optional pinned marker (4px accent dot plus an 11px label), optional title in display-S, body at 15/22 clamped to four lines with `-webkit-line-clamp`, attached-work pills, date at 11px in `--text-secondary`. Hairline above each card; no card fill, no border, no radius.
**Order** — pinned first, then by `updatedAt` descending.
**Attached-work pill** — 14×20 cover sliver plus the title at 13px, in a hairline pill. One per `noteLink`.
**Missing data** — no title: the body starts the card, and the clamp still holds. No body: title only. No links: no pill row. A note attached to a work that has since been deleted keeps its pill but the sliver falls to `--cover-fallback` (SCHEMA §6: deleting a work unlinks rather than deletes).
**Tokens** — `--hairline` `--accent` `--display-vf-sm` `--text-secondary`

## NoteEditor
**Anatomy** — sheet at `--surface-overlay`, 94% max height, drag handle, Cancel / Save row, title input in display-S, body textarea at 15/22, then three hairline rows: attach to a work (expands inline), tags, keep it at the top.
**Blank body** — `studying-bro` sits behind the textarea at 0.16 opacity, `pointer-events: none`, and is gone from the first keystroke.
**Attach row** — collapsed it shows the count ("none yet" / "2 attached") and a chevron; expanded it reveals the standard search field and three result rows with Attach / Attached pills. Never a second sheet (D-038).
**Save** — accent text, not an accent fill. The sheet already carries the accent on the attach pills; a filled button would make three accents on one surface.
**Missing data** — nothing is required; an empty note simply does not save.
**Tokens** — `--surface-overlay` `--shadow-sheet` `--radius-sheet` `--accent-text` `--hairline`

## Switch
**Anatomy** — 44×26 pill, 20px knob, 2px inset padding, `justify-content` flipping between `flex-start` and `flex-end`.
**On** — `--accent` track and border, `--on-accent` knob. **Off** — `--surface-sunken` track, `--hairline-strong` border, `--text-muted` knob (non-text UI, so muted is legal).
**Motion** — background over `--dur-fast` with `--ease-snap`. The knob moves by layout, not by transform.
**Used by** — series sections start open · help from a model · keep a note at the top.

## SegmentedPill
**Anatomy** — two or three options in a hairline-bordered pill, `overflow: hidden`. Selected: `--surface-raised` fill, `--text-primary`. Unselected: transparent, `--text-secondary`. 13px in Settings, 11px where it sits inside a heading row.
**Why not accent** — three accents per screen is the budget, and none of them should be spent on a control that is merely selected rather than primary.
**Used by** — theme · default view per shelf · genre scope.

## DrawerPanel
**Anatomy** — 276px, `--surface-overlay`, 0.5px right hairline, scrim at `rgba(0,0,0,0.5)`. Head: the wordmark at display-M with a bottom hairline. Four 56px rows, 16px icon plus a 15px label.
**No** — owner name, avatar, counts, version, or a footer. Those live on About (D-041).
**Motion** — `translateX(-100%)` → rest, `--dur-base` `--ease-spring`.

## ProgressLine — restore and corpus
**Anatomy** — a 4px `--hairline` track with an `--accent` fill, then a hairline-separated fact line (bytes of bytes · time remaining) and, where relevant, ledger rows counting what has landed.
**Honesty rules** — real numbers only; no indeterminate shimmer standing in for progress; the time estimate says "about" and is allowed to be wrong. Every long operation states what happens if it is cancelled.
**Missing data** — unknown total: show what has arrived and no percentage, and the track stays empty rather than faking a fill.


---

## NavBar
**Anatomy** — four tabs, floating: inset 12px from both sides, lifted 10px, 56px tall, `--radius-pill`, 0.5px hairline all round. Fill `--glass-fill` (page colour at 78%) with `backdrop-filter: blur(20px) saturate(1.4)`.
**Tab** — 18px icon over an 11px label, both `--text-secondary`, both `--accent-text` when active. Whole tab is the hit target, 44px+ in both axes.
**Active for** — Library: home, format, detail, series, universe, spine, add, axis. Wishlist and Stats: themselves. Settings: settings, backup, trash, about. Notes has no tab: it is a drawer destination.
**Why glass** — the bar sits over a scrolling library, and an opaque block reads as a floor the content is trapped under. Do not drop the fill below 70%: an 11px label over a passing cover fails AA.
**Liquid glass, three layers** (revised D-068) — `--glass-fill` (overlay plane, 78% dark / raised plane, 84% light), `--glass-blur` (36px + saturation), then a `--glass-sheen` gradient child and a `--glass-ring` inset top highlight, over `--shadow-nav`. The ring is not decoration: it is the only thing that keeps the bar's edge legible over a dense list. Never ship the fill and blur without it.
**Fallback** — no `backdrop-filter` support: the fill alone is a legible translucent bar. Never a hard-coded opaque colour.
**Tokens** — `--glass-fill` `--glass-blur` `--nav-inset` `--nav-lift` `--radius-pill` `--hairline` `--accent-text`

## Splash
**Anatomy** — full frame at `--surface-base`, wordmark at display-L, and a 104px × 1px `--hairline-strong` track with an `--accent` fill that advances one thirteenth per illustration loaded.
**Timing** — real progress, minimum 520ms, 240ms fade out. No spinner, no logo animation, no tagline.
**Missing data** — a failed illustration fetch still advances the bar (`onerror` counts): boot must never hang on an asset.
**Tokens** — `--surface-base` `--display-vf` `--accent` `--hairline-strong` `--dur-slow` `--ease-out`


---

## Skeleton
**Anatomy** — the destination screen's own layout with content withheld: identical gutters, identical cover ratio, identical rhythm, so nothing shifts when data lands. Blocks are `--hairline` at full opacity, radius matching the real element.
**Never** — shimmer, pulse, spinner, or a progress bar. A skeleton states that the shape is known and the content is not; anything moving on it is a lie about progress.
**Tokens** — `--hairline` `--surface-sunken` `--radius-card` `--radius-chip`

## Error state
**Anatomy** — 44px hairline circle with a single glyph; display-M headline, max 18ch; a Taviraj body paragraph, max 34ch; a **Still true** block on `--surface-raised` naming what was NOT lost; one accent action and one "Not now"; a closing caption for what happens automatically.
**Copy rule** — name the failure in the headline, never apologise, never show a code. What is still true matters more than what broke.
**Tone** — `--danger` for a failure the user should act on, `--text-muted` for a condition they cannot fix (offline).
**Tokens** — `--danger` `--text-muted` `--surface-raised` `--font-body` `--accent` `--on-accent`

## Virtualised list
**Anatomy** — fixed 76px rows inside a spacer of `count × 76px`; each row absolutely positioned and moved by `transform: translateY()`, never `top`. Window is the viewport plus four rows either side, recomputed on scroll past a 20px threshold.
**Why fixed height** — a variable row height means measuring every row to know the scroll extent, and the scrollbar lies until you have. Fixed height keeps it honest at 2,000 items.
**Tokens** — `--hairline` `--cover-inset` `--font-mono` (the mounted-row count, dev only)


---

## Tour spotlight
**Anatomy** — a positioned div over the target with `box-shadow: 0 0 0 2px var(--accent), 0 0 0 9999px rgba(3,6,12,0.76)`: the accent ring and the whole scrim come from one element, so the hole can never drift from the dimming. Card below the target when it sits in the top 45% of the frame, above it otherwise.
**Measurement** — `[data-tour="<key>"]` on the real control; the rect is read live each step and padded per step (6px on pills, 8px default). Never hardcode coordinates.
**Content** — display-S head, Taviraj body, step dots, Skip, and Next (last step reads "Start reading").
**Tokens** — `--accent` `--surface-overlay` `--hairline-strong` `--shadow-fab` `--font-body` `--duration-fluid` `--ease-fluid-out`

## Welcome
**Anatomy** — constellation at `--art-line`/`--art-dot`, then eyebrow, 52px wordmark, one 19px Taviraj line, a self-drawing rule, the offline line, and one accent button. No skip, no dots, no illustration.
**Runs** — once, on first open. Replayable from About and nowhere else.
**Tokens** — `--art-line` `--art-dot` `--display-vf` `--font-body` `--hairline-strong` `--accent`


---

## Genre filter
**Anatomy** — a header pill (label, count-aware: "All genres" / one name / "3 genres, any") opening a sheet: twelve chips with a colour sliver, name and live count; an Any/All segmented control; a one-line explanation that changes with the mode; Clear and a primary button naming the result ("Show 333 works").
**State** — active chips take `--accent` border on `--accent-deep`; the header pill does the same when any filter is on, so the screen never looks unfiltered when it isn't.
**Missing data** — an All combination nothing carries gets its own empty state naming the Any toggle. Never a blank list.
**Rule** — filter before windowing; the spacer and scroll extent describe the filtered list.
**Tokens** — `--accent` `--accent-deep` `--accent-text` `--genre-N` `--surface-overlay` `--hairline` `--radius-pill`


---

## Destructive controls
**Three grades, and the grade decides the shape.**
1. *Not a deletion* (remove from wishlist): a trailing × at `--text-muted`, `--danger` on hover. Single tap, no confirmation.
2. *Reversible* (remove a work, delete a note): full-width `--danger` outline button, or a header trash glyph; the consequence is stated in 13px beneath. Single tap — the thirty-day trash is the confirmation.
3. *Permanent* (delete now, empty the trash): arms on first press. Label changes to state what the second press does, background takes `--danger-soft`. Never a dialog.
**Never** — a red fill, more than one danger control per screen, or a modal in front of a reversible action.
**Tokens** — `--danger` `--danger-soft` `--text-muted` `--radius-button` `--radius-pill`

## Theme switch (home)
**Anatomy** — two 44×44 glyph buttons right of the search pill, 6px apart, sun then moon. The active one sits on a `--surface-raised` pill at `--text-primary`; the other is `--text-faint` on nothing.
**Why not accent ink** — `--accent-text` against `--text-muted` is 1.14:1 in the dark theme. A selected state here has to read in a theme with no hue, so it is carried by lightness and a surface.
**Duplication is intentional** — Settings keeps a Dark/Light segmented control. One is the shortcut, the other is the inventory.
**Tokens** — `--accent-text` `--text-muted`


---

## Reading session sheet
**Anatomy** — bottom sheet: "Where did you get to?", a sub-line stating the current position, a 44px tabular figure between two 52px round steppers, `+1 / +5 / +10` jump chips, a delta line ("10 chapters this session") with the new percentage, and a primary button.
**Rules** — asks for the position reached, never the amount read. Floors at the current position. The button is inert and `--text-faint` at zero delta, `--accent` once there is something to log, and reads "Finish it" when the value meets the total.
**Feeds** — Stats' "chapters read". A figure with no action behind it is decoration.
**Tokens** — `--accent` `--on-accent` `--surface-raised` `--hairline-strong` `--radius-sheet` `--display-vf`


---

## Genre chip
**Anatomy** — 13px label, 7×11px colour sliver, filled with the genre hue, visible border, `--radius-chip`.
**Primary vs second** — primary: fill ×170%, border ×130%, weight 500. Second: ×100 / ×60, weight 400. A work carries at most two.
**Never** — more than two per work, or a genre rendered at tag weight.
**Tokens** — `--genre-N` `--genre-fill-alpha` `--genre-border-alpha` `--genre-ink` `--genre-ink-amt`

## Tag pill
**Anatomy** — 11px, transparent, `--hairline-strong` border, `--radius-pill`, `--text-secondary`. Deliberately lighter than a genre chip in every dimension.
**Content warning variant** — `--danger` wash 16%, border 55%, `--danger-text` ink. Only rendered when `cwOn`; `tagPills()` is the single gate.
**Selected (in the picker)** — `--accent-deep` on `--accent`; warnings deepen their own wash instead.

## Tag picker
**Shape** — full screen. Header: back, title, dashed "New tag". Pinned search below it. Footer: count and Done.
**Before typing** — Suggested (own row, Accept all, × each, "Nothing is saved until you go back") → Recently used → Used most → 7 groups collapsed with counts.
**While typing** — every group with a hit auto-opens, groups with none disappear, counts read "1 of 35". Zero hits gets a named empty state pointing at New tag.
**Rules** — search across all groups at once; the warning group is absent entirely when the toggle is off; creating a tag never appears in the results list.
**Tested against** — "Heavens/Immortal Realm", "Depictions of Cruelty" (longest) and "System", "War", "Gore", "Noir" (shortest).


## Genre editor (sheet)
**Shape** — bottom sheet, twelve chips, Done. Not the genre filter: selection is **ordered**.
**Rules** — first tap = primary; max two; a third tap is refused (0.35 opacity, no cursor) rather than evicting. "Make *X* primary" only with two selected.
**Reached from** — detail's genre row, which is always visible: "Edit" when set, "Add a genre" when empty.
**Persists as** — `genreOv[workId]`, read in `deco()`.
