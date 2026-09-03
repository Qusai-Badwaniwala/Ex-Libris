import { useSyncExternalStore } from 'react';

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
  | 'genreEditor'
  | 'genreFilter'
  | 'session'
  | 'surprise'
  | 'statusPicker'
  | 'seriesPicker'
  | 'coverPicker'
  | 'sortSheet';

export interface Route {
  screen: Screen;
  /** The work, series, universe or note the screen is about. */
  id?: string;
  /** Format screens only. */
  format?: 'book' | 'novel' | 'manhwa';
}

export interface Overlay {
  kind: OverlayKind;
  id?: string;
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
      emit({ ...state, overlays: state.overlays.slice(0, -1) });
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
