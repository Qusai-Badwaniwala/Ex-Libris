import { describe, it, expect, beforeEach } from 'vitest';
import {
  nav,
  installHistory,
  __resetNav,
  guardOverlayDismiss,
  guardScreenDismiss,
} from '../../src/router/router';

/**
 * The back gesture. This is the one Phase 0 behaviour a person would notice
 * immediately on a phone and never notice in a desktop prototype, so it gets
 * the most direct test in the suite.
 *
 * jsdom implements pushState and popstate, but does not fire popstate on
 * history.back() synchronously, so each test drives popstate the way the
 * browser would after the entry is popped.
 */
function pressBack() {
  history.back();
  window.dispatchEvent(new PopStateEvent('popstate'));
}

beforeEach(() => {
  __resetNav();
  installHistory();
});

describe('back', () => {
  it('keeps an unsaved editor mounted until its dismissal guard permits leaving', () => {
    nav.push({ screen: 'notes' });
    nav.open({ kind: 'noteEditor' });
    let mayLeave = false;
    const release = guardOverlayDismiss('noteEditor', () => mayLeave);
    try {
      pressBack();
      expect(nav.state.overlays.at(-1)?.kind).toBe('noteEditor');
      expect(nav.state.screens.at(-1)?.screen).toBe('notes');
      mayLeave = true;
      pressBack();
      expect(nav.state.overlays).toHaveLength(0);
    } finally {
      release();
    }
  });

  it('closes the topmost sheet before touching the screen underneath', () => {
    nav.push({ screen: 'detail', id: 'w1' });
    nav.open({ kind: 'session' });
    expect(nav.state.overlays.map((o) => o.kind)).toEqual(['session']);

    pressBack();

    expect(nav.state.overlays).toHaveLength(0);
    // The screen must NOT have moved. This is the whole defect: a back gesture
    // that skips the open sheet and navigates away leaves the sheet's state
    // stranded and looks like the app losing your place.
    expect(nav.state.screens.at(-1)?.screen).toBe('detail');
  });

  it('unwinds stacked sheets one at a time', () => {
    nav.push({ screen: 'detail', id: 'w1' });
    nav.open({ kind: 'editWork' });
    nav.open({ kind: 'genreEditor' });

    pressBack();
    expect(nav.state.overlays.map((o) => o.kind)).toEqual(['editWork']);

    pressBack();
    expect(nav.state.overlays).toHaveLength(0);
    expect(nav.state.screens.at(-1)?.screen).toBe('detail');
  });

  it('walks back up the screen stack once nothing is open', () => {
    nav.push({ screen: 'format', format: 'novel' });
    nav.push({ screen: 'detail', id: 'w1' });

    pressBack();
    expect(nav.state.screens.at(-1)?.screen).toBe('format');

    pressBack();
    expect(nav.state.screens.at(-1)?.screen).toBe('home');
  });

  it('stops at home rather than emptying the stack', () => {
    // At the root the browser leaves the app. Our stack must still describe a
    // real screen, because React renders from it either way and an empty stack
    // paints nothing during the moment before the app closes.
    pressBack();
    pressBack();
    expect(nav.state.screens).toHaveLength(1);
    expect(nav.state.screens[0]?.screen).toBe('home');
  });
});

describe('lateral moves between tabs', () => {
  it('returns to the Collection entry when Library is selected again', () => {
    const collection = { screen: 'everything' as const };
    nav.push(collection);
    nav.tab('notes');
    nav.tab('home');
    expect(nav.state.screens.at(-1)).toBe(collection);
  });
  it('keeps a protected screen draft when switching destinations', () => {
    const axis = { screen: 'axis' as const, id: 'work' };
    nav.push(axis);
    const release = guardScreenDismiss(axis, () => false);
    try {
      nav.tab('notes');
      expect(nav.state.screens.at(-1)).toBe(axis);
      pressBack();
      expect(nav.state.screens.at(-1)).toBe(axis);
    } finally {
      release();
    }
  });
  it('replace rather than push, so back does not walk through every tab', () => {
    nav.replace({ screen: 'stats' });
    nav.replace({ screen: 'wishlist' });
    expect(nav.state.screens).toHaveLength(1);
    expect(nav.state.screens[0]?.screen).toBe('wishlist');
  });

  it('and a drill-down after a tab move is still one back away', () => {
    nav.replace({ screen: 'wishlist' });
    nav.push({ screen: 'detail', id: 'w2' });
    pressBack();
    expect(nav.state.screens.at(-1)?.screen).toBe('wishlist');
  });
});

describe('opening a screen', () => {
  it.each(['push', 'pushWithCover', 'replace', 'reset'] as const)(
    'resumes the exact guarded %s destination after a draft is discarded',
    (action) => {
      const draft = { screen: 'axis' as const, id: 'work' };
      const destination = { screen: 'detail' as const, id: 'selected-work' };
      nav.push(draft);
      let mayLeave = false;
      let resume: (() => void) | undefined;
      const release = guardScreenDismiss(draft, (next, replay) => {
        expect(next).toBe(destination);
        resume = replay;
        return mayLeave;
      });
      try {
        const before = history.length;
        if (action === 'pushWithCover')
          nav.pushWithCover(destination, document.createElement('div'));
        else nav[action](destination);
        expect(nav.state.screens.at(-1)).toBe(draft);
        expect(history.length).toBe(before);
        expect(resume).toBeTypeOf('function');
        mayLeave = true;
        resume!();
        expect(nav.state.screens.at(-1)).toBe(destination);
        expect(nav.state.screens).toHaveLength(
          action === 'reset' ? 1 : action === 'replace' ? 2 : 3,
        );
        expect(history.length).toBe(
          before + (action === 'push' || action === 'pushWithCover' ? 1 : 0),
        );
      } finally {
        release();
      }
    },
  );
  it('keeps guarded Back on the browser-history path instead of supplying a forward replay', () => {
    const draft = { screen: 'axis' as const, id: 'work' };
    nav.push(draft);
    const release = guardScreenDismiss(draft, (next, replay) => {
      expect(next?.screen).toBe('home');
      expect(replay).toBeUndefined();
      return false;
    });
    try {
      pressBack();
      expect(nav.state.screens.at(-1)).toBe(draft);
    } finally {
      release();
    }
  });
  it('commits pending native navigation once before a rapid second navigation', () => {
    const original = document.startViewTransition;
    let delayed: (() => void) | undefined;
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: (update: () => void) => {
        delayed = update;
        return {
          ready: Promise.resolve(),
          updateCallbackDone: Promise.resolve(),
          finished: new Promise(() => {}),
          skipTransition() {},
        };
      },
    });
    try {
      nav.pushWithCover({ screen: 'detail', id: 'first' }, document.createElement('div'));
      nav.push({ screen: 'detail', id: 'second' });
      delayed?.();
      expect(nav.state.screens.map((route) => route.id)).toEqual([undefined, 'first', 'second']);
    } finally {
      if (original)
        Object.defineProperty(document, 'startViewTransition', {
          configurable: true,
          value: original,
        });
      else Reflect.deleteProperty(document, 'startViewTransition');
    }
  });
  it('dismisses anything modal that belonged to the screen being left', () => {
    nav.open({ kind: 'drawer' });
    nav.push({ screen: 'notes' });
    expect(nav.state.overlays).toHaveLength(0);
  });

  it('gives only the tapped cover the shared name for the transition', async () => {
    const cover = document.createElement('button');
    const original = (
      document as Document & { startViewTransition?: (update: () => unknown) => unknown }
    ).startViewTransition;
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: (update: () => unknown) => {
        update();
        return {
          ready: Promise.resolve(),
          updateCallbackDone: Promise.resolve(),
          finished: Promise.resolve(),
        };
      },
    });

    try {
      nav.pushWithCover({ screen: 'detail', id: 'w1' }, cover);
      expect(nav.state.screens.at(-1)).toEqual({ screen: 'detail', id: 'w1' });
      expect(cover.style.viewTransitionName).toBe('work-cover');
      await Promise.resolve();
      await Promise.resolve();
      expect(cover.style.viewTransitionName).toBe('');
    } finally {
      if (original) {
        Object.defineProperty(document, 'startViewTransition', {
          configurable: true,
          value: original,
        });
      } else {
        Reflect.deleteProperty(document, 'startViewTransition');
      }
    }
  });
});

describe('replacing a sheet without racing history', () => {
  it('finishes the transition update synchronously instead of waiting on a suppressed frame', () => {
    let callbackResult: unknown;
    const original = (
      document as Document & { startViewTransition?: (update: () => unknown) => unknown }
    ).startViewTransition;
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: (update: () => unknown) => {
        callbackResult = update();
        return {
          ready: Promise.resolve(),
          updateCallbackDone: Promise.resolve(),
          finished: Promise.resolve(),
        };
      },
    });

    try {
      nav.open({ kind: 'fabMenu' });
      nav.swap({ kind: 'byHand' });
      expect(callbackResult).toBeUndefined();
      expect(nav.state.overlays.map((overlay) => overlay.kind)).toEqual(['byHand']);
    } finally {
      if (original) {
        Object.defineProperty(document, 'startViewTransition', {
          configurable: true,
          value: original,
        });
      } else {
        Reflect.deleteProperty(document, 'startViewTransition');
      }
    }
  });

  it('swaps one sheet for another and keeps a single history entry', () => {
    // The FAB menu becoming the add sheet. Spelled as close-then-open it is a
    // race that loses: close() rewinds history and popstate arrives on its own
    // schedule, so the queued open can land BEFORE the pop that then cancels
    // it. Nothing appears on screen.
    nav.open({ kind: 'fabMenu' });
    nav.swap({ kind: 'byHand' });
    expect(nav.state.overlays.map((o) => o.kind)).toEqual(['byHand']);

    // One layer, one entry: back returns to the screen, not to the menu.
    pressBack();
    expect(nav.state.overlays).toHaveLength(0);
    expect(nav.state.screens.at(-1)?.screen).toBe('home');
  });

  it('turns a sheet into a screen in one step', () => {
    nav.open({ kind: 'byHand' });
    nav.closeAndPush({ screen: 'detail', id: 'new' });
    expect(nav.state.overlays).toHaveLength(0);
    expect(nav.state.screens.at(-1)).toEqual({ screen: 'detail', id: 'new' });

    // And back from the new work returns to where you were, rather than
    // reopening the sheet that created it.
    pressBack();
    expect(nav.state.screens.at(-1)?.screen).toBe('home');
    expect(nav.state.overlays).toHaveLength(0);
  });

  it('protects a screen draft when its menu chooses another screen', () => {
    const draft = { screen: 'backup' as const };
    nav.push(draft);
    let resume: (() => void) | undefined;
    const release = guardScreenDismiss(draft, (_next, replay) => {
      resume = replay;
      return false;
    });
    nav.open({ kind: 'drawer' });
    const before = history.length;
    nav.closeAndPush({ screen: 'corpus' });
    expect(nav.state.screens.at(-1)).toBe(draft);
    expect(nav.state.overlays).toHaveLength(0);
    expect(resume).toBeTypeOf('function');
    resume?.();
    expect(nav.state.screens.at(-1)).toEqual({ screen: 'corpus' });
    expect(history.length).toBe(before);
    pressBack();
    expect(nav.state.screens.at(-1)).toBe(draft);
    release();
  });

  it('falls back to a plain push when nothing is open', () => {
    nav.closeAndPush({ screen: 'detail', id: 'x' });
    expect(nav.state.screens.at(-1)?.screen).toBe('detail');
    pressBack();
    expect(nav.state.screens.at(-1)?.screen).toBe('home');
  });
});

describe('swap with nothing to replace', () => {
  it('takes a history entry, so the sheet is still dismissible', () => {
    // Without the guard, [].slice(0, -1) is still [] — so the overlay appears
    // with NO history entry behind it: visible, and impossible to close with
    // the back gesture. Found because the Surprise card would not close.
    //
    // The assertion has to be on the entry itself. Asserting that back closes
    // it does NOT work here: this suite dispatches popstate by hand, so it
    // fires whether or not an entry was ever pushed, and the test passes either
    // way. That is exactly how the first version of this test was dead on
    // arrival.
    const before = history.length;
    nav.swap({ kind: 'surprise', id: 'w1' });
    expect(nav.state.overlays.map((o) => o.kind)).toEqual(['surprise']);
    expect(history.length).toBe(before + 1);
  });

  it('still reuses the entry when there IS something to replace', () => {
    nav.open({ kind: 'fabMenu' });
    const after = history.length;
    nav.swap({ kind: 'byHand' });
    expect(nav.state.overlays.map((o) => o.kind)).toEqual(['byHand']);
    expect(history.length).toBe(after);
  });
});
