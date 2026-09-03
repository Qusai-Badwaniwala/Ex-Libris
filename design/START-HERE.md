# START HERE
You are Claude Design, continuing the Ex Libris visual system. The previous session ran out of context. This file replaces the conversation. Read it, then read the four files it points you at, then continue at Phase 7.

The user's instruction to you is expected to be one word: **start**. Do not ask them to re-explain anything.

---

## 1 · What this project is
**Ex Libris** — a personal reading tracker PWA for one person. Mobile-first, offline-first, no accounts, no social features. It tracks books, web novels and manhwa in one library.

**You own:** the entire visual system — palette, type, motion, illustration, every screen, and all the copy.
**You do not own:** the app build. A separate Claude Code session builds from your output. Your job is to hand them a system precise enough that they never guess.

**The user is the sole user of the app.** When they say "I", they mean the person the app is for.

---

## 2 · Read these, in this order
1. `CLAUDE.md` — standing project rules. Two matter enormously: **file size is never a constraint** (never raise it, never mention it), and illustration rules are held loosely.
2. `docs/brief.md` — the design brief, 595 lines. §3.6 (the cliché to differentiate from) and §3.7 (technical constraints) are the two sections the user named as most important. Anything designed outside §3.7 comes back as rework.
3. `docs/schema.md` — the data contract. Complete and authoritative. Both sessions have it.
4. `HANDOFF.md` — current state, what is built, what is not, and the traps.

Then skim `DECISIONS.md` (D-001 to D-035), `COMPONENTS.md` (21 components), `MOTION.md`, `ILLUSTRATION-NOTES.md`, `OPEN-QUESTIONS.md`.

**Never read the `.docx` files in `uploads/`.** They are binary; the extracted markdown in `docs/` is the real source.

---

## 3 · How the user works with you
Quoting their own instructions:

> Communication: standard technical English, plain words, only what's necessary. No preamble, no recaps, no unsolicited insights — it wastes tokens. But ask questions freely; I'd rather answer ten than unpick one wrong assumption.

Also standing:
- **Stop after every phase.** Do not run several phases together. They said this explicitly after Phase 6.
- **Ask questions or raise suggestions either before starting a phase or after finishing it.** Both are welcome. Silence is not.
- Keep the handoff files current as you go, not at the end.
- They will switch sessions when context gets long. Assume this file is how the next session starts.

---

## 4 · Where the work stands
**Phases 0–9 complete.** The system is finished and ready to hand to Claude Code — see the transfer manifest in `HANDOFF.md`.

| phase | what | state |
|---|---|---|
| 0 | direction: type, palette, scales, motion, illustration | done, gate passed |
| 1 | bookplate, home, format screen, book detail, add flow | done |
| 2 | cover transition, FAB, springs, haptics | done, **gate not felt on a phone** |
| 3 | axis scale, finish moment, axis line | done, **gate not felt on a phone** |
| 4 | series and universe pages | done |
| 5 | illustration placement, six empty states | done |
| 6 | spine view | done |
| 7 | Wishlist, Stats, Notes + editor, Settings, backup/restore, import, corpus download, Trash, drawer, About | done |
| 8 | loading skeletons, error states, virtualisation at 2,000 items | done |
| 9 | critique pass — remove accessories, kill anything decorative | done |

Gates 2 and 3 need the user's thumb on a real Android phone, not your eyes. They are built and running. Remind them once; do not block on it.

---

## 5 · Files you will work in
| file | what |
|---|---|
| `Ex Libris.dc.html` | **the prototype.** Twenty screens, dev jump-bar at the top, theme toggle. This is where Phase 8 goes. |
| `tokens.css` | the contract with Claude Code. 115 custom properties, both themes. |
| `Direction.dc.html` | Phase 0 gate page. Reference, not living. |
| `Illustration plan.dc.html` | all thirteen illustrations with their placements. |
| `illustrations/*.svg` | harmonised, backgrounds stripped, literal hex. Originals untouched in `uploads/`. |

Edit the prototype with `dc_html_str_replace` and `dc_js_str_replace`. It is one large DC by design — do not split it into child components.

---

## 6 · The system in one page
**Type.** Fraunces for display, IBM Plex Sans for interface, IBM Plex Mono for dev chrome only. Fraunces is **useless without `font-variation-settings`** — always pass `--display-vf` (40/30px), `--display-vf-sm` (22px) or `--display-vf-xs` (spine titles, axis line). The `WONK` axis is why Fraunces was chosen over Newsreader; dropping it makes the choice pointless.

**Palette.** Dark-first, four surface planes, four text tiers, 0.5px hairlines. Depth comes from planes and hairlines — **not shadows.** Only the FAB and modal sheets may cast one. Accent is a golden-amber coffee crema, used about three times per screen; covers carry all the colour. One cool slate as counterweight, reserved for facts about the world rather than about the reader.

**The cliché being avoided** (§3.6): cream + high-contrast serif + terracotta, with tracked-out all-caps eyebrows, middle-dot meta strings, and arrows in button text. All four are banned. `--tracking-label` is 0.01em specifically so the eyebrow pattern is awkward to build. Meta strings use hairline rules as separators, never middle dots.

**Motion.** Three `linear()` springs, nothing over 250ms, never `ease-in-out`. Two signature moments: the cover flight (list → detail, shared element) and the FAB expanding into the add sheet. Haptics fire in exactly three places. `prefers-reduced-motion` is handled at the token level.

**Illustration.** Thirteen Storyset SVGs the user supplied, harmonised — hue pulled 35% toward amber or slate, chroma clamped, **lightness never touched** so every shading distinction survives. They appear only where content does not. Two deliberate exceptions sit behind content at low opacity. An earlier version mapped everything onto ten tokens and flattened the drawings; the user rejected it. Do not go back to that.

---

## 7 · Traps that will cost you an hour each
- **`all: unset` resets `box-sizing` past the universal rule.** Any `all: unset` button that sets `width: 100%` and has padding must also set `box-sizing: border-box` inline. This caused the one real layout bug in the project.
- **Two live elements may never share a `view-transition-name`.** The FAB is unmounted while the add sheet is open for exactly this reason. A list cover holds the name only for the duration of the flight, then loses it.
- **On close, the FAB's transition name must be reapplied inside the `setState` callback**, before the browser takes its "after" snapshot — otherwise the sheet has nothing to shrink into.
- **The phone frame is 390×720.** Taller than that and the host scales the whole page down, which the user reads as "zoomed out". Do not grow it.
- **`--text-muted` and `--text-faint` are role-restricted.** All metadata under 18.66px is `--text-secondary`. See the comment block in tokens.css.
- **Spine heights come from a hash of the work id and must stay deterministic.** Spine view virtualises by row; random heights make spines jump as rows recycle.
- **The axis track needs `touch-action: none`**, or the gesture becomes a scroll on a phone.
- **`SHELF_FILLER` in the logic class is prototype-only** sample data for spine view. Not real data.
- **Illustrations carry literal hex now**, not `var()`. The `--il-*` tokens in tokens.css are inert; leave or delete them.
- Layout validators may flag `67 ⟷ Settings` overlapping on home. False positive — the bottom nav is an overlay above a scrolling container, verified.

---

## 8 · Decisions the user made (never re-ask)
- Display serif **Fraunces**. Interface **IBM Plex Sans**, not Inter.
- Both themes equally — light is a real theme, not a dark afterthought.
- Density: between dense and airy.
- Illustration: their thirteen Storyset SVGs. `magic-tree-cuate` ships exactly as drawn, untouched by the harmonisation.
- Stop after every phase.
- File size is never a constraint.

Phase 7 additions: Stats is a ruled ledger with three pulled-out figures, not a dashboard (D-036). The genre bar is the only chart (D-037). The note editor is a sheet whose attach row expands inline (D-038). The FAB opens the editor on Notes (D-039). Surprise me deals a re-rollable card (D-040). The drawer's head is the wordmark alone (D-041). The bookplate name is required (D-042).

## 9 · Decisions you made where they skipped (defend or revisit, don't silently change)
Continue strip is one large book plus a two-up peek row (D-003). Series sections open below 8 (D-004). Genre colour is a curated map with a hash fallback (D-008). Caught up shares Reading's hue and is distinguished by a segmented track (D-009). Axis separator is a hairline rule (D-010). Width buckets are logarithmic (D-027). No chapter count falls to bucket 2 silently (D-028).

---

## 10 · Open questions to raise when relevant
`OPEN-QUESTIONS.md` has seven open. Q-003 is closed — the name is required (D-042). Two worth surfacing in Phase 8:
- **Q-001** — real cover images never arrived. Covers are dominant-colour blocks, which double as the genuine `coverSource: 'none'` state. Non-blocking.
- **Q-007** — chapters read and years tracked are on Stats but not in SCHEMA. They need Claude Code's confirmation before they are real numbers.

---

## 11 · Your first move
Say nothing about having read this. Open `Ex Libris.dc.html`, then either:
- ask the 2–4 questions Phase 8 genuinely needs answered first (the honest question is how far a prototype should go in faking latency and failure — a skeleton that never resolves is easy to judge wrongly), **or**
- state your plan for Phase 8 in three lines and build it.

The user prefers the questions.
