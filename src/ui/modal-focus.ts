import { useLayoutEffect, useRef, type RefObject } from 'react';

const isolation = new WeakMap<HTMLElement, { count: number; original: boolean }>();
function isolate(element: HTMLElement) {
  const held = isolation.get(element) ?? { count: 0, original: element.inert };
  held.count++;
  isolation.set(element, held);
  element.inert = true;
  return () => {
    if (--held.count === 0) {
      element.inert = held.original;
      isolation.delete(element);
    }
  };
}

/** Shared trap and inert isolation, including asynchronous and nested content. */
export function useModalFocus(
  root: RefObject<HTMLElement | null>,
  onClose: () => void,
  active = true,
) {
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const element = root.current;
    if (!element || !active) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const isolated: Array<() => void> = [];
    const seen = new Set<HTMLElement>();
    const refreshIsolation = () => {
      for (
        let branch: HTMLElement | null = element;
        branch?.parentElement && branch.parentElement !== document.documentElement;
        branch = branch.parentElement
      ) {
        for (const sibling of Array.from(branch.parentElement.children)) {
          if (sibling !== branch && sibling instanceof HTMLElement && !seen.has(sibling)) {
            seen.add(sibling);
            isolated.push(isolate(sibling));
          }
        }
      }
    };
    refreshIsolation();
    const targets = () =>
      Array.from(
        element.querySelectorAll<HTMLElement>(
          'button:not([disabled]):not([data-dismiss-scrim]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]',
        ),
      ).filter((node) => !node.closest('[inert]') && node.getClientRects().length > 0);
    const focus = () => {
      if (element.closest('[inert]')) return;
      if (element.contains(document.activeElement)) return;
      const controls = targets();
      (
        controls.find((node) => node.matches('input, textarea, [role="slider"]')) ??
        controls[0] ??
        element
      ).focus({ preventScroll: true });
    };
    const frame = requestAnimationFrame(focus);
    const observer = new MutationObserver(() => {
      refreshIsolation();
      focus();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const onKey = (event: KeyboardEvent) => {
      if (element.closest('[inert]') || event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        close.current();
      }
      if (event.key !== 'Tab') return;
      const controls = targets(),
        first = controls[0],
        last = controls.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first || !element.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !element.contains(document.activeElement))
      ) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('keydown', onKey);
      for (const release of isolated.reverse()) release();
      if (previous?.isConnected && !previous.closest('[inert]'))
        previous.focus({ preventScroll: true });
    };
  }, [root, active]);
}
