# MOTION.md
Spring curves, durations, choreography, haptic points.
Claude Code cannot reverse-engineer timing from static files. This is the source.

## Durations
| Token | Value | Use |
|---|---|---|
| `--dur-fast` | 120ms | taps, toggles, ticks, chip selection |
| `--dur-base` | 180ms | sheets, expansion, FAB |
| `--dur-slow` | 240ms | screen transitions, cover flight |

Nothing exceeds 250ms.

## Curves
Three `linear()` springs in tokens.css. Never `ease-in-out`. One cubic-bezier, `--ease-exit`, for dismissals that should not spring back.

| Token | Character | Use |
|---|---|---|
| `--ease-snap` | fast attack, ~1.7% overshoot | taps, toggles, chips, axis stops |
| `--ease-spring` | ~6% overshoot, visible settle | FAB expansion, sheets |
| `--ease-settle` | ~0.5% overshoot, near-critical | cover flight, screen transitions |

A photograph that overshoots reads as wobble, not spring. That is why the cover gets the flattest curve and the FAB the bounciest.

## Choreography

### 1 · Cover flight — the signature moment
Tap a cover anywhere (Continue strip, format list, More like this) and that cover becomes the detail header.

```js
openWork(id) {
  const el = document.querySelector('[data-work="' + id + '"] [data-cover]');
  const go = () => new Promise(res => setState({ screen: 'detail', workId: id }, res));
  if (!document.startViewTransition || reducedMotion) { go(); return; }
  if (el) el.style.viewTransitionName = 'work-cover';
  const vt = document.startViewTransition(go);
  vt.finished.finally(() => { if (el) el.style.viewTransitionName = ''; });
}
```

- The detail header cover carries `view-transition-name: work-cover` permanently.
- The list cover gets the name **only for the duration of the flight**, then loses it. Two live elements may never share a name — that throws and kills the transition.
- The name goes on the cover element, not the row. `[data-cover]` marks it.
- Radius animates 8px → 12px across the flight because the two elements carry different radius tokens. That is intentional; it is the object growing, not a crossfade.

```css
::view-transition-group(work-cover) {
  animation-duration: var(--dur-slow);
  animation-timing-function: var(--ease-settle);
}
```

The reverse runs automatically on back, because the same two elements swap roles.

### 2 · FAB — expands, never navigates
Modelled on Google Keep. The button and the sheet share `view-transition-name: add-surface`, so the browser morphs a 56px rounded square into the sheet.

- The FAB is **unmounted** while the sheet is open. Two live elements cannot share a name.
- On close, the name must be reapplied to the FAB *inside the state-update callback* — before the browser takes its "after" snapshot — or the sheet has nothing to shrink into.
- Press state: `transform: scale(0.92)` over `--dur-fast` with `--ease-snap`. Transform only; never width or height.
- Where view transitions are unavailable, the sheet falls back to `translateY(100%) → 0` over `--dur-base` with `--ease-spring`.

```css
::view-transition-group(add-surface) {
  animation-duration: var(--dur-base);
  animation-timing-function: var(--ease-spring);
}
```

### 3 · Screen transitions
Everything that is not a cover flight uses the default root cross-fade at `--dur-slow` / `--ease-settle`. No slides. The app is a set of places, not a stack of cards.

### 4 · Section expand and collapse
Height is not animated — it triggers layout and drops frames on mid-range Android (§3.7). The chevron rotates 90° over `--dur-fast`; the content appears without animation. Honest and cheap.

### 5 · The axis scale
`pointerdown` on the track resolves to the nearest of five stops and the thumb animates there over `--dur-fast` with `--ease-snap`; dragging keeps resolving. `touch-action: none` on the track, or the browser claims the gesture for scrolling and the whole component dies on a phone.

The word does not animate. It is replaced. A crossfade or slide at 120ms reads as lag, and the tick already marks the change — the haptic is the transition.

### 6 · The finish moment
No entrance choreography. The screen is already there when it appears; the tick does not draw itself on. One haptic tick on the state change. Everything else on that screen is still.

### 7 · Spine view
Hover or press lifts a spine `translateY(-6px)` over `--dur-fast` with `--ease-snap`. That is the only affordance on the screen — no tilt, no shadow bloom, no neighbours shifting aside.

Tapping a spine runs the same cover flight as a list row (§1). The spine itself is the `[data-cover]` element, so a 26×170 bar flies out into a 116×174 cover. The aspect change is visible and correct: it is the same object seen from the front instead of the edge.

No entrance animation on the shelves. They virtualise by row, and rows that animate in on mount flicker during fast scroll.

### 6 · Three one-shot entrances — Phase 7
The drawer, the note editor and the Surprise me card all enter the same way, and all three are written imperatively for the same reason: nothing has to be declared in `<helmet>`, and the curve stays a token.

```js
animateIn(ref, from) {                   // from: the "before" transform
  const el = ref.current;
  if (!el || reduced) return;            // reduced motion: no entrance at all
  el.style.transition = 'none';
  el.style.transform = from;
  void el.offsetWidth;                   // force the reflow
  el.style.transition = 'transform var(--dur-base) var(--ease-spring)';
  el.style.transform = 'none';
}
```

| Surface | From | Curve |
|---|---|---|
| Note editor sheet | `translateY(100%)` | `--ease-spring`, `--dur-base` |
| Drawer | `translateX(-100%)` | `--ease-out`, `--dur-slow` |
| Surprise me card | `scale(0.96)` + opacity 0 | `--ease-out`, `--dur-base` |
| Every scrim | opacity 0 | `exl-fade`, `--ease-out`, 180ms (drawer 240ms) |
| Inline attach expansion | opacity 0, `translateY(6px)` | `exl-rise`, `--ease-out`, `--dur-base` |
| Boot splash, leaving | opacity 1 → 0 | `--ease-out`, `--dur-slow` |

The card scales rather than slides because it is dealt onto the list, not pushed in from an edge. It never travels more than a few pixels.

**Nothing pops.** `--ease-out` (`cubic-bezier(0.32, 0.72, 0, 1)`) is the workhorse for anything that opens routinely; the two spring curves are now only the FAB and the sheets it becomes. That split is deliberate: the standard band for mobile transitions is 200–300ms on a decelerating curve, and spring overshoot on ordinary motion reads as instability rather than personality. The brief's 250ms ceiling holds — `--dur-slow` at 240ms is the slowest thing in the app.

### 7 · Boot
The splash is the only place in the app where the user waits on purpose. Wordmark, then a 104px hairline that fills as each of the thirteen illustrations lands. Minimum 520ms — below that it flickers — then a 240ms fade to the first screen. Text alone paints in one frame; the SVGs do not, and a screen seen half-illustrated is worse than half a second of waiting.

The editor is the FAB's second expansion and shares `view-transition-name: add-surface` with the add sheet. The same two rules apply: the FAB is unmounted while the editor is open, and on close the name is reapplied inside the `setState` callback so the sheet has something to shrink into.

## Haptics
`navigator.vibrate(10)`. Android only; iOS PWAs have nothing. Exactly three places:

1. **Marking a work finished** — one tick, on the state change, not on the tap.
2. **Each stop the axis scale passes** — one tick per stop crossed, including on the way back. This is the one place the ticks accumulate into a texture.
3. **The FAB opening** — one tick, before the transition starts. This covers both expansions: the add sheet and the note editor.

Phase 7 added one more place and no others: **pinning a note** in the editor ticks on the state change, because it is a physical-feeling switch. Surprise me ticks on the roll — same category as the FAB: a moment, not a navigation.

Never on tab change, never on scroll, never on add, never on delete. A tick that fires often stops meaning anything.

## prefers-reduced-motion
Handled at the token level — all three durations collapse to `0ms` and all three easings to `linear` at the bottom of tokens.css, so components need no per-case work.

Two things need explicit handling in JS, because CSS cannot reach them:
- **View transitions are skipped entirely**, not shortened. A 0ms shared-element flight is a flash. Check `matchMedia('(prefers-reduced-motion: reduce)').matches` and call the state update directly.
- **Haptics still fire.** Reduced motion is about motion, not about touch feedback. Do not tie them together.

## What is deliberately not animated
No entrance animations on scroll. No hover transitions on cards. No ambient movement. No progress-bar fill animation on load — the bar is a fact, not an event. No page-load stagger. One orchestrated moment beats scattered effects.


---

## 8 · Exits (added 2026-09-01, audit M-01)
Every surface that animates in animates out, and faster than it came in: **120ms on `--ease-exit`**, scrim fading with it, unmount deferred to the end. `exitOut(ref, transform, scrim, done)` in the logic class is the single implementation — drawer, Surprise me card, FAB menu, add-by-hand sheet. The add sheet and the note editor exit by shrinking back into the FAB through their view transition, and the closing pass now runs on `--ease-exit` at `--dur-fast` via `html[data-closing]`, so a dismissal never springs back.

## 9 · What does not get a transition (audit M-02)
Lateral moves between the four bottom-nav tabs bypass `document.startViewTransition` entirely — `nav(next, { lateral: true })`. A 240ms cross-fade explains a drill-down; on the interaction performed most often in the app it is only a tax. Drill-downs keep it.

## 10 · Small fixes from the same audit
- Switch knobs travel: `transform: translateX(18px)`, `--dur-fast`, `--ease-snap`. Never `justify-content`, which cannot tween.
- The finish tick draws once: `stroke-dashoffset` 48 to 0, `--dur-slow`, `--ease-out`, 60ms delay. No bounce, no scale. The rarest screen in the app is the only one with a drawn entrance.
- Progress bars animate **only** when the user changed the value (`barMotion`), never on mount or load.
- Hover colour changes transition over `--dur-fast`. Colour only — never a hover scale.
- The axis word dips to 0.35 for 45ms and returns over 90ms. Opacity only.
- `--glass-blur` on the nav bar is unprofiled on real hardware. If frames drop during a fast scroll, drop `saturate()` first, then the blur radius, and keep the fill above 70%.


---

## 11 · Welcome (added 2026-09-02)
Five beats on `--ease-fluid-out`, 14px rise plus fade, staggered 120 / 260 / 440 / 620 / 760ms, with the button at 900ms. The constellation scales 1.06 → 1 over 1400ms behind all of it. This is the longest sequence in the app and the only place a stagger is allowed: it runs exactly once in a user's life, which is the frequency band where expressive motion is welcome.

## 12 · Tour spotlight
The hole moves rather than cutting: `left`/`top`/`width`/`height` transition over `--duration-fluid` on `--ease-fluid-out`, and the card's anchor transitions with it. The eye follows the light from one control to the next instead of relocating each time. Rect values are measured live per step, never hardcoded.

**This only works if the overlay stays mounted.** `isTour` gates on the step plus a measured rect, and the previous rect is never cleared on a step change — it stays rendered until the new measurement lands. Null it on a step change and the layer tears down: the scrim re-fades and a fresh element has no previous value to interpolate from, so the ring jumps. The rect half of the gate is load-bearing too — drop it and the first mount paints a 0×0 ring at the frame origin, because `tourL`/`tourT` fall back to `'0px'` before the first measurement lands.

When a target sits below the fold, its own `.exl-scroll` ancestor is moved so the target lands mid-frame — `scrollTop` set directly, **not** smoothly and never `scrollIntoView`. The scroll happens under the scrim where nobody can see it, so animating it buys nothing, and an in-flight smooth scroll needs a state flag that can outlive its step and freeze the ring on the previous control.


---

## 13 · Starting a transition
Never call `document.startViewTransition` directly. `this.vt(update, cleanup)` is the only entry point: it swallows `ready`, `updateCallbackDone` and `finished`, and runs `cleanup` on both the settled and the aborted path.
A transition rejects whenever it is **aborted** — whenever a second navigation begins before the first settles, which is ordinary fast tapping, not an edge case. All three promises reject together and the browser reports whichever has no handler, so a per-site handler will always leave one dangling. One function, six call sites, nothing to forget.
Note that `.finally()` is not a handler: it runs the cleanup and re-throws.
