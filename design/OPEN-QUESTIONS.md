# OPEN-QUESTIONS.md

## NON-BLOCKING

**Q-015 · Genre is suggested, never applied — but nothing suggests it yet.** The taxonomy's rule (§4) is that an incoming genre arrives as a chip the user confirms, like series detection. The prototype has no ingest, so no genre is ever suggested; the tag picker's "Suggested by the catalogue" row is the pattern to copy when the add flow gets one. Worth designing the genre equivalent before Claude Code builds ingest, not after.

**Q-016 · Two tag strings live in two groups.** "Body Horror" is both a Subgenre and a Content warning; "Slavery" is both a Theme and a Content warning. The prototype treats content-warning membership as winning, so both are hidden when the toggle is off — which means turning warnings off also removes a legitimate subgenre tag from a work. Correct per the letter of the rule, arguably wrong in spirit. Needs a decision: dedupe the vocabulary, or let the same string exist twice with different group membership.

**Q-012 · Undo, rather than confirm.** The app has a thirty-day trash, which makes most deletions safe — but there is no undo affordance after the fact, so a mis-tap means navigating to the trash to reverse it. A brief inline "Removed · Undo" line after a delete would be more forgiving than any confirmation, and would let the two armed controls stay the only friction in the app. Not built; worth a decision before Claude Code hardens the delete paths.

**Q-013 · Re-reads.** The user has explicitly deferred this. A finished work started again has nowhere to go: the schema holds one `progressCurrent`, so a re-read either keeps a wrong count or loses its finish date. Needs a schema decision before it can be designed. (Reading sessions themselves are now built — D-086, Q-007 closed.)

**Q-014 · "Ask a model" has a switch and nothing behind it.** Settings carries a toggle — *Ask a model when the catalogue misses*, off by default, with copy promising it is used only in the add flow and only when nothing local matches. **No screen implements it.** Three things need deciding before it can be:
1. Where it surfaces. The honest place is the add flow's no-results state, as one more option beside "add it by hand" — never automatic.
2. What it returns and how uncertainty is shown. A guessed title, author and chapter count is data the user will trust; it needs to be visibly provisional and editable before it is saved.
3. Whether the request leaves the device, which contradicts the offline promise made on the welcome screen and in About. If it does, that has to be said at the point of use, not only in Settings.
Until this is decided the toggle should arguably be hidden rather than shown — a switch that changes nothing is worse than an absent feature.


**Q-001 · Real cover images.** You chose to supply 8–10. Drop them anywhere in `uploads/` and I will wire them into the sample data. Until then every cover renders as a dominant-colour block, which is also the genuine `coverSource: 'none'` state, so the work is not held up. Ideally a spread: a couple of dark literary book covers, a couple of manhwa, a couple of web-novel covers with heavy type.

**Q-002 · Interface sans.** IBM Plex Sans proposed over Inter (DECISIONS D-002). Sign off at the Phase 0 gate or name a different one.

**Q-003 · CLOSED 2026-09-01 · Bookplate name field.** Required, not skippable. Built: the button is inert until something is typed and says why; Skip for now is gone. See DECISIONS D-042. Claude Code: `settings.ownerName` is non-empty in practice, but keep it optional in the type — a restored backup from an earlier build may not have one, and About must not crash on it.

**Q-006 · Contrast versus palette.** Brief §3.1 and §9 conflict at small sizes. I resolved it by role rather than by changing your colours — see DECISIONS D-016. The visible effect is that 11px and 13px metadata now sits on `--text-secondary` and is a step lighter than the brief's table implies. If you would rather keep the darker metadata and accept the AA failure, say so and I will revert; it is your app and your eyes.

**Q-007 · Stats figures.** Chapters read (41,208) and years tracked (4) are the two figures Stats leads with, and neither is in SCHEMA. Chapters read is summable from `progressCurrent` across works, but only if progress is never reset when a work is re-read. Years tracked needs a first-tracked date, which does not exist as a field — earliest `createdAt` is the obvious stand-in. Both need Claude Code's confirmation before they are real numbers rather than plausible ones.

**Q-008 · Tag cleanup.** Settings promises "three pairs look like the same tag twice" and then goes nowhere. SCHEMA §7 merges on `normalizedName` collision, so the interesting case is near-misses that do not collide — "Litrpg" and "LitRPG" merge on their own, "Dark fantasy" and "Grimdark" do not. Do you want a real merge screen in Phase 8, or should the row show a count and nothing more?

**Q-009 · What the search bar means versus what the FAB means.** Both currently open the same sheet, which is why the question was asked. Raised with the user 2026-09-01; a form is out. Whatever they choose, one of the two changes behaviour and D-054 gets amended.

**Q-010 — CLOSED** in the Phase 9 pass. `--cool` is deleted (D-070).

**Q-011 — CLOSED** in the Phase 9 pass. The UI says catalogue; the schema keeps corpus (D-071).

## FOR CLAUDE CODE

**Q-004 · `coverTextColor`** is `'light' | 'dark'`. Confirm it is computed against the cover image as a whole, not against `coverDominantColor` alone — spine view uses it over a flat fill, so a value computed from the flat colour is what spine view actually needs. If it is computed from the image, spine view may need its own contrast pass.

**Q-005 · `widthBucket`** (SCHEMA 9.6) — thresholds now proposed in DECISIONS D-027, logarithmic, separate ladders for chapters and pages. Absent count falls to bucket 2 silently (D-028). Confirm the derivation lives in your layer and adopt or adjust the thresholds. The design reads `widthBucket` only; it never computes it.

**Q-006 · Do the width-bucket thresholds match your real library?** D-027 spreads five buckets logarithmically from "under 40 chapters" to "over 1,200". If most of your novels cluster in one bucket the shelf will look uniform and the encoding stops earning its place. You know the distribution; I guessed it.
