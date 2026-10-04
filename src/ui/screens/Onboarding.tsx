import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { displayS, resetButton } from '../styles';
import { prefersReducedMotion } from '../theme';
import { TOUR_SCRIM } from '../design-literals';
import { Illustration } from '../illustration';
import { requestPwaInstall, usePwaInstall } from '../../pwa/install';
import { m, useMotion } from '../motion';
import { MOTION } from '../design-literals';
import { useModalFocus } from '../modal-focus';

/**
 * First run. Ported from design/Ex Libris.dc.html.
 *
 * The welcome screen is the longest motion sequence in the app and the only
 * place a stagger is allowed: it runs exactly once in a reader's life, which is
 * the frequency band where expressive motion is welcome (MOTION §11). Reduced
 * motion drops the stagger entirely rather than shortening it.
 *
 * The six-step spotlight tour follows the required bookplate, points at the
 * real Home controls, and finishes on Settings' real install control. D-074
 * and D-079 require its live measurement; there is no detached tutorial
 * layout or hardcoded target geometry.
 */

export function Welcome({ onNext }: { onNext: () => void }) {
  const { reduced, settle } = useMotion();
  return (
    <main className="room-welcome exl-scroll">
      <m.div
        className="room-welcome-art"
        initial={reduced ? false : { opacity: 0, y: MOTION.distance }}
        animate={{ opacity: 1, y: 0 }}
        transition={settle}
      >
        <Illustration name="magic-tree-cuate" style={{ width: '100%', maxWidth: 300 }} />
      </m.div>
      <m.div
        className="room-welcome-copy"
        initial={reduced ? false : { opacity: 0, y: MOTION.disclosureDistance }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...settle, delay: reduced ? 0 : MOTION.stagger }}
      >
        <p className="room-eyebrow">A place for what you read</p>
        <h1>Ex Libris</h1>
        <p className="room-welcome-intro">
          A private reading room.
          <br />
          Entirely your own.
        </p>
        <p>Books, web novels and manhwa, together with the thoughts they leave behind.</p>
        <button className="room-primary" onClick={onNext}>
          Open the library <span aria-hidden="true">↗</span>
        </button>
        <small>No account. No signal needed. Your library stays on this device.</small>
      </m.div>
    </main>
  );
}

interface TourStep {
  target: 'search' | 'continue' | 'drawer' | 'everything' | 'fab' | 'install';
  radius: string;
  pad?: number;
  head: string;
  body: string;
}

interface TourRect {
  left: number;
  top: number;
  width: number;
  height: number;
  frameHeight: number;
}

const TOUR_STEPS: readonly TourStep[] = [
  {
    target: 'search',
    radius: 'var(--radius-pill)',
    pad: 6,
    head: 'Search only what you own',
    body: 'Titles, authors, your own notes, your own tags. It reads the library on this device and nothing else.',
  },
  {
    target: 'continue',
    radius: 'var(--radius-card)',
    head: 'Return to the exact work',
    body: 'The cover, reading state and real progress live together here. The whole record opens, so the route back into a book is never hidden in a tiny control.',
  },
  {
    target: 'drawer',
    radius: '10px',
    pad: 6,
    head: 'Your room, your settings',
    body: 'Settings, the optional catalogue, backups and Trash live here. Notes have their own tab at the bottom.',
  },
  {
    target: 'everything',
    radius: '10px',
    pad: 4,
    head: 'Everything, filtered',
    body: 'Every work you own in one list, however long it gets. Filter it by genre — any of the ones you pick, or only works carrying all of them.',
  },
  {
    target: 'fab',
    radius: 'var(--radius-sheet)',
    head: 'Add anything',
    body: 'By hand, or from the catalogue — downloaded once and searchable with no signal. The catalogue is optional; typing a title yourself works exactly the same.',
  },
  {
    target: 'install',
    radius: 'var(--radius-card)',
    pad: 6,
    head: 'Keep Ex Libris on this phone',
    body: 'Install it once and it opens from your home screen without browser controls. Your library still stays only on this device.',
  },
] as const;

const EMPTY_CONTINUE_STEP: Pick<TourStep, 'head' | 'body'> = {
  head: 'Begin with anything',
  body: 'Add a book, web novel or manhwa. Once you start reading, this space becomes a clear path back to where you left off.',
};

/**
 * D-074/D-079's measured tour, extended to the actual Settings install row.
 *
 * `rect` deliberately survives step changes. The old geometry stays painted
 * until the next target has been measured, so the scrim does not re-fade and
 * the spotlight has a real previous position to travel from (MOTION §12).
 */
export function SpotlightTour({
  onDone,
  onShowSettings,
}: {
  onDone: () => void;
  onShowSettings: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<TourRect | null>(null);
  const [cardHeight, setCardHeight] = useState(280);
  const layerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const focusedStep = useRef(-1);
  const returnFocus = useRef<HTMLElement | null>(null);
  const headingId = useId();
  const bodyId = useId();
  const step = TOUR_STEPS[stepIndex]!;
  const reduceMotion = prefersReducedMotion();
  const install = usePwaInstall();
  const visible = rect !== null;
  useModalFocus(layerRef, onDone, visible);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const observer = new ResizeObserver(() => setCardHeight(card.getBoundingClientRect().height));
    observer.observe(card);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    returnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => returnFocus.current?.focus();
  }, []);

  // Prevent wheel and keyboard scrolling while the tour is open. A target
  // below the fold is still moved under the scrim by measure() via scrollTop.
  useLayoutEffect(() => {
    const frame = layerRef.current?.parentElement;
    if (!frame) return;
    const scrollers = [...frame.querySelectorAll<HTMLElement>('.exl-scroll')];
    const before = scrollers.map((scroller) => scroller.style.overflowY);
    scrollers.forEach((scroller) => {
      scroller.style.overflowY = 'hidden';
    });
    return () => {
      scrollers.forEach((scroller, index) => {
        scroller.style.overflowY = before[index] ?? '';
      });
    };
  }, []);

  useLayoutEffect(() => {
    const layer = layerRef.current;
    const frame = layer?.parentElement;
    if (!frame) return;

    let target: HTMLElement | null = null;
    let frameObserver: ResizeObserver | null = null;
    let targetObserver: ResizeObserver | null = null;
    let retry: number | null = null;

    const measure = () => {
      target = frame.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!target) {
        retry = window.requestAnimationFrame(measure);
        return;
      }

      const scroller = target.closest<HTMLElement>('.exl-scroll');
      if (scroller && scroller.scrollHeight > scroller.clientHeight + 8) {
        const targetBeforeScroll = target.getBoundingClientRect();
        const scrollerRect = scroller.getBoundingClientRect();
        const offset =
          targetBeforeScroll.top -
          scrollerRect.top -
          (scrollerRect.height - targetBeforeScroll.height) / 2;
        if (Math.abs(offset) > 24) {
          const wanted = Math.max(
            0,
            Math.min(scroller.scrollHeight - scroller.clientHeight, scroller.scrollTop + offset),
          );
          if (Math.abs(wanted - scroller.scrollTop) > 2) scroller.scrollTop = wanted;
        }
      }

      const targetRect = target.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      const pad = step.pad ?? 8;
      const next: TourRect = {
        left: targetRect.left - frameRect.left - pad,
        top: targetRect.top - frameRect.top - pad,
        width: targetRect.width + pad * 2,
        height: targetRect.height + pad * 2,
        frameHeight: Math.min(frameRect.height, window.visualViewport?.height ?? frameRect.height),
      };
      setRect((current) =>
        current &&
        current.left === next.left &&
        current.top === next.top &&
        current.width === next.width &&
        current.height === next.height &&
        current.frameHeight === next.frameHeight
          ? current
          : next,
      );
    };

    measure();
    if (target) retry = window.requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    if (typeof ResizeObserver !== 'undefined') {
      frameObserver = new ResizeObserver(measure);
      frameObserver.observe(frame);
      if (target) {
        targetObserver = new ResizeObserver(measure);
        targetObserver.observe(target);
      }
    }

    return () => {
      if (retry !== null) window.cancelAnimationFrame(retry);
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      frameObserver?.disconnect();
      targetObserver?.disconnect();
    };
  }, [step]);

  useEffect(() => {
    if (!rect || focusedStep.current === stepIndex) return;
    focusedStep.current = stepIndex;
    nextRef.current?.focus({ preventScroll: true });
  }, [rect, stepIndex]);

  const finish = () => onDone();
  const next = () => {
    if (stepIndex === TOUR_STEPS.length - 1) {
      void requestPwaInstall().finally(finish);
      return;
    }
    const nextStep = TOUR_STEPS[stepIndex + 1];
    if (nextStep?.target === 'install') onShowSettings();
    setStepIndex((current) => current + 1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      finish();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = cardRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
    if (!controls?.length) return;
    const first = controls[0]!;
    const last = controls[controls.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // The rect half of the gate prevents a 0 × 0 ring at the frame origin before
  // the first live measurement. It is deliberately not cleared between steps.
  const target = visible
    ? layerRef.current?.parentElement?.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
    : null;
  let copy: Pick<TourStep, 'head' | 'body'> =
    step.target === 'continue' && target?.dataset.tourState === 'empty'
      ? EMPTY_CONTINUE_STEP
      : step;
  if (step.target === 'install' && install.installed) {
    copy = {
      head: 'Ex Libris is installed',
      body: 'The green tick in Settings confirms it. Open it from your home screen whenever you want your library.',
    };
  } else if (step.target === 'install' && !install.available) {
    copy = {
      head: 'Keep Ex Libris on this phone',
      body: install.isIos
        ? 'The next button will show the Safari steps. Your library still stays only on this device.'
        : 'The next button will open the installer when your browser supports it, or show the exact menu steps.',
    };
  }
  const cardBelow = rect ? rect.top < rect.frameHeight * 0.45 : true;
  // A large highlighted record and enlarged text must never push the escape
  // controls off-screen. Only the explanatory copy scrolls inside the card.
  const cardTop = rect
    ? Math.max(
        16,
        Math.min(
          cardBelow ? rect.top + rect.height + 16 : rect.top - cardHeight - 16,
          rect.frameHeight - cardHeight - 16,
        ),
      )
    : 16;

  return (
    <div
      ref={layerRef}
      role={visible ? 'dialog' : undefined}
      aria-modal={visible ? 'true' : undefined}
      aria-labelledby={visible ? headingId : undefined}
      aria-describedby={visible ? bodyId : undefined}
      aria-hidden={visible ? undefined : 'true'}
      onKeyDown={onKeyDown}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 'var(--z-overlay)' as unknown as number,
        pointerEvents: visible ? 'auto' : 'none',
        touchAction: 'pan-y',
        visibility: visible ? 'visible' : 'hidden',
        animation:
          visible && !reduceMotion
            ? 'exl-fade var(--duration-medium) var(--ease-fluid-out) both'
            : undefined,
      }}
    >
      {rect ? (
        <>
          <div
            data-tour-spotlight={step.target}
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              borderRadius: step.radius,
              boxShadow: `0 0 0 2px var(--accent), 0 0 0 9999px ${TOUR_SCRIM}`,
              pointerEvents: 'none',
              transition: reduceMotion
                ? 'none'
                : 'left var(--duration-fluid) var(--ease-fluid-out), top var(--duration-fluid) var(--ease-fluid-out), width var(--duration-fluid) var(--ease-fluid-out), height var(--duration-fluid) var(--ease-fluid-out)',
            }}
          />
          <div
            ref={cardRef}
            style={{
              position: 'absolute',
              left: 'var(--space-4)',
              right: 'var(--space-4)',
              top: cardTop,
              maxHeight: rect.frameHeight - 32,
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
              padding: 'var(--space-5)',
              borderRadius: 'var(--radius-card)',
              background: 'var(--surface-overlay)',
              border: 'var(--hairline-width) solid var(--hairline-strong)',
              boxShadow: 'var(--shadow-fab)',
              transition: reduceMotion
                ? 'none'
                : 'top var(--duration-fluid) var(--ease-fluid-out), bottom var(--duration-fluid) var(--ease-fluid-out)',
            }}
          >
            <div
              style={{ overflowY: 'auto', minHeight: 0, display: 'grid', gap: 'var(--space-3)' }}
            >
              <span style={{ fontSize: 'var(--size-caption)', color: 'var(--text-secondary)' }}>
                {stepIndex + 1} / {TOUR_STEPS.length}
              </span>
              <div id={headingId} style={displayS}>
                {copy.head}
              </div>
              <div
                id={bodyId}
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--size-body)',
                  lineHeight: 'var(--lh-body)',
                  color: 'var(--text-secondary)',
                  textWrap: 'pretty',
                }}
              >
                {copy.body}
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto minmax(0, 1fr)',
                alignItems: 'center',
                gap: 'var(--space-3)',
                marginTop: 4,
                flexShrink: 0,
              }}
            >
              <button
                onClick={finish}
                style={{
                  ...resetButton,
                  padding: 'var(--space-2) var(--space-3)',
                  margin: 'calc(var(--space-2) * -1) 0',
                  fontSize: 'var(--size-caption)',
                  color: 'var(--text-secondary)',
                }}
              >
                Skip
              </button>
              <button
                ref={nextRef}
                data-ripple
                data-active="accent"
                onClick={next}
                style={{
                  ...resetButton,
                  padding: 'var(--space-2) var(--space-3)',
                  minHeight: 'var(--touch-min)',
                  lineHeight: 'var(--lh-body)',
                  borderRadius: 'var(--radius-button)',
                  background: 'var(--accent)',
                  color: 'var(--on-accent)',
                  fontSize: 'var(--size-body)',
                  fontWeight: 500,
                }}
              >
                {stepIndex === TOUR_STEPS.length - 1
                  ? install.installed
                    ? 'Finish'
                    : install.available
                      ? 'Install Ex Libris'
                      : 'See install steps'
                  : 'Next'}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * The bookplate. The only time the app asks the reader for anything about
 * themselves, and afterwards it becomes the About screen unchanged.
 *
 * The name is required (D-042, closing Q-003): the button stays inert rather
 * than hidden, and the line under it says why. "Skip for now" is gone.
 */
export function Bookplate({
  initial = '',
  onDone,
  heading = 'Open the library',
}: {
  initial?: string;
  onDone: (name: string) => void;
  heading?: string;
}) {
  const [name, setName] = useState(initial);
  const ok = name.trim().length > 0;
  return (
    <main className="room-bookplate exl-scroll">
      <p className="room-eyebrow">This library belongs to</p>
      <Illustration name="magic-tree-cuate" style={{ width: 200, maxWidth: '60%' }} />
      <h1>
        A reader.
        <br />
        With a name.
      </h1>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (ok) onDone(name.trim());
        }}
      >
        <label htmlFor="bookplate-name">From the books of</label>
        <input
          id="bookplate-name"
          aria-label="Your name"
          placeholder="your name"
          autoComplete="given-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <p>
          {ok
            ? 'It goes on the bookplate, and nowhere else.'
            : 'The bookplate needs a name before the library opens.'}
        </p>
        <button className="room-primary" disabled={!ok}>
          {heading} <span aria-hidden="true">↗</span>
        </button>
      </form>
    </main>
  );
}
