import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import type { AxisKey } from '../axes/axes';

/**
 * Navigation, and the Android back gesture.
 *
 * The design package models every screen as a state flag on one component and
 * has no history at all. That works in a desktop prototype and is wrong the
 * moment the app is installed on a phone: the system back gesture would leave
 * the app instead of closing the open sheet. Nothing in the design is changed
 * by this file — the same screens appear in the same order — it only gives the
 * hardware gesture something correct to do.
 *
 * The rule, in one sentence: back closes the topmost sheet, then walks back up
 * the screen stack, then leaves the app.
 *
 * ponytail: back only, no forward. In `display: standalone` there is no forward
 * affordance, so a popped entry is never re-entered. If the app is ever used as
 * a normal browser tab, forward would need the popped layers kept in a redo
 * stack instead of discarded.
 */

export type Screen =
  | 'welcome'
  | 'bookplate'
  | 'home'
  | 'format'
  | 'everything'
  | 'spine'
  | 'detail'
  | 'series'
  | 'universe'
  | 'search'
  | 'wishlist'
  | 'stats'
  | 'notes'
  | 'settings'
  | 'backup'
  | 'corpus'
  | 'trash'
  | 'about'
  | 'tags'
  | 'tagpick'
  | 'axis'
  | 'finish'
  | 'share';

/**
 * Modal surfaces. Each one owns a history entry, which is what makes the back
 * gesture close it. They are listed rather than made generic so that an
 * unhandled kind is a type error, not a sheet that cannot be dismissed.
 */
export type OverlayKind =
  | 'drawer'
  | 'fabMenu'
  | 'catalogue'
  | 'byHand'
  | 'editWork'
  | 'noteEditor'
  | 'noteTags'
  | 'genreEditor'
  | 'genreFilter'
  | 'session'
  | 'surprise'
  | 'statusPicker'
  | 'seriesPicker'
  | 'readingOrderEditor'
  | 'coverPicker'
  | 'sortSheet';

export interface Route {
  screen: Screen;
  /** The work, series, universe or note the screen is about. */
  id?: string;
  /** Format screens only. */
  format?: 'book' | 'novel' | 'manhwa';
  /** Everything screen only: a genre selected from a search result. */
  genre?: import('../db/schema').GenreIndex;
  /** Detail only: offer relationship evidence immediately after a new add. */
  suggestRelationships?: boolean;
  /** Axis screen only: open directly at the word the reader selected. */
  axis?: AxisKey;
}

export interface Overlay {
  kind: OverlayKind;
  id?: string;
  contextType?: 'series' | 'universe';
  query?: string;
  /** Manual-add title carried from a share target or catalogue search. */
  initialTitle?: string;
  candidate?: import('../catalogue/types').CorpusMatch;
}

export interface NavState {
  screens: Route[];
  overlays: Overlay[];
}

type Listener = () => void;

const HOME: Route = { screen: 'home' };

let state: NavState = { screens: [HOME], overlays: [] };
const listeners = new Set<Listener>();

function emit(next: NavState) {
  state = next;
  for (const l of listeners) l();
}

const isAddSurface = (kind: OverlayKind | undefined) =>
  kind === 'catalogue' || kind === 'byHand' || kind === 'noteEditor';

/**
 * The FAB and its sheets are one shared surface in the approved motion model.
 * React's external-store update must commit inside the transition callback.
 * Waiting for `requestAnimationFrame` here deadlocks with the browser's render
 * suppression until Chromium's roughly four-second transition timeout expires.
 * `flushSync` gives the browser the new side immediately and does no extra work
 * outside this rare add-surface transition.
 */
function emitAddTransition(next: NavState, closing = false) {
  const start = (
    document as Document & {
      startViewTransition?: (update: () => void | Promise<void>) => {
        ready: Promise<void>;
        updateCallbackDone: Promise<void>;
        finished: Promise<void>;
      };
    }
  ).startViewTransition;
  const prefersReducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!start || prefersReducedMotion) {
    emit(next);
    return;
  }
  if (closing) document.documentElement.dataset['closing'] = '';
  const cleanup = () => {
    delete document.documentElement.dataset['closing'];
  };
  let updated = false;
  try {
    const transition = start.call(document, () => {
      updated = true;
      flushSync(() => emit(next));
    });
    // A rapid second navigation can skip a transition. All three promises may
    // reject in that normal path; allSettled consumes every outcome and keeps
    // cleanup single-sourced (design MOTION §13).
    void Promise.allSettled([
      transition.ready,
      transition.updateCallbackDone,
      transition.finished,
    ]).then(cleanup);
  } catch {
    // A browser may reject a second transition synchronously. The navigation
    // still has to happen once, without leaving the closing speed override on.
    cleanup();
    if (!updated) emit(next);
  }
}

function emitCoverTransition(next: NavState, cover: HTMLElement) {
  const start = (
    document as Document & {
      startViewTransition?: (update: () => void | Promise<void>) => {
        ready: Promise<void>;
        updateCallbackDone: Promise<void>;
        finished: Promise<void>;
      };
    }
  ).startViewTransition;
  const prefersReducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!start || prefersReducedMotion) {
    emit(next);
    return;
  }
  cover.style.viewTransitionName = 'work-cover';
  const cleanup = () => {
    cover.style.viewTransitionName = '';
  };
  let updated = false;
  try {
    const transition = start.call(document, () => {
      updated = true;
      flushSync(() => emit(next));
    });
    void Promise.allSettled([
      transition.ready,
      transition.updateCallbackDone,
      transition.finished,
    ]).then(cleanup);
  } catch {
    cleanup();
    if (!updated) emit(next);
  }
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const getSnapshot = () => state;

/** Depth of our own stack, so popstate knows what the browser just undid. */
function depth(s: NavState) {
  return s.screens.length + s.overlays.length;
}

function pushHistory() {
  history.pushState({ exl: depth(state) }, '');
}

export const nav = {
  /** Drill down. Adds a history entry, so back returns here. */
  push(route: Route) {
    pushHistory();
    emit({ screens: [...state.screens, route], overlays: [] });
  },

  /** The source cover owns the shared name only for this one navigation. */
  pushWithCover(route: Route, cover: HTMLElement) {
    pushHistory();
    emitCoverTransition({ screens: [...state.screens, route], overlays: [] }, cover);
  },

  /**
   * Lateral move between the four bottom-nav tabs. Replaces rather than pushes:
   * back from Stats should return to whatever you were doing, not walk you
   * through every tab you happened to touch. Matches D-057 / MOTION M-02,
   * which also skips the cross-fade on these.
   */
  replace(route: Route) {
    emit({ screens: [...state.screens.slice(0, -1), route], overlays: [] });
  },

  /** Clears the drill-down stack. Used by the drawer destinations (D-051). */
  reset(route: Route = HOME) {
    emit({ screens: [route], overlays: [] });
  },

  open(overlay: Overlay) {
    pushHistory();
    emit({ ...state, overlays: [...state.overlays, overlay] });
  },

  /**
   * Replaces the topmost sheet with another, reusing its history entry.
   *
   * This exists because the obvious spelling — close, then open — is a race
   * that loses. `close()` rewinds history, and popstate arrives on its own
   * schedule; a queued `open()` can land BEFORE that popstate, which then pops
   * the sheet that was just opened and leaves nothing on screen. It happened on
   * the FAB's two doors every time the tap was faster than a person's.
   *
   * One layer, one entry: the FAB menu and the sheet it becomes are the same
   * step, and back from either should return to the screen underneath rather
   * than to the menu.
   */
  swap(overlay: Overlay) {
    // Nothing to replace means this is an open, and it must take a history
    // entry like any other. Without this guard `[].slice(0, -1)` is still `[]`,
    // so the overlay appears with NO entry behind it — visible, and impossible
    // to dismiss with the back gesture. That is the exact defect this whole
    // module exists to prevent, reintroduced by a helper meant to prevent it.
    if (state.overlays.length === 0) {
      this.open(overlay);
      return;
    }
    const next = { ...state, overlays: [...state.overlays.slice(0, -1), overlay] };
    const current = state.overlays.at(-1)?.kind;
    if (isAddSurface(overlay.kind) && (current === 'fabMenu' || isAddSurface(current))) {
      emitAddTransition(next);
    } else {
      emit(next);
    }
  },

  /**
   * Dismisses the topmost sheet and drills into a screen in one move, reusing
   * the sheet's history entry. Same race, same fix: "added it, now show me it"
   * is one step, and back from the work should return to where you were, not
   * reopen the sheet that created it.
   */
  closeAndPush(route: Route) {
    if (state.overlays.length === 0) {
      this.push(route);
      return;
    }
    emit({ screens: [...state.screens, route], overlays: state.overlays.slice(0, -1) });
  },

  /** Programmatic dismissal — the button, not the gesture. */
  close() {
    if (state.overlays.length === 0) return;
    // Rewinding history fires popstate, which pops our stack. Doing both here
    // would close two layers for one tap.
    history.back();
  },

  /** The Back control in a screen header. Same path as the gesture. */
  back() {
    history.back();
  },

  get state() {
    return state;
  },
};

let uninstall: (() => void) | null = null;

/**
 * Wired once, from main.tsx. The browser has already moved by the time
 * popstate fires, so this only brings our stack back into agreement with it.
 *
 * Idempotent on purpose. A second listener means one back press unwinds two
 * layers — the sheet closes AND the screen changes — which is exactly what
 * React StrictMode's double-invoke and an HMR reload both cause in development.
 * Guarding here rather than at the call site is the fix that makes the bug
 * impossible instead of the one that remembers not to cause it.
 */
export function installHistory() {
  uninstall?.();
  history.replaceState({ exl: 1 }, '');
  const onPop = () => {
    if (state.overlays.length > 0) {
      const next = { ...state, overlays: state.overlays.slice(0, -1) };
      if (isAddSurface(state.overlays.at(-1)?.kind)) emitAddTransition(next, true);
      else emit(next);
      return;
    }
    if (state.screens.length > 1) {
      emit({ screens: state.screens.slice(0, -1), overlays: [] });
      return;
    }
    // At the root with nothing left to close: the browser leaves the app, which
    // is what a back gesture on a home screen should do. Nothing to undo.
  };
  window.addEventListener('popstate', onPop);
  uninstall = () => {
    window.removeEventListener('popstate', onPop);
    uninstall = null;
  };
  return uninstall;
}

export function useNav(): NavState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useRoute(): Route {
  const s = useNav();
  return s.screens[s.screens.length - 1] ?? HOME;
}

export function useTopOverlay(): Overlay | null {
  const s = useNav();
  return s.overlays[s.overlays.length - 1] ?? null;
}

/** Test seam. Never called by the app. */
export function __resetNav() {
  state = { screens: [HOME], overlays: [] };
}
