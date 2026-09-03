# DECISIONS.md
Append-only. Dated. Every decision with its reasoning and what was rejected.

---
## 2026-08-31 · Phase 0

**D-001 · Tokens ship as a real `tokens.css` file; prototypes consume it via `var()`.**
This environment discourages class-based stylesheets, but nothing prevents a custom-property sheet. Every prototype links `tokens.css` and writes styles as `var(--token)`. Claude Code gets the contract brief §2 asks for.
*Rejected:* literal values in prototypes with a token sheet written afterwards — guarantees drift.

**D-002 · Interface face: IBM Plex Sans, proposed not final.**
Brief §3.2 allowed Inter or an alternative with proper tabular figures. The frontend-design skill names Inter as a generic default to avoid. Plex is variable, free to self-host, humanist rather than neutral-grotesque, and has true tabular figures via `font-variant-numeric: tabular-nums`. Its slight technical coldness is useful against a warm serif.
*Rejected:* Inter (generic, and the cliché the brief is trying to avoid travels with it). Public Sans and Source Sans 3 (both fine, both quieter — less of a counterweight to a characterful serif).

**D-003 · Continue strip: one large in-progress book, with up to two more as a peek row beneath.**
User skipped the question. Brief §12 argued for one because they mostly read one at a time; SCHEMA `status: 'reading'` permits several. One large cover answers the 80% case at full size; the peek row costs 88px and prevents a second in-progress book from being invisible.
*Rejected:* three equal medium covers — makes the common case look like a list of three when it is a list of one.

**D-004 · Series sections: open when there are fewer than 8, collapsed above that.**
User skipped. SCHEMA has `settings.seriesSectionsDefaultOpen`, a boolean, so the app-wide preference is respected; the threshold is only the initial value written at first run. Below 8 sections, collapsing hides the whole library behind taps. Above 8, an open screen is a wall.
*Rejected:* always open (unusable at scale), always collapsed (hostile on a small library, which is the first-run case).

**D-005 · Prototype structure: one navigable prototype plus per-screen files.**
User skipped. Brief §2 says split-by-screen ports more cleanly; the brief also demands the cover transition be tested with a real thumb, which needs screens that actually navigate to each other. Doing both costs one extra shell file.

**D-006 · Accent stays golden-amber and is used roughly three times per screen.**
Direct response to brief §3.6. The cliché is cream + serif + terracotta with the accent as the visual interest. Here covers carry all the colour and the accent is nearly invisible. A red-drifted accent would land the palette exactly in the neighbourhood being avoided.

**D-007 · No tracked-out all-caps eyebrow labels, no middle-dot meta strings, no arrows in button text.**
Brief §3.6 lists these as the template chrome that accompanies the cliché. `--tracking-label` is 0.01em, not 0.08em, so the token itself makes the pattern awkward to build. Section headings are sentence case in the display serif at Display S.

**D-008 · Genre colour assignment: curated map for the ~24 most common genres, hash as fallback.**
Brief §3.1 left this open and noted a curated map reads as more considered. Fantasy reading as moss and horror as plum is a system; both reading as whatever the hash returns is noise. Hash covers the tail. `tag.colorIndex` is stable once written either way, so the map only ever affects first assignment.

**D-009 · Caught up is a segmented progress track; Reading is continuous.**
Brief §3.1 left the device open. Same hue, different track: continuous fill for Reading, a track split into ticks with the fill stopping flush at the last published unit for Caught up. It reads as "up to the edge of what exists" rather than "partway through". Hue alone would fail the requirement that the distinction be legible at a glance.

**D-010 · Axis line separator: a thin vertical rule, not a middle dot.**
Brief §6 flagged the middle-dot warning. `Monstrous | Rigorous | Merciless` set with a 0.5px hairline rule at 40% between words, baseline-aligned. Reads as an engraved caption rather than a metadata string.
*Rejected:* middle dots (§3.6), commas (turns a profile into prose), line breaks (costs too much vertical space on detail).

---
## 2026-09-01 · Illustration route changed

**D-011 · Display serif: Fraunces.** Signed off at the Phase 0 gate. Always paired with `font-variation-settings` — `'opsz'` set to the rendered size, `'SOFT' 20`, `'WONK' 1`. The wonk axis is the reason it was chosen over Newsreader; dropping it makes the choice pointless. Tokens `--display-vf`, `--display-vf-sm`, `--display-vf-xs` carry the three settings.

**D-012 · Interface face: IBM Plex Sans confirmed.** No objection raised at the gate.

**D-013 · Illustration is supplied, not drawn.** Thirteen Storyset figures from the user, recoloured onto a ten-token ramp. Brief §3.5's monoline rule is held loosely at the user's instruction; the "only where content is absent" rule is not.
*Rejected:* the crow (drawable but decorative), the hands (better idea, three failed sketches, would have needed sourcing anyway).

**D-014 · Illustration files carry `var(--il-x, #fallback)` rather than flat hex.** Inline them and they follow the theme; load them through `<img>` and they fall back to the dark values. Claude Code: inline the SVG wherever the theme must be respected, which is everywhere except the corpus download screen.

**D-015 · File size is never a constraint on this project.** Standing instruction from the user, recorded in CLAUDE.md. `cherry-tree-amico.svg` is 3.5 MB and stays.

---
## 2026-09-01 · Contrast

**D-016 · The text tiers are split by role, not by taste.**
Brief §9 makes AA non-optional. Brief §3.1 fixes four text values. Measured against the surfaces those values actually sit on, the bottom two tiers fail badly at the sizes they were being used at — `--text-muted` is 2.89:1 on `--surface-raised` in dark and 3.03:1 in light; `--text-faint` is under 2:1 and was being used for series positions, which are content.

I did not re-hex the palette. Instead each tier now has a role:
- `--text-secondary` takes **all** metadata under 18.66px — 7.09:1 dark, 5.35:1 light.
- `--text-muted` is for text at 18.66px and above, and for non-text UI (inactive nav icons, chevrons) where the floor is 3:1.
- `--text-faint` is never text. Disabled states and dividers only, which is what tokens.css always said it was for.

The four-tier hierarchy survives, carried by size and weight rather than by tone, which is better typography than four greys anyway. Documented at the top of the text block in tokens.css so it cannot be missed.
*Rejected:* lightening muted and faint until they pass — in dark there is not enough room between #F5F0E8 and #16130F for four AA-passing tiers at 11px, and the two lightened values collapse into `--text-secondary`. Also rejected: shipping it and noting the failure, which is what "not optional, and not announced" rules out.

**D-017 · `--accent-text` added.** `--accent` in light is 4.21:1 on base and fails as small text. Accent-coloured *labels* use `--accent-text` (`#C8873F` dark, `#7A4A18` light); accent *fills* keep `--accent`. One extra token, and it removes a whole class of light-mode failure.

**D-018 · "More like this" derives its explanation.** The prototype now intersects the two works' rated axes and prints the shared stops, so the sample shows a three-match row and a two-match row rather than one canned string twice. SCHEMA §9.3 makes `matchedAxes` variable-length; the UI prints up to three, joined with commas and "and". A recommendation that cannot explain itself is not trustworthy, and two identical explanations are worse than none.

**D-019 · Two light-mode contrast fixes, both as tokens rather than as one-off values.**
Dark passed after D-016; light did not, in two places the token retarget could not reach.

*Genre chips.* The twelve spectrum hues are label-coloured at 100%, which measures 2.47–3.87:1 on a light chip — every one fails. Added `--genre-ink` and `--genre-ink-amt` (0% dark, 46% light); the label mixes toward the ink. Hue survives, chips stay distinguishable, `tag.colorIndex` is untouched.
*Rejected:* making the label `--text-primary` in light — that produces the wall of identical grey chips the spectrum exists to prevent.

*Tinted detail header.* Tinting toward `coverDominantColor` darkens a light page, and mid-grey metadata on a darkened page fails: at 22% mix, `--text-secondary` measured 3.58:1. Added `--cover-tint-amt`, 22% dark and 10% light. Holds against a black cover.
*Rejected:* promoting the header metadata a tier — it would make every detail page shout, to solve a problem only light mode has.

Both are theme tokens rather than component values specifically so Claude Code cannot reimplement the failing 22% from reading the prototype.

---
## 2026-09-01 · Phases 3–5

**D-020 · Illustration recolour rebuilt as hue harmonisation.** The token-mapping pass flattened the drawings; user rejected it. Now only hue and chroma move — lightness is untouched, so every internal distinction survives. Hue travels 35% toward 62° or 245°; chroma is clamped to 0.105. Near-neutrals pass through. `magic-tree-cuate` ships as drawn, at the user's request. Files carry literal hex, so `<img>` works everywhere and the `--il-*` tokens are now inert.

**D-021 · The axis scale is a drag between five stops, and unset looks unset.** One word at Display L in Fraunces, swapping as each stop passes, one 10ms tick per stop crossed in both directions. The number is never rendered. When an axis is unrated the thumb is a hollow outline at the first stop, not a filled thumb parked on "Heroic" — every axis is optional and has to look it.
The note line under the track is generated per axis: for the first five it reads "Neither end is better. Plain is not worse than Dense", naming that axis's own ends. Only Ending says it judges. Without that line the visual grammar of a slider implies 5 beats 1, which §6 forbids.

**D-022 · Ending carries a sixth state outside the scale.** "Unfinished — the author stopped" is a separate control below the track, not a sixth stop on it. A stop would put it in an ordering it does not belong to, and `endingNone` is mutually exclusive with `ending` in SCHEMA §2. Selecting it clears the scale value.

**D-023 · The finish moment is one screen, not a sequence.** Green tick, the title, the count and the date, then one offer to set the axes and one way out. `cherry-tree-pana` sits behind at 14% — the second and last place illustration goes behind content. No confetti, no streak, no "well done". The tick is the acknowledgement; §8 forbids congratulating.

**D-024 · The completion ring counts finished, not owned.** SCHEMA §9.5 supplies both. Owning four entries and having read none is not a completed series. The label reads "1/4" and the line underneath says which number it is counting, because a bare ring is ambiguous. No `totalEntriesKnown` means no ring at all — never a fake denominator.

**D-025 · Missing series entries are ghosts, not absences.** Dashed 0.5px cover outline, real title, one-tap Add. This is the whole point of the series page: the frustration §4 names is discovering late that a series sits inside something larger.

**D-026 · Empty-state copy is an invitation with a verb.** Headline names the space, one line explains the rule of the space, the CTA is a verb. "An empty shelf", not "Nothing here yet". Trash has no CTA — an empty bin needs no action. The no-results line says the corpus is thin on web novels and hand-adding works identically, because for this user a miss is the common case, not a failure.

---
## 2026-09-01 · Phase 6 · Spine view

**D-027 · `widthBucket` thresholds are logarithmic.** Brief §7 asks for five widths; SCHEMA §9.6 leaves the derivation to Claude Code (Q-005). Proposed and used in the prototype:

| bucket | width | chapters | pages |
|---|---|---|---|
| 1 | 12px | under 40 | under 200 |
| 2 | 18px | 40–150 | 200–400 |
| 3 | 26px | 150–500 | 400–700 |
| 4 | 36px | 500–1200 | 700–1000 |
| 5 | 48px | over 1200 | over 1000 |

Linear thresholds would put a 388-page novel and a 2,300-chapter serial at opposite extremes with nothing between, and almost the whole library in bucket 1. Logarithmic spacing spreads the buckets across the range actually read. Chapters and pages get separate ladders because a chapter is not a page.

**D-028 · No count at all falls to bucket 2, silently.** For web novels an absent count is common, not exceptional. A gap in a shelf or a special "unknown" width would make missing metadata the most visible thing on the screen. Bucket 2 is the modal width, so an unknown spine is unremarkable — which is the correct treatment.
*Rejected:* excluding uncounted works (hides library), a dedicated 8px unknown spine (turns a data gap into a design feature).

**D-029 · Spines pack into rows in JS; each row is its own shelf with its own rule.** A horizontally scrolling shelf hides most of the library, and CSS `flex-wrap` gives wrapped rows no baseline. Rows are packed to a 358px budget and each gets a continuous 0.5px `--hairline-strong` rule. The result reads as a bookcase with several shelves. Verified: 11 and 10 spines per row at 390px wide.

**D-030 · Spine height varies 148–190px on a hash of the work id.** Five widths and one flat height reads as a bar chart, not a shelf. The hash is deterministic, so a spine never changes height between renders — important under virtualisation, where rows mount and unmount constantly. Height carries no meaning and must not: only width encodes length.

**D-031 · Titles appear on spines from bucket 2 up; bucket 1 spines are colour only.** 12px cannot hold vertical type at 11px without clipping to two characters, which is worse than nothing. `writing-mode: vertical-rl` with `text-overflow: ellipsis`, `--display-vf-xs` (Fraunces at opsz 14), 11px up to bucket 3 and 13px at buckets 4–5.

**D-032 · Reading status is a 3px bar at the foot of the spine.** The only status shown in spine view. Spine view is for scanning a shelf, and the one thing worth spotting from across a shelf is what is open right now. No progress fill, no other status colours, no chips.

**D-033 · No texture, no perspective, no shadow, no tilt.** Brief §7 asked for a bookshelf that is not skeuomorphic. Flat vertical bars in the cover colour, 2px top corners only, the same `--cover-inset` every other cover uses. Hover lifts 6px over `--dur-fast`. That lift is the only affordance.

**D-034 · A width key sits at the foot of the screen.** Five outlined blanks labelled with their chapter thresholds, and one line saying the scale is logarithmic. Without it, width is a rule the user has to infer; five widths with no legend is a puzzle.

**D-035 · `SHELF_FILLER` is prototype-only sample data.** Eighteen extra novels, referenced by spine view and nothing else, because six spines is a diagram and forty is a shelf — the screen cannot be judged at the density it is for without them. Marked for deletion in the logic class comment.


---
## 2026-09-01 · Phase 7 — secondary screens

**D-036 · Stats is a ruled ledger with three figures pulled out above it.** [user's call] The page opens with `knowledge-rafiki`, a display-L year line, then three large tabular figures — finished, chapters read, years tracked — and everything else is label-left/figure-right rows divided by hairlines, grouped under display-S headings: The library · Genres · Series · Authors · Finishing · Before this year. No cards, no tiles, no sparklines.
*Rejected:* running prose with figures set inline (reads well once, badly on the tenth visit); stacked bands one fact each (a dashboard in serif clothing); year sections only (buries this year's numbers).
*Why the three are not home's three:* home already carries finished-this-year / reading-now / library-total. Stats leads with chapters read and years tracked instead, so it is not a bigger home. [user's call]

**D-037 · The genre bar is the only chart in the app.** One 12px bar, twelve segments in the genre spectrum, separated by 0.5px gaps rather than outlines — twelve outlined segments read as twelve cards. Beneath it the top three are named with counts, hairline-separated, then "and nine others" on its own line. Scope toggles between everything and finished only. [user's call on all four]
*Rejected:* a spine row (spine vocabulary already means length, not genre — reusing it would collide); a full labelled list (competes with the ledger rows it sits among); tap-to-reveal (a chart that hides its own labels).

**D-038 · The note editor is a sheet, and attach-to-work expands inline inside it.** [user's call] A second sheet over the editor would stack two modal surfaces, and the add flow already owns the sheet-with-search pattern. The attach row expands in place: the same search field, three results, and an Attach / Attached pill per row. Tapping the chevron collapses it again; the count sits on the row so the collapsed state still says what is attached.

**D-039 · The FAB's second expansion.** On the Notes screen the FAB opens the editor instead of the add sheet, with the same `add-surface` morph and the same unmount-the-FAB rule. One control, two destinations decided by screen — the FAB still expands rather than navigates.

**D-040 · Surprise me deals a card over the list.** [user's call] Modal card, scrim behind, scale-in from 0.94. Three actions: start reading it, pick another, not now. It re-rolls in place rather than navigating, so a rejected pick costs one tap. It is one of the two places besides the FAB and modal sheets that carries `--shadow-sheet` — it is a modal surface, so the exception is the existing one, not a new one.

**D-041 · The left drawer is real and its head is just the wordmark.** [user's call] Notes · Trash · Backup and restore · About, 276px, slides in from the left over a scrim. The owner's name lives on About only, so the drawer never reads as an account panel.

**D-042 · The bookplate name is required.** [user's call, Q-003 closed] The button stays inert rather than hidden, and the line under it says why: "The bookplate needs a name before the library opens." Skip for now is gone.

**D-043 · Settings groups are ledger rows too.** Same row anatomy as Stats — label left, value or control right, hairline between, display-S group headings. Appearance · Default views · Your data · The corpus · Help from a model · Tags · About. The theme control is live and drives the real theme.

**D-044 · Backup and corpus each show more than one state, switched by mono pills.** [user's call on which states] Backup: healthy and mid-restore. Corpus: mid-download and update-available. The pills are in the mono dev voice, not the app voice, because they are prototype scaffolding — Claude Code renders one state at a time.

**D-045 · Restore tells the truth about what it has already done.** "Everything that was in the library has already been replaced. Cancelling now leaves it half restored, so it is better to let it run." The counts read 67 of 67 works, 9 of 14 notes, series waiting. An honest half-finished state is the point of building this screen.

**D-046 · The three import paths live on the Backup screen, not on their own.** Brief §15 puts them there, and a separate Import screen would be a menu of three rows. Trash and the import paths are the two Phase 7 screens built plainer than the rest, per the user's fidelity picks.


---
## 2026-09-01 · Phase 7 revisions (user feedback)

**D-047 · One danger colour, `--danger`.** [user's call: "make the empty it now a bit reddish"] `#C4655A` dark / `#9E3E30` light, at roughly the accent's chroma so it belongs to the palette rather than arriving from a UI kit. Text and border only, never a fill, never more than one per screen; `--danger-soft` (12%) is the hover wash. Emptying the trash is the only use so far.
*Rejected:* `--status-dropped` for destructive actions — dropped is a reading state, not a warning, and overloading it makes a neutral fact look dangerous.

**D-048 · Light theme is cream, and its modal plane goes darker rather than lighter.** [user's call: "the white is too white ... the drawer is also white"] Surfaces are now `#E9E0CF` / `#F4EDDF` / `#FAF4E9` with `--surface-overlay` at `#EFE6D4`. In dark, overlay is a step up in lightness; in light it is a step down, because a sheet lighter than an almost-white page is invisible. Depth in light now comes from tone shift plus scrim plus hairline.

**D-049 · The bottom bar floats.** [user's call: glass, and curved away from the edges] Inset `--nav-inset` (12px) from both sides, lifted `--nav-lift` (10px), fully rounded, `--glass-fill` (the page colour at 78%) behind `backdrop-filter: blur(20px) saturate(1.4)`, 0.5px hairline all round instead of a top border. The FAB moves to 82px so it clears the floating bar. The fill stays above 70% opacity: below that, an 11px tab label over a passing cover drops under AA.

**D-050 · A boot splash gates the first paint.** [user's call: illustrations arrive after the text] Wordmark plus a 104px hairline that fills as the thirteen SVGs land, minimum 520ms, then a 240ms fade. The point is not decoration — it is that no screen is ever seen half-illustrated. Claude Code: hang this on the service worker install and skip the minimum on a warm cache.

**D-051 · Back from a drawer destination goes home.** [user's call] Notes, Trash, Backup and About are reachable from the drawer as well as from Settings, so a back arrow that always returned to Settings lied to whoever arrived by drawer. Home is the one honest destination for all four.

**D-052 · On Notes the FAB becomes a pencil, and a note card opens the same editor.** [user's call: "i almost couldn't find the editor option"] The FAB still expands rather than navigates; only its glyph changes with context. And there is no read-only view of a note — tapping a note in the feed opens the editor with that note in it, because a note is never finished.

**D-053 · Routine motion moves to `--ease-out`, springs are reserved.** [user's call: nothing should pop] New token `cubic-bezier(0.32, 0.72, 0, 1)`. The drawer now slides in over `--dur-slow` (240ms) on that curve; the dealt card scales 0.96 → 1 on it; scrims fade over 180ms; the inline attach expansion rises 6px. `--ease-spring` is now only the FAB and the two sheets it becomes. Grounded in the standard band for mobile transitions — 200–300ms with an ease-out curve for routine opens, springs kept for moments where overshoot means something, since overshoot on ordinary motion reads as instability.

**D-054 · The home wordmark is gone; search shares the row with the drawer button.** [user's call, from Keep] The app name is on the splash, the bookplate, the drawer head and About — four places is plenty, and none of them is the top of the screen you look at forty times a day. Search becomes a full pill on that row. What search and the FAB each mean is still open — see OPEN-QUESTIONS Q-009.


---
## 2026-09-01 · Motion audit fixes and Q-009 resolved

**D-055 · Search and the FAB are two different things.** [user's call, resolving Q-009] The search bar is a lens over what the library already holds — titles, authors, note titles, note bodies, tag names — it is a full screen rather than a sheet, and it never reaches the catalogue. The FAB is acquisition, and instead of guessing which kind it expands into two named doors: **Add by hand** and **Search the catalogue**. One line at the foot of the search results crosses between them, because "I searched, it is not here" is exactly when you want the catalogue.
*Naming:* "corpus" is the schema's word and stays in the schema; the user-facing word is **the catalogue**. The corpus-download screen still says corpus — ask before sweeping it.

**D-056 · The FAB blooms, it does not navigate.** Two labelled rows rise from the FAB corner, scale 0.92 to 1 on --ease-spring over 180ms, transform-origin bottom right; the plus rotates 45 degrees into a close. Labels are on the rows, not left to icons. This is the one place a spring is still correct, because it is the FAB.

**D-057 · Motion audit applied.** Nine findings from the design-motion-principles audit (mobile app: Jakub primary, Emil secondary, Jhey selective). Fixed: exits on every surface that animates in (M-01), lateral tab moves skip the 240ms cross-fade (M-02), the sheets leave on --ease-exit rather than springing back (M-03), the switch knob travels by transform instead of jumping between flex ends (M-04), the finish tick draws itself once over 240ms (M-05), progress animates when the user changes it and never on load (M-06), hover colour changes transition over 120ms (M-07), the axis word dips 45ms rather than cutting (M-08). M-09, the nav bar's backdrop-filter cost, is a profiling task for real hardware and is recorded rather than changed.
*Held:* the cover flight stays at 240ms. It is a drill-down, not a lateral move, and it carries context.

**D-058 · "Read one more" on book detail.** The user-edit path M-06 needed: one quiet accent-text control on the progress row, which increments the count and lets the bar animate. Everything else about progress stays still.


---
## 2026-09-01 · Palette, type, tactile layer, Phase 8

**D-059 · The palette is now the user's four colours.** Burnt Coffee `#34150F` is the page; the other three dark planes are cut from it (`#240E09` sunken, `#421D14` raised, `#52281C` overlay). Champagne `#EACEAA` is the ink, Whiskey Sour `#D39858` the accent, Honey Garlic `#85431E` the accent's deep step. Light inverts the relationship rather than the values: Champagne opened into paper (`#F7EDDC`), Burnt Coffee as ink, the same Whiskey Sour accent, Honey Garlic as accent-as-text at 6.2:1. Accent fills carry Burnt Coffee text in both themes now, which is one fewer thing to remember.
*Held:* the cool counterweight `#7A93A6` and the twelve genre hues stay. The palette is four colours for the chrome; the genre spectrum is data, and recolouring it would break `tag.colorIndex` stability (SCHEMA §7).

**D-060 · Three faces by size.** Sansita for display (22px and up), Montserrat Alternates for the chrome, Taviraj for reading text — note bodies, blurbs, the long paragraphs on error and empty screens. Sansita is a static family, so `--display-vf` is now a **weight** (700 / 700 / 400) rather than a variation axis; every `font-variation-settings` in the prototype became `font-weight`. IBM Plex Mono survives in the dev jump bar and nowhere the user can see.
*Consequence:* Fraunces is gone, and with it the wonk axis that D-002 chose it for. The printed quality now comes from Sansita's high-contrast Latin shapes instead.

**D-061 · A tactile layer over the existing choreography.** New tokens (`--ease-fluid-out`, `--ease-spring-back`, `--ease-standard`, `--duration-micro/medium/fluid`, `--press-scale`) sit alongside `--dur-*` rather than replacing it: the new vocabulary governs press, ripple, drawer and overlay; MOTION.md's existing choreography keeps its own. Every button presses to 0.96 on `--ease-fluid-out`; `[data-ripple]` controls grow a radial ripple from the contact point; the drawer is GPU-hinted and its four rows cascade in at 80/130/180/230ms; haptics went from 10ms to 12ms.
*Exception:* the FAB carries `data-no-press`. It morphs into a sheet through a view transition, and a competing scale transform fights that.

**D-062 · The FAB is never dimmed by its own menu.** The menu layer sits at z-index 45, below the FAB's 50, so the scrim darkens the app but not the control you just pressed. The two doors are now `--fab-size` circles with 15px labels — the same size as the button they came out of, which is what makes them read as it opening rather than as a popup arriving.

**D-063 · Phase 8.** Three screens. **Skeleton** is the library's own layout with the content withheld — same gutters, same cover ratio, no shimmer, because a fake animation standing in for progress is the one thing the anti-pattern gate forbids outright. **Error states** carries three real failures (catalogue download interrupted, unreadable backup, offline cover fetch); each names what happened, states what is still true in a bordered block, and offers exactly one way forward plus a way out. **Everything** renders the stated 2,000-work ceiling windowed at a fixed 76px row — only the visible rows plus four either side are in the DOM, and the count of what is mounted is printed on screen so the windowing can be judged rather than trusted.
*Rejected:* a spinner on the skeleton, and error codes on screen. The code goes in the log, not at the user.


---
## 2026-09-01 · Dark theme rebuilt on the grey ramp

**D-064 · The dark theme is cool blue-grey; the light theme stays cream.** [user's call, with a shades-of-gray ramp attached] Page is **black-90 `#212631`**, not black-100 — a true-black page is where every app lands by default, and the grey holds the amber better. Sunken drops to `#0A0E15`, raised `#2C3340`, overlay `#373F4E` (black-80). Text runs the white ramp: `#FFFFFF`, `#BFC6D4` at 9.1:1, `#8F98A8`, `#667085`.
The two themes are no longer mirror images, and that is deliberate: dark is cool and neutral, light is warm paper. Whiskey Sour `#D39858` is the constant across both — in dark it is now the only warm thing on the screen, which is precisely an accent's job.
*Consequence:* `--cool` existed to cut a warm brown page. Against blue-grey it counterweights nothing. Flagged for Phase 9 rather than deleted mid-turn.

**D-065 · The drawer gets its own duration, `--duration-drawer` 380ms.** [user's call: "the drawer opening is a bit fast"] It is the only surface that crosses the whole screen, so it is the only one that earns longer than `--duration-fluid`. Its four rows follow at 140/200/260/320ms — they now trail the panel rather than racing it.

**D-066 · The light nav bar takes the raised plane, not the page.** It was tinting page-cream through `saturate(1.7)`, which on a light surface goes muddy grey. Light now sets its own `--glass-fill` (raised at 92%) and `--glass-blur` (32px, saturate 1.05). Dark keeps the heavier saturation, where it reads as depth rather than dirt.


---
## 2026-09-01 · Dark goes monochrome

**D-067 · The dark theme has no warm accent.** [user's call: "why is orange still there?"] Dark's accent is now a lifted blue-grey off the same ramp — `#8FA3C4`, with `#4E576A` (black-70) beneath it and `#B3C2DC` above. It reads as "the live one" by **lightness**, not by hue, which is the only way an accent can work inside a monochrome theme. `--accent-text` measures 7.3:1 on the page; reading/caught-up status follow the accent; finished moved to a cooler green `#7FA486` so the one remaining hue does not sit alone looking like a mistake.
**Light keeps Whiskey Sour**, and keeps warm status colours with it — the cool status values live in `:root` for dark and are overridden back in the light block (reading/caught-up `#B77638`, one step down from light's accent so a 3px bar clears the 3:1 non-text floor, which `#D39858` on cream does not; finished `#5E7F52`, dropped and wishlist unchanged). The two themes no longer share an accent, and that is the point of them being two themes rather than one theme inverted.
*Consequence:* the twelve genre chips are still warm — they are data, tied to `tag.colorIndex`, and they now read as the only colour in the dark app. That is arguably correct (colour means genre, nothing else) but Phase 9 should look at it deliberately.

**D-068 · The nav bar is liquid glass, and it is opaque enough to survive a busy list.** Three layers rather than a tint: `--glass-fill` on the overlay plane at 78%, `--glass-blur` at 36px with saturation, and on top a `--glass-sheen` gradient plus a `--glass-ring` inset highlight along the top edge. `--shadow-nav` sits it above the page.
The ring is the working part. The bar was dissolving into the 2,000-row list because a translucent panel over dense content has no edge; a half-pixel of light along the top edge gives it one, at any scroll position. The scroll padding on that screen also went 104px → 120px so rows stop short of the bar rather than passing under it forever.
*Light gets its own values:* a near-white sheen and almost no saturation. On a light surface, heavy saturation goes muddy rather than bright.

**D-069 · "Everything" is a real destination.** It was reachable only from the dev jump bar, which means it did not exist. It is now the last row of **Shelves** on home — after Books, Novels and Manhwa — with the total on the right. Three grey slivers instead of cover colours, because it is not a shelf, it is all of them.


---
## 2026-09-02 · Phase 9 — the critique pass

**D-070 · `--cool` and `--cool-deep` are deleted.** [closes Q-010] The slate existed as the single cool note against a warm brown page. Dark is now cool throughout, where it sat a few degrees from the accent and read as a second accent that meant nothing; light lost nothing by using `--text-secondary` in its place. Six usages replaced: the series line and publication label take `--text-secondary`, the universe chevron `--text-muted`, and the two callout boxes (reading order, series suggestion) become `--surface-raised` inside a hairline like every other card in the app. The suggestion's confirm button takes the real accent.
*What this buys:* one accent, one hierarchy. A reader can now learn a single rule — accent means live, hairline means grouped — instead of two.

**D-071 · The user-facing word is "catalogue" everywhere.** [closes Q-011] Settings heading, the model-fallback row, the paste-a-list description, and the no-results copy all changed. **The schema keeps "corpus"**, and so do the state keys, the screen name and the handler names in the prototype — renaming those would break the contract in `docs/schema.md` for a word the user never sees. The corpus screen itself already spoke of "the index", which is the right word there: what downloads is an index, what it indexes is the catalogue.

**D-072 · Instrumentation comes off the Everything screen.** The mono row number on each row and the "rows 1990–2000 in the DOM" counter were there so the windowing could be judged. They are developer tools on a user screen, and a row number is data slop — it tells the reader nothing about the book. Both gone; `vWindowLabel` remains in the logic for anyone who wants to log it.

**D-073 · The genre chips stay warm in the dark theme.** Considered and kept. They are the only colour left in a monochrome app, which sounds like an oversight and is in fact the strongest version of the rule the palette has followed since D-011: **colour means genre and nothing else.** Now that the chrome has no hue at all, a coloured chip can only be read one way.


---
## 2026-09-02 · Onboarding rebuilt, and three corrections

**D-074 · Onboarding happens in the app, not in front of it.** [user's call: "the onboarding is not professional at all"] The three swipeable cards are deleted. In their place:
1. **A welcome screen.** Constellation scaling in behind, then five staggered beats on `--ease-fluid-out` at 120/260/440/620/760ms — "Welcome to", the wordmark at 52px, one line of what the app is, a rule that draws itself, and the offline promise. One button.
2. **The bookplate**, unchanged — name the library.
3. **A four-step tour on the real home screen.** A spotlight cuts a hole in the scrim over an actual control and a card explains it: search, the Continue card, the drawer, the FAB. Next, or Skip.
*Why the cards had to go:* two of the three had no illustration, so they read as a screen where something failed to load. More importantly a carousel asserts features against an empty background; a spotlight shows you the control while you read about it, and you arrive already knowing where things are.
*The spotlight is measured, not hardcoded* — `measureTour()` reads the target's live rect each step, so it stays correct at any frame size and survives copy changes above the target. The card takes whichever side has room.

**D-075a · The dev jump bar is one scrolling row.** It was five wrapped rows, ~170px, which pushed the bottom of the 720px frame below the browser window — the reason the nav bar kept "vanishing" on the Everything screen. It renders and always did; it was simply off-screen. Now one `overflow-x: auto` row at ~30px, every chip `flex: none`. A prototype whose chrome hides the product's chrome is a prototype that lies about the product.

**D-075 · The nav bar was blending into the Everything list, not vanishing.** Dark `--glass-fill` went 78% → 88%, and the list now fades to page colour over 72px and sits on a solid 66px strip behind the bar. A translucent bar over 2,000 uniform rows has nothing to be translucent against.
Also: `scale` and `search` joined `LIB_SCREENS`, so the Library tab reads as active on both. A screen you can reach with no tab lit is a screen the app has lost track of.

**D-076 · The constellation gets its own colour tier.** `--art-line` and `--art-dot`, well under `--hairline`: 0.055 / 0.085 white in dark, 0.085 / 0.13 ink in light. Dark needs roughly a third of light's value — a light line on a dark ground carries much further. It is the only decorative thing in the app and it must never compete with a hairline that means something.

**D-077 · No bottom nav on the welcome screen.** `showChrome` excludes it alongside the bookplate, the finish moment and the corpus download. Chrome on a screen with one button is chrome that does nothing.


---
## 2026-09-02 · Filtering Everything, and a fifth tour step

**D-078 · Everything filters by genre, and only by genre.** [user's call] Not search — search is a separate screen over the whole library, and a second search field inside a list would be two answers to one question. Genre is the right axis because it is the one thing every work carries and the one thing the colour system already encodes, so a filtered list stays legible by colour alone.
A pill in the header opens a sheet: twelve chips with live counts, and an **Any / All** toggle. Any is the default because it is what a reader means by "show me my horror"; All is for the narrow cross-section — dark fantasy *and* political. The sheet's primary button states the result before you commit to it ("Show 333 works"), and picking a combination nothing carries gets its own empty state pointing at the Any toggle rather than a blank screen.
*Implementation note:* filtering happens **before** windowing. The spacer height and the scroll extent must describe the filtered list or the scrollbar lies.
*Sample data:* generated works now carry one or two genres, the second drawn from a plausible-companion table rather than arithmetic, so "all" combinations return something. Claude Code deletes this with `BIG`.

**D-079 · A fifth tour step, for Everything.** Placed before the FAB step so the tour ends on the thing you do most. It points at the Everything row in Shelves and names the filter, because a destination the user has to discover twice is a destination they will not use.
*This exposed two bugs in the tour, both now fixed.*
**The target was off-screen.** The Everything row sits below the fold, so `measureTour()` was ringing an element the user could not see. It now finds the target's own `.exl-scroll` ancestor, sets `scrollTop` so the target lands mid-frame, and measures in the same synchronous pass. Not `scrollIntoView` — that moves the whole page. The scroll is deliberately instant, not smooth: it happens under the scrim where nobody can see it, so animating it buys nothing, and the in-flight state flag a smooth scroll needs can outlive its step and freeze the ring on the previous control. Any future target below the fold gets this for free.
**The overlay was tearing down between steps.** `tourNext` nulled `tourRect`, which unmounted the whole layer — so the scrim re-faded on every step and the spotlight had no previous position to interpolate from. It now advances the step only and leaves the old rect rendered until the new measurement lands. `isTour` still requires a rect as well as a step; that guard prevents a 0×0 ring at the frame origin on first mount and must stay.

**On the user's question — "I'll already be searching in the corpus":** worth recording that this is the one place the model of the app is easy to get backwards. Search reads **your library** and never the catalogue; the catalogue is behind the FAB and only ever adds new works. So finding something you already own is always search's job, never the catalogue's.


---
## 2026-09-02 · Deletion, and a theme control on home

**D-080 · Deletion was missing everywhere except the trash.** [user's call] You could add to the wishlist, write notes and add works, and undo none of it. Four affordances added, each shaped by whether the action is reversible:
- **Wishlist row** — a trailing × . No confirmation and no trash entry: the work was never in the library, so removing it destroys nothing.
- **Book detail** — "Remove from the library" as the last thing on the screen, danger-bordered, with the consequence stated under it ("waits in the trash for thirty days, its notes survive as loose notes"). Bottom of the screen because it is the rarest thing you will do there.
- **Note editor** — a trash glyph in the header, left of Save. Goes to the trash like everything else.
- **Trash row** — "Delete now", the per-item permanent delete that was missing. Emptying was all-or-nothing before.

**D-081 · Irreversible controls arm in place; reversible ones just act.** No dialogs anywhere. The two permanent deletes — "Delete now" and "Empty it now" — change their own label on first press ("Sure?", "Tap again to empty it for good") and take the wash of `--danger-soft`. Everything else is a single tap, because a thirty-day trash already IS the confirmation, and a modal in front of a reversible action teaches people to dismiss modals without reading them.

**D-082 · A sun and a moon, right of the home search bar.** [user's call] The theme lived only in Settings, three taps from a decision people make by feel and change often. Two **44×44** glyph buttons, 6px apart — `--touch-min` is 44 and two small targets that flip the whole app's appearance are the worst possible place to shave it.
The selected state is a `--surface-raised` pill plus `--text-primary` ink, against `--text-faint` for the other. The first attempt used `--accent-text` vs `--text-muted`, which measures **1.14:1** in dark since D-067 made the accent a blue-grey — the two glyphs were indistinguishable. Any selected state in this app has to survive a theme with no hue in it, which means lightness and a surface, not colour.
Settings keeps its Dark/Light segmented control — the same setting in two places is fine when one is the shortcut and the other is the inventory.

**D-083 · One derived live list, so a delete is felt everywhere.** `gone` holds removed ids and `LIVE = WORKS.filter(...)` is derived once at the top of `renderVals`; the shelf, the spine view, search, Continue and the series page all read it. The first implementation of "Remove from the library" and "Delete this note" only navigated away — the work was still on the shelf when you got there, which is worse than no delete button at all, because it silently claims to have done something.
Notes are keyed by their **original** index (`gkey`), mapped before filtering. Filter-then-map re-indexes the list, so the second deletion would hit the neighbour of the one you asked for.
*And a second attempt was needed.* `by = id => LIVE.find(...) || WORKS[0]` looked like a crash guard and was actually an un-delete: `WORKS[0]` **is** w1, so removing the current read made the Continue card redisplay it while the shelf and search correctly dropped it. A fallback that silently substitutes different data is worse than the crash it prevents.
Continue and its two peeks now come off `reading` — a preference-ordered id list intersected with `LIVE` — so no hardcoded id reaches the template and removing the current read **promotes the next one**. With nothing left to read the whole block is `sc-if`'d away rather than showing a substitute. Home's most prominent surface is exactly where a stale record is least forgivable.


---
## 2026-09-02 · Two corrections

**D-084 · Every View Transition promise now has a rejection handler.** A transition rejects whenever it is aborted — which happens whenever a second navigation starts before the first settles, i.e. ordinary fast tapping. All six sites were leaking: `nav()` called `startViewTransition(go)` bare, and the other five used `vt.finished.finally(cleanup)`.
`.finally()` is the trap: it runs the cleanup and then **re-throws**. So the cleanup always worked and the rejection always escaped, ~20 unhandled rejections in a normal testing pass. Now `vt.finished.then(clean, clean)` at the five cleanup sites — consumes the rejection *and* keeps the cleanup on both paths — and `.finished.catch(() => {})` on the bare call in `nav()`.
That fixed `finished` and missed the point. A `ViewTransition` exposes **three** promises — `ready`, `updateCallbackDone`, `finished` — and an abort rejects all of them; Chrome reports whichever has no handler, so handling one site's `finished` just moved the noise to `ready`.
**The real fix is that there is now exactly one place that starts a transition.** `vt(update, cleanup)` swallows all three promises and runs the cleanup on both paths; all six call sites go through it and `document.startViewTransition` appears once in the file outside capability checks. Per-site handlers were always going to miss one — a rule enforced by a single function cannot be forgotten by the next call site.
Verified at 30 navigations on a 45ms interval, well inside the transition duration: zero unhandled rejections.
Nothing about the motion changed; the console was the only casualty. But it flooded during exactly the tap-tap-tap the user has been asking to feel smooth, which is the worst possible place for noise.

**D-085 · Sample counts move when you delete, without pretending to be derived.** The shelf counts (34/21/12) and library total (67) describe a library the nine sample works only sample — they cannot be computed from `WORKS`. But holding still through a deletion reads as the same silent no-op just fixed on the Continue card. Deletions are now **subtracted** from the stated figure: `34 - lost('book')`, `67 - removed`. Honest about the sample, responsive to the action. Claude Code replaces the constants with real aggregates and the subtraction disappears.


---
## 2026-09-02 · Reading sessions, and five things that were only pretending to work

**D-086 · Reading sessions. Q-007 closed.** Stats displayed "41,208 chapters read" and nothing in the app produced it; detail had a "Read one more" button that incremented a bar and fed nothing. Both were decoration.
A session sheet now opens from detail. It does **not** ask how much you read — nobody knows that — it asks **where you got to**, and derives the session length: stepper plus `+1 / +5 / +10`, a live "10 chapters this session" line, the new percentage, and a save button that reads "Log it" or "Finish it" when the value reaches the total. The stepper floors at the current position, so a session can never record going backwards. Stats' figure is now `baseline + logged`, and it moves when you log.
*Re-reads stay out of scope per the user.* The schema's single `progressCurrent` cannot hold a second pass, and inventing a field is exactly what §"the boundary rule" forbids.

**D-087 · Search names what is already on your wishlist.** Searching a title you have already earmarked returned nothing and invited you to add it twice. There is now an "On your wishlist" section with a `--accent`-outlined *Wishlist* chip per row. Wishlist-status works are excluded from the *Works* section so nothing appears twice — a work is either in the library or waiting, never both.

**D-088 · Note tags were one hardcoded chip.** The editor's Tags row rendered the literal string "Dark fantasy" and did nothing. It is now all twelve genres as toggleable chips, each with its colour sliver, sharing the genre-filter chip vocabulary exactly.

**D-089 · Attach-to-work's search box was a picture of a search box.** A `<span>` containing the word "ledger" and a fake caret. It is a real input; the list filters on title and author, and a query that matches nothing says so and reminds you a note does not have to be attached to anything.

**D-090 · The wishlist had no empty state.** Removing every row left a heading over blank space. It now says "Nothing waiting" and names the one action that fills it, and the counter reads "nothing waiting" rather than "0 waiting" — a zero rendered as a numeral looks like a bug.

**D-091 · "By Qusai" in the drawer.** [user's call] Under the drawer wordmark, 11px, a gold gradient clipped to the text (`#8A6A34 → #E8C77A → #C9A55E → #8A6A34`) so it reads as leaf rather than as a yellow label. Drawer only — it went onto all five wordmarks on the first pass, which turned a credit into a watermark.

**On "is anything else for show?"** After this pass the honest list of things that are still sample scaffolding rather than broken promises: the shelf counts and the three home figures (invented totals, now at least responsive to deletion — D-085), the corpus download progress, the backup timestamps, and the `2,000`-row Everything list. All are labelled in-file as prototype-only and all have a real shape behind them for Claude Code to fill. The one thing with a control but no implementation is **Ask a model** — see Q-014.


---
## 2026-09-02 · Prototype state is keyed per entity

**D-092 · One root cause behind three bugs: unkeyed mutation state.** Every fake mutation in the prototype was stored in a way that could not identify what it applied to.
- **Progress was a global integer.** `bumped` held one number, guarded by `workId === w.id` — which is not a key, it is "is this the screen I am on", true for whatever work you open next. A session logged against The Verdigris Ledger reappeared as ten extra pages on Field Notes on Ruin, in the wrong unit. Now `logs: {}` keyed by work id; `deco` reads `logs[w.id]`, and a new session's baseline comes from the same map. Verified: w1 → 422/1,140, w8 still 212/388.
- **`gone` mixed index keys with real ids.** Wishlist rows keyed themselves `'w' + i`, and `gone` also holds work ids, so removing wishlist row 1 pushed `'w1'` and deleted The Verdigris Ledger from the library — silently, several works at a time, until `by()` fell through to its fallback and detail rendered a wishlist entry. Keys are now namespaced: `wish:i`, `note:i`, `trash:i`, bare ids for works. An index and an id can no longer be the same string.
- **Row handlers read `s.gone` from their render.** Six × clicks in one frame removed one row, because every closure concatenated onto the same stale array. All of them now use the updater form. Verified: six clicks, six rows gone, empty state showing.

**D-093 · The stepper had the same defect, written the same turn.** `sessUp`, `sessDown` and the `+1/+5/+10` chips all computed from `sessAt` captured in the render and wrote with the object form of `setState`, so five taps in one frame registered as one and `+10` then `+5` logged five. They now derive from previous state via a `sessNow(p)` helper. `sessFrom`/`sessMax` stay closure-captured — they come from the work, which cannot change while the sheet is open.
This mattered more than the `gone` case it mirrors: repeated tapping *is* what a stepper is for, and on a touch device taps land well inside one frame, so the control would routinely under-count a real session and feed a wrong number to Stats. Verified: five taps → 5, `+10` then `+5` → 20.

*The lesson worth keeping:* the first two read as unrelated symptoms — a progress number bleeding across screens, and deleting the wrong record — and were the same mistake. Prototype shortcuts are fine; unkeyed ones are not, because they fail as **wrong data** rather than as an error, and wrong data is what a reviewer will believe.


---
## 2026-09-02 · Genres and tags (docs/taxonomy.md v1)

Two systems, two jobs. Before this the app had **one** twelve-item list, called "genres" on some screens and "tags" on others, and four of its names (Xianxia, LitRPG, Litfic, Political) were actually tags in the delivered vocabulary. Eight surfaces read from it.

**D-095 · The genre mapping is fixed and documented in tokens.css.** The palette already held the document's twelve hex values exactly, so this was a pure re-index — no colour moved. `--genre-1` (amber `#C8873F`) is **Progression & Cultivation**, per the user: it is the largest category in this library and every mainstream taxonomy files it under Fantasy.
The assignment is written into the token block as a table with a warning not to reorder it. A work stores the *index*, so re-indexing silently recolours the whole library — the one change here that could not be spotted by looking.
*The accent conflict, resolved by the user:* amber is the accent hue in light but not in dark (D-067 moved dark to a blue-grey at the user's request). Progression stays amber in both themes and is simply not the accent colour in dark. Chosen over re-pointing dark's accent, which would have undone a decision the user asked for two sessions ago.

**D-096 · Genre chips and tag pills are two different objects.** A card showing 2 genres and 9 tags read as eleven equivalent things.
- **Genres**: 13px, filled with the genre hue, a colour sliver, a visible border. The **primary** genre takes 170% of the fill alpha, 130% of the border alpha and weight 500; the second takes 100/60 and weight 400 — so which one is primary is legible without a label.
- **Tags**: 11px, transparent, hairline border, pill radius, `--text-secondary`. Supporting, countable, never competing.
Shelf rows carry genres only. Tag pills at row density would be noise.

**D-097 · The tag picker is a full screen, not a sheet.** 242 tags across 7 groups, and the second most-used input after search — a sheet would fight the keyboard. Search is pinned at the top and runs across every group at once; **a query auto-opens every group with a hit and hides the rest**, so groups are the fallback structure rather than the primary route. Before any typing: suggestions, then Recently used, then Used most, then the seven groups collapsed with counts.
Verified against the real extremes: "Heavens/Immortal Realm" and "Depictions of Cruelty" both hold one line at phone width; "System" and "War" do not look broken next to them.

**D-098 · Suggestions are genuinely pre-selected, in their own row, individually dismissible.** "Suggested by the catalogue" sits above everything with **Accept all** and a × per chip, and the line *"Nothing is saved until you go back."*
First implementation had them *styled* as selected but absent from the picked set, so Done would have silently dropped them — the same class of lie as a delete button that doesn't delete. They are now seeded into `tagPick` at open; dismissing removes from both; Accept all retires the row and keeps the tags.

**D-099 · Creating a tag lives in the header, not the results.** A dashed "New tag" button beside the title. The user's rule was possible but never the first option offered — putting it at the bottom of a results list still makes it the last thing you see every time you fail to find something, which trains you toward it. In the header it is available and out of the reading path. A zero-result search says what to do rather than offering a button.

**D-100 · Content warnings: hidden entirely when off, red wash when on.** One helper, `tagPills()`, decides both visibility and treatment, so the Settings toggle cannot be honoured on one screen and missed on another. Off is the default and off means *neither shown nor created* — the whole group disappears from the picker, not just the chips.
When on: a `--danger` wash at 16% behind the pill, a 55% border, and `--danger-text` ink (a new token — `--danger` itself does not clear contrast against its own wash). The group header carries an "opt-in" badge. Chosen over a dashed border or a leading dot: the wash reads as a different class of object before you read the word, which is the actual requirement.

**D-101 · Stats merges the thin tail.** With the real distribution — 22 / 15 / 8 / 6 / 5 / 4 / 3 / 2 / 2 / 1 / 1 / 1 of 70 — the twelfth genre is about 4px at phone width, which reads as a rendering fault rather than a small number. Everything under 2% now collapses into one `--text-faint` segment at the end, and the line beneath says so: *"and nine others, of which three hold one work each."* Ten segments, smallest 10px, measured.

**Sample data now carries both.** Every work has `genres` (≤2, primary first) and `tags` (real strings from the vocabulary). w10 carries Gore and Body Horror specifically so the warning toggle has something to hide and reveal. The 2,000-row set's `tags` field was renamed `genres` — it was always genre indices.


---
## 2026-09-02 · Two picker corrections

**D-102 · `tagpick` joins the no-chrome list.** The bottom nav sat on top of the picker's footer, covering 42 of the Done button's 48px and the tag count beside it. The picker is a modal flow with its own bottom furniture, so it belongs alongside `bookplate`, `finish`, `corpus` and `welcome` in `showChrome`'s exclusion list — the same reason `welcome` was added in D-077. Any future full-screen flow that supplies its own confirm control needs the same entry.

**D-103 · The picker's return path keys off the screen, not the `editor` flag.** Opened from the note editor, back and Done both landed on book detail — the note abandoned and the tags apparently attached to a book.
Two compounding causes: `nav()` unconditionally clears `editor`, so reading it on the way *out* was dead code; and `openWork()` sets `screen` **without** clearing `editor`, so the flag can be stale-true while you are looking at book detail. Either alone would have produced a wrong answer half the time.
The entry point is now recorded at open time from `this.state.screen` — current state, not the render closure — the same shape as `closeAdd`'s `returnTo`. Verified in both directions: detail → picker → Done → detail; note editor → picker → Done → note editor with Save still there.
*Worth noting:* `editor` being a flag that outlives its screen is a latent trap for anything else that reads it. Claude Code should treat "which screen am I on" as the single source of truth and derive modal visibility from it, rather than keeping a parallel boolean.

**Also:** the two chip rows on detail regained their headings — "Genre"/"Genres" (it pluralises) and "Tags". They were carried by the block that got removed with the swap scaffolding, and D-096 separates the two objects by weight, not by label; both are wanted.


---
## 2026-09-02 · Logging against ongoing works, and editing genre

**D-104 · `canBump` no longer requires a known total.** Saltbound — an ongoing translated serial with `cur: 88` and no `total` — had no way to record a session, because the CTA was gated on `!!w.total`. That is the most ordinary work in this library, not an edge case: a serial you are mid-way through has no known length by definition.
Caught-up works were excluded too, which was the same mistake seen from the other side. "Caught up" on an ongoing serial is a *waiting* state — chapters arrive and you log them — so the manhwa (Iron Reverie, 214/214, ongoing) could never move either. The CTA now reads **"New chapters"** rather than "Log a session" for a caught-up work, because that is what the action means there.
Only `reading` and `caught_up` qualify. Dropped, finished and wishlist works stay without the control.

**D-105 · For an ongoing work, `total` means "released so far", not a ceiling.** Three places assumed otherwise:
- the stepper capped at `total`, so a caught-up serial was unloggable the day new chapters landed — `sessMax` now ignores `total` for ongoing works;
- `sessDone` offered **Finish it** on reaching the last published chapter, which would have marked an unfinished serial finished — finishing now requires `pub !== 'ongoing'`;
- the percentage label read as progress toward an end that does not exist — suppressed for ongoing works, which show "214 published" instead.
Reading past the published count now reports **Caught up** rather than 103%.

**D-106 · Genre is editable, in an ordered two-slot sheet.** The taxonomy makes primary-vs-second a real distinction (D-096 renders it), so this could not be the filter's flat multi-select.
- The first tap is primary; a second tap adds the secondary. **A third tap is refused** — the chip dims to 0.35 and stops responding — rather than silently evicting one of the two already chosen. The sheet says which state it is in.
- A "Make *X* primary" link appears only with two selected, naming the genre it will promote, so the swap is legible before you commit.
- Edits persist as `genreOv[workId]`, the same override shape as `logs` and `finished`, read in `deco()` — so one place still owns what a work looks like.

**Also:** the genre row on detail is now always present, with an **"Add a genre"** affordance and a quiet "None yet". Previously `hasGenres` hid the whole row, which left `w9` — the manual, untitled draft with no genres — with no route to add one. An empty state that hides its own entry point is a dead end.
