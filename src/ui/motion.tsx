import { useLayoutEffect, useRef, type ReactNode, type RefObject, type CSSProperties } from 'react';
import {
  AnimatePresence,
  LazyMotion,
  MotionConfig,
  useIsPresent,
  useReducedMotion,
} from 'motion/react';
import { div, button, span, article } from 'motion/react-m';
import { MOTION } from './design-literals';
import { PresentationScope, scrollMemory } from '../router/presentation';
import type { Route } from '../router/router';

const m = { div, button, span, article };
export { AnimatePresence, m, useIsPresent };
const features = () => import('./motion-features').then((module) => module.default);
export function MotionRoot({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={features} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
export function useMotion() {
  const reduced = !!useReducedMotion();
  return {
    reduced,
    settle: { duration: reduced ? 0 : MOTION.base, ease: MOTION.ease },
    exit: { duration: reduced ? 0 : MOTION.fast, ease: MOTION.ease },
    spring: reduced
      ? { duration: 0 }
      : { type: 'spring' as const, duration: MOTION.surface, bounce: MOTION.bounce },
  };
}

/** Only the screen moves; chrome and native scroll containers remain stable. */
export function MotionPage({
  route,
  direction,
  children,
}: {
  route: Route;
  direction: 'forward' | 'back' | 'lateral' | 'native';
  children: ReactNode;
}) {
  const { reduced, settle, exit } = useMotion();
  const present = useIsPresent();
  const host = useRef<HTMLDivElement>(null);
  usePresentationRestoration(
    host,
    route,
    present && route.screen !== 'axis',
    route.screen !== 'search' && route.screen !== 'axis',
  );
  const native = direction === 'native' || route.screen === 'axis';
  return (
    <PresentationScope entry={route.flow ?? route}>
      <m.div
        ref={host}
        className="room-screen-layer"
        inert={!present || undefined}
        aria-hidden={!present || undefined}
        initial={
          reduced || native
            ? false
            : {
                opacity: 0,
                x:
                  direction === 'back'
                    ? -MOTION.distance
                    : direction === 'forward'
                      ? MOTION.distance
                      : 0,
                y: direction === 'lateral' ? MOTION.distance : 0,
              }
        }
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={native || reduced ? { opacity: 1 } : { opacity: 0 }}
        transition={present ? settle : exit}
      >
        {children}
      </m.div>
    </PresentationScope>
  );
}

export function usePresentationRestoration(
  host: RefObject<HTMLElement | null>,
  entry: object | undefined,
  present: boolean,
  focusHeading = false,
) {
  useLayoutEffect(() => {
    const element = host.current;
    if (!element || !entry || !present) return;
    const saved = scrollMemory.get(entry);
    let lastFocus =
      document.activeElement instanceof HTMLElement && element.contains(document.activeElement)
        ? document.activeElement
        : null;
    const rememberFocus = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement) lastFocus = event.target;
    };
    element.addEventListener('focusin', rememberFocus);
    let focused = false;
    const focus = () => {
      if (focused || element.closest('[inert]')) return;
      const target = saved?.focus
        ? element.querySelector<HTMLElement>(saved.focus)
        : focusHeading
          ? element.querySelector<HTMLElement>('h1')
          : null;
      if (!target || !target.getClientRects().length) return;
      if (target.tagName === 'H1') target.tabIndex = -1;
      target.focus({ preventScroll: true });
      focused = true;
    };
    const scrolls = () =>
      Array.from(element.querySelectorAll<HTMLElement>('.exl-scroll:not([data-scroll-owner])'));
    const restore = () => {
      focus();
      if (!saved) return;
      scrolls().forEach((node, index) => {
        node.scrollTop = saved.tops[index] ?? 0;
      });
    };
    restore();
    // Live-query loading can briefly render a shorter page. Restore once its
    // content arrives, and stop immediately when the reader takes control.
    const observer = new MutationObserver(restore);
    observer.observe(element, { childList: true, subtree: true });
    const stop = () => observer.disconnect();
    element.addEventListener('pointerdown', stop, { once: true });
    element.addEventListener('wheel', stop, { once: true });
    element.addEventListener('keydown', stop, { once: true });
    element.addEventListener('touchstart', stop, { once: true });
    const frame = requestAnimationFrame(focus);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      element.removeEventListener('pointerdown', stop);
      element.removeEventListener('wheel', stop);
      element.removeEventListener('keydown', stop);
      element.removeEventListener('touchstart', stop);
      element.removeEventListener('focusin', rememberFocus);
      const active =
        document.activeElement instanceof HTMLElement && element.contains(document.activeElement)
          ? document.activeElement
          : lastFocus;
      const owner = active?.closest<HTMLElement>('[data-work]');
      const label = active?.getAttribute('aria-label');
      scrollMemory.set(entry, {
        tops: scrolls().map((node) => node.scrollTop),
        focus: owner?.dataset['work']
          ? `[data-work="${CSS.escape(owner.dataset['work'])}"] button, button[data-work="${CSS.escape(owner.dataset['work'])}"]`
          : label
            ? `[aria-label="${CSS.escape(label)}"]`
            : undefined,
      });
    };
  }, [host, entry, present, focusHeading]);
}

/** Measured height only for an explicit disclosure, never for viewport/keyboard resize. */
export function Disclosure({
  open,
  children,
  id,
}: {
  open: boolean;
  children: ReactNode;
  id?: string;
}) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <DisclosureContent key="content" id={id}>
          {children}
        </DisclosureContent>
      )}
    </AnimatePresence>
  );
}
function DisclosureContent({ children, id }: { children: ReactNode; id?: string }) {
  const { reduced, settle, exit } = useMotion();
  const present = useIsPresent();
  return (
    <m.div
      id={id}
      inert={!present || undefined}
      aria-hidden={!present || undefined}
      initial={reduced ? false : { height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={present ? settle : exit}
      style={{ overflow: 'hidden' }}
    >
      <div className="room-disclosure-content">{children}</div>
    </m.div>
  );
}

/** Arrival is keyed to a deliberate selection/step, not a virtualised row mount. */
export function Arrive({
  children,
  className,
  style,
  motionKey,
  still = false,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  motionKey?: string | number;
  still?: boolean;
}) {
  const { reduced, settle } = useMotion();
  return (
    <m.div
      key={motionKey}
      className={className}
      style={style}
      initial={reduced ? false : { opacity: 0, y: still ? 0 : MOTION.disclosureDistance }}
      animate={{ opacity: 1, y: 0 }}
      transition={settle}
    >
      {children}
    </m.div>
  );
}
