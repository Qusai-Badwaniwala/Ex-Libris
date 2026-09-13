/**
 * One tick, and nothing more. Android only — iOS PWAs have no vibration API at
 * all, so this is a no-op there rather than a fallback.
 *
 * MOTION.md is strict about where it fires: marking a work finished, each stop
 * the axis scale passes, the FAB opening, pinning a note, and the Surprise me
 * roll. Never on tab change, never on scroll, never on add, never on delete. A
 * tick that fires often stops meaning anything.
 *
 * Reduced motion does NOT suppress it. Reduced motion is about motion, not
 * about touch feedback, and tying them together takes away a signal from
 * someone who asked for fewer moving things, not fewer things they can feel.
 */

let ms: number | null = null;

/** The duration lives in tokens.css as --haptic-tick, so it is read from there
 *  rather than repeated here. Read once: it cannot change at runtime. */
function tickMs(): number {
  if (ms !== null) return ms;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--haptic-tick');
  const parsed = Number.parseInt(raw.trim(), 10);
  ms = Number.isFinite(parsed) && parsed > 0 ? parsed : 12;
  return ms;
}

export function tick(): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    navigator.vibrate(tickMs());
  } catch {
    /* some browsers throw when the page is not visible; a missed tick is fine */
  }
}

/** A drag can cross several stops in one pointer event. One vibration pattern
 * preserves every tick; repeated synchronous vibrate calls would replace the
 * previous call on Android and collapse the gesture to a single pulse. */
export function tickStops(count: number): void {
  const pulses = Math.max(0, Math.floor(count));
  if (pulses <= 1) {
    if (pulses === 1) tick();
    return;
  }
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  const duration = tickMs();
  const pattern = Array.from({ length: pulses * 2 - 1 }, () => duration);
  try {
    navigator.vibrate(pattern);
  } catch {
    /* a missed gesture tick is fine when the page is no longer visible */
  }
}
