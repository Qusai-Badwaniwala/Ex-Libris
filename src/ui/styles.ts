import type { CSSProperties } from 'react';

/**
 * The type and layout values the design uses repeatedly, as objects.
 *
 * Every number here is a token reference copied from design/Ex Libris.dc.html.
 * This file exists so those references live once rather than in forty
 * components — not to reorganise or improve them. If a value looks arbitrary,
 * it came from the prototype and design/DECISIONS.md explains it.
 */

/**
 * `all: unset` on a button also resets `box-sizing`, past the universal rule in
 * base.css. Any such button with a width and padding then measures wrong. This
 * cost the design session its one real layout bug (START-HERE §7), so the reset
 * always carries box-sizing back with it.
 */
export const resetButton: CSSProperties = {
  all: 'unset',
  boxSizing: 'border-box',
  cursor: 'pointer',
};

export const displayL: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 'var(--display-vf)' as unknown as number,
  fontSize: 'var(--size-display-l)',
  lineHeight: 'var(--lh-display-l)',
  letterSpacing: 'var(--tracking-display)',
};

export const displayM: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 'var(--display-vf)' as unknown as number,
  fontSize: 'var(--size-display-m)',
  lineHeight: 'var(--lh-display-m)',
};

export const displayS: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 'var(--display-vf-sm)' as unknown as number,
  fontSize: 'var(--size-display-s)',
  lineHeight: 'var(--lh-display-s)',
};

export const bodyL: CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--size-body-l)',
  lineHeight: 'var(--lh-body-l)',
};

export const body: CSSProperties = {
  fontSize: 'var(--size-body)',
  lineHeight: 'var(--lh-body)',
};

export const caption: CSSProperties = {
  fontSize: 'var(--size-caption)',
  lineHeight: 'var(--lh-caption)',
};

/**
 * 11px. tokens.css is explicit that everything under 18.66px sits on
 * --text-secondary and never on --text-muted or --text-faint (D-016), so the
 * colour is baked in here rather than left to each call site to remember.
 */
export const label: CSSProperties = {
  fontSize: 'var(--size-label)',
  lineHeight: 'var(--lh-label)',
  color: 'var(--text-secondary)',
};

export const tabular: CSSProperties = { fontVariantNumeric: 'tabular-nums' };

export const hairlineTop: CSSProperties = {
  borderTop: 'var(--hairline-width) solid var(--hairline)',
};

/** The full-bleed scroller every screen sits in, matching the prototype's
 *  `position: absolute; inset: 0` inside the phone frame. 104px of bottom
 *  padding clears the floating nav bar. */
export const screenScroll: CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflowY: 'auto',
  paddingBottom: '104px',
};

/** The primary action: accent fill, on-accent ink. */
export const primaryButton: CSSProperties = {
  ...resetButton,
  height: '48px',
  lineHeight: '48px',
  textAlign: 'center',
  borderRadius: 'var(--radius-button)',
  background: 'var(--accent)',
  color: 'var(--on-accent)',
  fontSize: 'var(--size-body)',
  fontWeight: 500,
};

export const quietButton: CSSProperties = {
  ...resetButton,
  height: '44px',
  lineHeight: '44px',
  textAlign: 'center',
  borderRadius: 'var(--radius-button)',
  border: 'var(--hairline-width) solid var(--hairline-strong)',
  color: 'var(--text-secondary)',
  fontSize: 'var(--size-body)',
};

/** Grade 2 of the three destructive grades: reversible, so it acts on one tap
 *  and the thirty-day trash is the confirmation (design D-081). */
export const dangerButton: CSSProperties = {
  ...resetButton,
  width: '100%',
  height: '44px',
  lineHeight: '44px',
  textAlign: 'center',
  borderRadius: 'var(--radius-button)',
  border: 'var(--hairline-width) solid var(--danger)',
  color: 'var(--danger)',
  fontSize: 'var(--size-body)',
};

/** Cover radius: --radius-button at 66px tall and below, --radius-card above.
 *  One radius at every size is a tell (COMPONENTS, Cover). */
export const coverRadius = (height: number) =>
  height <= 66 ? 'var(--radius-button)' : 'var(--radius-card)';
