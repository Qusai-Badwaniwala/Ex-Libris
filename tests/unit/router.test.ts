import { describe, it, expect, beforeEach } from 'vitest';
import { nav, installHistory, __resetNav } from '../../src/router/router';

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
  it('dismisses anything modal that belonged to the screen being left', () => {
    nav.open({ kind: 'drawer' });
    nav.push({ screen: 'notes' });
    expect(nav.state.overlays).toHaveLength(0);
  });
});
