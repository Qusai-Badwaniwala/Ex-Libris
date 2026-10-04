import { flushSync } from 'react-dom';

let active: ViewTransition | null = null;
let serial = 0;
let commitPending: (() => void) | undefined;
/** One native owner. Rapid input skips the visuals, consumes every promise and
 * still commits once. Never await a frame inside suppressed browser rendering. */
export function nativeTransition(
  kind: 'cover' | 'add' | 'theme',
  update: () => void,
  cleanup: () => void = () => {},
  closing = false,
) {
  cancelNativeTransition();
  const token = ++serial;
  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduced) {
    update();
    cleanup();
    return;
  }
  const html = document.documentElement;
  html.dataset['nativeTransition'] = kind;
  if (closing) html.dataset['closing'] = '';
  const done = () => {
    cleanup();
    if (serial !== token) return;
    active = null;
    delete html.dataset['nativeTransition'];
    delete html.dataset['closing'];
  };
  let committed = false;
  const commit = () => {
    if (committed) return;
    committed = true;
    flushSync(update);
  };
  commitPending = commit;
  try {
    const transition = document.startViewTransition(() => {
      commit();
      if (commitPending === commit) commitPending = undefined;
    });
    active = transition;
    void Promise.allSettled([
      transition.ready,
      transition.updateCallbackDone,
      transition.finished,
    ]).then(done);
  } catch {
    commit();
    if (commitPending === commit) commitPending = undefined;
    done();
  }
}
export function cancelNativeTransition() {
  // Skipping a pending snapshot must never discard the navigation it contains.
  const commit = commitPending;
  commitPending = undefined;
  commit?.();
  active?.skipTransition?.();
  active = null;
  serial++;
  delete document.documentElement.dataset['nativeTransition'];
  delete document.documentElement.dataset['closing'];
}
