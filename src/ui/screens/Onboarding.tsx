import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Constellation } from '../constellation';
import { caption, displayL, displayS, label, resetButton } from '../styles';
import { prefersReducedMotion } from '../theme';
import { TOUR_SCRIM, WELCOME_ART_MS, WELCOME_BEATS } from '../design-literals';
import { Illustration } from '../illustration';
import { requestPwaInstall, usePwaInstall } from '../../pwa/install';

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

function beat(i: number) {
  if (prefersReducedMotion()) return undefined;
  return {
    animation: `exl-welcome var(--duration-fluid) var(--ease-fluid-out) ${WELCOME_BEATS[i]} both`,
  };
}

export function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          animation: prefersReducedMotion()
            ? undefined
            : `exl-art-in ${WELCOME_ART_MS} var(--ease-fluid-out) both`,
        }}
      >
        <Constellation />
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 'var(--space-7) var(--space-6)',
          gap: 'var(--space-3)',
        }}
      >
        <div style={{ ...label, ...beat(0) }}>Welcome to</div>
        <div style={{ ...displayL, fontSize: '52px', lineHeight: '56px', ...beat(1) }}>
          Ex Libris
        </div>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '19px',
            lineHeight: 'var(--lh-body-l)',
            color: 'var(--text-secondary)',
            textWrap: 'pretty',
            ...beat(2),
          }}
        >
          A private record of what you have read — books, web novels and manhwa, on one shelf.
        </div>
        <div
          style={{
            height: 'var(--hairline-width)',
            background: 'var(--hairline-strong)',
            transformOrigin: 'left',
            animation: prefersReducedMotion()
              ? undefined
              : `exl-rule var(--duration-fluid) var(--ease-fluid-out) ${WELCOME_BEATS[3]} both`,
            margin: 'var(--space-2) 0',
          }}
        />
        <div style={{ ...caption, color: 'var(--text-secondary)', ...beat(4) }}>
          It works with no signal, has no account, and nothing you write ever leaves this device.
        </div>
        <button
          data-active="accent"
          onClick={onNext}
          style={{
            ...resetButton,
            marginTop: 'var(--space-4)',
            height: 52,
            lineHeight: '52px',
            textAlign: 'center',
            borderRadius: 'var(--radius-button)',
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            fontSize: 'var(--size-body)',
            fontWeight: 500,
            ...beat(5),
          }}
        >
          Open the library
        </button>
      </div>
    </div>
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
    head: 'Notes, trash and backups',
    body: 'Notes live alongside the books they belong to. Nothing you delete is really gone for thirty days.',
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
        frameHeight: frameRect.height,
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
      frameObserver?.disconnect();
      targetObserver?.disconnect();
    };
  }, [step]);

  useEffect(() => {
    if (!rect || focusedStep.current === stepIndex) return;
    focusedStep.current = stepIndex;
    nextRef.current?.focus();
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
  const visible = rect !== null;
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
        touchAction: 'none',
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
              top: cardBelow ? rect.top + rect.height + 16 : 'auto',
              bottom: cardBelow ? 'auto' : rect.frameHeight - rect.top + 16,
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
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                marginTop: 4,
              }}
            >
              <div aria-hidden="true" style={{ display: 'flex', gap: 6 }}>
                {TOUR_STEPS.map((tourStep, index) => (
                  <span
                    key={tourStep.target}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 'var(--radius-pill)',
                      background: index === stepIndex ? 'var(--accent)' : 'var(--hairline-strong)',
                    }}
                  />
                ))}
              </div>
              <span className="exl-sr">
                Step {stepIndex + 1} of {TOUR_STEPS.length}
              </span>
              <span style={{ flex: 1 }} />
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
                  padding: '0 22px',
                  height: 'var(--touch-min)',
                  lineHeight: 'var(--touch-min)',
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
    <div
      className="exl-scroll"
      style={{
        position: 'absolute',
        inset: 0,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'calc(var(--space-6) + var(--safe-top)) var(--space-5) var(--space-6)',
        gap: 'var(--space-5)',
      }}
    >
      <div style={{ position: 'relative', width: '100%', maxWidth: 320, aspectRatio: '300 / 420' }}>
        {/* The engraved frame: three nested rules, a corner diamond on each
            side, four tick marks where the band rules meet the frame. */}
        <svg
          viewBox="0 0 300 420"
          fill="none"
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          <rect
            x="6"
            y="6"
            width="288"
            height="408"
            rx="3"
            stroke="var(--text-faint)"
            strokeWidth="1"
          />
          <rect
            x="16"
            y="16"
            width="268"
            height="388"
            rx="2"
            stroke="var(--accent)"
            strokeWidth="0.75"
          />
          <rect
            x="21"
            y="21"
            width="258"
            height="378"
            rx="2"
            stroke="var(--accent)"
            strokeWidth="0.75"
          />
          <path d="M21 104 L279 104 M21 300 L279 300" stroke="var(--accent)" strokeWidth="0.75" />
          <path d="M150 8 L156 16 L150 24 L144 16 Z" fill="var(--accent)" />
          <path d="M150 396 L156 404 L150 412 L144 404 Z" fill="var(--accent)" />
          <path d="M8 210 L16 204 L24 210 L16 216 Z" fill="var(--accent)" />
          <path d="M292 210 L284 204 L276 210 L284 216 Z" fill="var(--accent)" />
          <path
            d="M46 104 L46 96 M254 104 L254 96 M46 300 L46 308 M254 300 L254 308"
            stroke="var(--accent)"
            strokeWidth="0.75"
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            left: '10%',
            right: '10%',
            top: '4%',
            height: '20%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ ...displayL, fontWeight: 400 }}>Ex Libris</div>
        </div>
        <div
          style={{
            position: 'absolute',
            left: '16%',
            right: '16%',
            top: '27%',
            height: '41%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Illustration name="magic-tree-cuate" style={{ maxWidth: '100%', maxHeight: '100%' }} />
        </div>
        <div
          style={{
            position: 'absolute',
            left: '12%',
            right: '12%',
            top: '75%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <div style={label}>From the books of</div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="your name"
            aria-label="Your name"
            data-focus="accent"
            style={{
              width: '100%',
              height: 40,
              textAlign: 'center',
              background: 'transparent',
              border: 'none',
              borderBottom: 'var(--hairline-width) solid var(--hairline-strong)',
              color: 'var(--text-primary)',
              ...displayS,
              outline: 'none',
            }}
          />
        </div>
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: 320,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}
      >
        <button
          data-active="accent"
          onClick={() => ok && onDone(name.trim())}
          style={{
            ...resetButton,
            width: '100%',
            textAlign: 'center',
            height: 52,
            lineHeight: '52px',
            borderRadius: 'var(--radius-button)',
            background: ok ? 'var(--accent)' : 'var(--surface-raised)',
            color: ok ? 'var(--on-accent)' : 'var(--text-secondary)',
            cursor: ok ? 'pointer' : 'default',
            fontSize: 'var(--size-body)',
            fontWeight: 500,
          }}
        >
          {heading}
        </button>
        <div
          style={{
            ...caption,
            color: 'var(--text-secondary)',
            textAlign: 'center',
            padding: '6px 12px',
          }}
        >
          {ok
            ? 'It goes on the bookplate, and nowhere else.'
            : 'The bookplate needs a name before the library opens.'}
        </div>
      </div>
    </div>
  );
}
