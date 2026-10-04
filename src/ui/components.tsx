import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { GENRE_NAMES, isWarningOnly } from '../data/taxonomy';
import type { GenreIndex } from '../db/schema';
import { caption, coverRadius, displayS, label, resetButton, tabular } from './styles';
import { coverService } from '../covers';
import { Illustration, type IllustrationName } from './illustration';
import { m, useIsPresent, useMotion, usePresentationRestoration } from './motion';
import { useModalFocus } from './modal-focus';
import { MOTION, SCRIM } from './design-literals';

/* ── Cover ──────────────────────────────────────────────────────────────── */

/**
 * The most reused element in the app, and the one the signature transition runs
 * on. There is no image element until a cover exists — the fill IS the fallback
 * (COMPONENTS, Cover). No cover is the normal state, not an error: never a
 * broken-image glyph, never a placeholder icon, never the word "cover".
 */
export function Cover({
  color,
  ink,
  path,
  width,
  height,
  title,
  flightName,
}: {
  color: string;
  ink?: string;
  /** OPFS path for a validated, downscaled cover. Remote URLs never render directly. */
  path?: string;
  width: number;
  height: number;
  /** Only drawn at 132×198 and above, per COMPONENTS. */
  title?: string;
  /** Set for the duration of the shared-element flight, and only then. */
  flightName?: string;
}) {
  const showTitle = !!title && width >= 100;
  const present = useIsPresent();
  const [imageUrl, setImageUrl] = useState<string>();

  useEffect(() => {
    let currentUrl: string | undefined;
    let cancelled = false;
    setImageUrl(undefined);
    if (!path) return;
    void coverService
      .read({ coverPath: path })
      .then(async (blob) => {
        if (!blob || cancelled) return;
        currentUrl = URL.createObjectURL(blob);
        const image = new Image();
        image.src = currentUrl;
        await image.decode();
        if (!cancelled) setImageUrl(currentUrl);
      })
      .catch(() => {
        // The colour fallback remains a complete cover when OPFS is unavailable.
      });
    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [path]);

  return (
    <div
      data-cover
      data-cover-placeholder={!imageUrl || undefined}
      style={{
        width,
        height,
        flex: 'none',
        borderRadius: coverRadius(height),
        boxShadow: 'var(--cover-inset)',
        background: color,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'flex-end',
        padding: showTitle && !imageUrl ? 'var(--space-3)' : 0,
        ...(flightName && present ? { viewTransitionName: flightName } : {}),
      }}
    >
      {imageUrl ? (
        <img
          className="room-cover-image"
          src={imageUrl}
          alt=""
          decoding="async"
          onError={() => setImageUrl(undefined)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : showTitle ? (
        <span
          aria-hidden="true"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 'var(--display-vf-sm)' as unknown as number,
            fontSize: 'var(--size-body)',
            lineHeight: '20px',
            color: ink ?? 'var(--text-primary)',
            minWidth: 0,
            overflowWrap: 'anywhere',
          }}
        >
          {title}
        </span>
      ) : null}
    </div>
  );
}

/* ── ProgressBar ────────────────────────────────────────────────────────── */

/**
 * 3px track. The bar is a fact, not an event: it does not animate in, and it
 * animates only when the reader has just changed the value (audit M-06).
 */
/**
 * The three-spine registration mark shared by Home and each format shelf.
 * It is structural identity, so it never disappears with the last work. Real
 * cover colours replace the neutral fallback from left to right when present.
 */
export function ShelfMarker({
  colors = [],
  compact = false,
}: {
  colors?: string[];
  compact?: boolean;
}) {
  const fallback = [
    'var(--cover-fallback)',
    'color-mix(in oklab, var(--cover-fallback), var(--text-secondary) 16%)',
    'color-mix(in oklab, var(--cover-fallback), var(--text-primary) 24%)',
  ];
  const heights = compact ? [32, 36, 29] : [46, 52, 41];

  return (
    <span
      data-shelf-marker
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'flex-end',
        gap: compact ? 3 : 4,
        width: compact ? 40 : 52,
        height: compact ? 38 : 54,
        flex: 'none',
      }}
    >
      {fallback.map((neutral, index) => (
        <span
          key={index}
          style={{
            width: compact ? 6 : 8,
            height: heights[index],
            borderRadius: 'var(--cover-radius) var(--cover-radius) 1px 1px',
            background: colors[index] ?? neutral,
            boxShadow: 'var(--cover-inset)',
          }}
        />
      ))}
    </span>
  );
}

export function ProgressBar({
  width,
  track,
  fill,
  animate = false,
}: {
  width: string;
  track: string;
  fill: string;
  animate?: boolean;
}) {
  return (
    <div style={{ height: 3, borderRadius: 999, overflow: 'hidden', background: track }}>
      <div
        style={{
          height: '100%',
          borderRadius: 999,
          width,
          background: fill,
          transition: animate ? 'width var(--dur-base) var(--ease-out)' : 'none',
        }}
      />
    </div>
  );
}

/* ── Genre chips and tag pills ──────────────────────────────────────────── */

/**
 * A work carries at most two genres and which one is primary is legible without
 * a label: the primary takes 170% of the fill alpha, 130% of the border and
 * weight 500 (D-096).
 *
 * The label mixes toward `--genre-ink` by `--genre-ink-amt`, which is 0% in
 * dark and 46% in light. The twelve hues were chosen against a dark page; as a
 * label on a light chip every one of them measures under 4.5:1 (D-019). Never
 * hardcode that percentage — the whole point is that it differs by theme.
 */
function genreStyle(index: GenreIndex, primary: boolean) {
  const hue = `var(--genre-${index})`;
  const f = primary ? '170' : '100';
  const b = primary ? '130' : '60';
  return {
    hue,
    fill: `color-mix(in oklab, ${hue} calc(var(--genre-fill-alpha) * ${f}%), transparent)`,
    border: `color-mix(in oklab, ${hue} calc(var(--genre-border-alpha) * ${b}%), transparent)`,
    ink: `color-mix(in oklab, ${hue}, var(--genre-ink) var(--genre-ink-amt))`,
    weight: primary ? 500 : 400,
  };
}

/** The dense form, for a list row. No border, no sliver — at row density a
 *  bordered chip reads as a button. */
export function GenreChipsCompact({ genres }: { genres: GenreIndex[] }) {
  if (genres.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
      {genres.map((g, i) => {
        const s = genreStyle(g, i === 0);
        return (
          <span
            key={g}
            style={{
              ...label,
              padding: '2px 6px',
              borderRadius: 'var(--radius-chip)',
              whiteSpace: 'nowrap',
              fontWeight: s.weight,
              color: s.ink,
              background: s.fill,
            }}
          >
            {GENRE_NAMES[g]}
          </span>
        );
      })}
    </div>
  );
}

/** The detail form: 13px, a colour sliver, a visible border. */
export function GenreChips({ genres }: { genres: GenreIndex[] }) {
  return (
    <>
      {genres.map((g, i) => {
        const s = genreStyle(g, i === 0);
        return (
          <span
            key={g}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              ...caption,
              fontWeight: s.weight,
              padding: '6px 12px',
              borderRadius: 'var(--radius-chip)',
              whiteSpace: 'nowrap',
              color: s.ink,
              background: s.fill,
              border: `var(--hairline-width) solid ${s.border}`,
            }}
          >
            <span style={{ width: 7, height: 11, borderRadius: 1, background: s.hue }} />
            {GENRE_NAMES[g]}
          </span>
        );
      })}
    </>
  );
}

/**
 * Deliberately lighter than a genre chip in every dimension: 11px, transparent,
 * hairline border, pill radius. Genres are few and meaningful; tags are many
 * and supporting (D-096).
 *
 * The content-warning treatment is a `--danger` wash, which reads as a
 * different class of object before the word is read — which is the actual
 * requirement (D-100).
 */
export function TagPill({ name }: { name: string }) {
  const cw = isWarningOnly(name);
  return (
    <span
      style={{
        ...label,
        padding: '3px 8px',
        borderRadius: 'var(--radius-pill)',
        whiteSpace: 'nowrap',
        color: cw ? 'var(--danger-text)' : 'var(--text-secondary)',
        background: cw ? 'color-mix(in oklab, var(--danger) 16%, transparent)' : 'transparent',
        border: `var(--hairline-width) solid ${
          cw ? 'color-mix(in oklab, var(--danger) 55%, transparent)' : 'var(--hairline-strong)'
        }`,
      }}
    >
      {name}
    </span>
  );
}

/* ── Sheet ──────────────────────────────────────────────────────────────── */

/**
 * The bottom sheet every modal surface in the app uses.
 *
 * It rises on `--ease-spring` and leaves faster than it came, 120ms on
 * `--ease-exit` (MOTION §8) — the reader has already decided, so the exit gets
 * out of the way. Reduced motion skips both entirely rather than shortening
 * them: a 0ms slide is a flash.
 *
 * Dismissal goes through `onClose`, which the caller routes to history so the
 * Android back gesture and the scrim do the same thing.
 */
export function Sheet({
  children,
  onClose,
  title,
  maxHeight = '92%',
  transitionName,
  footer,
  memoryEntry,
}: {
  children: ReactNode;
  onClose: () => void;
  title?: string;
  maxHeight?: string;
  transitionName?: 'add-surface';
  footer?: ReactNode;
  memoryEntry?: object;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const present = useIsPresent();
  const { reduced, spring, exit } = useMotion();
  const native = useRef(
    !!transitionName && document.documentElement.dataset['nativeTransition'] === 'add',
  );
  useModalFocus(root, onClose, present);
  usePresentationRestoration(root, memoryEntry, present);
  return (
    <div
      ref={root}
      inert={!present || undefined}
      aria-hidden={!present || undefined}
      tabIndex={-1}
      style={{ position: 'absolute', inset: 0, zIndex: 60 }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="room-sheet"
    >
      <m.button
        onClick={onClose}
        aria-label="Close"
        data-dismiss-scrim
        data-no-press
        style={{
          ...resetButton,
          position: 'absolute',
          inset: 0,
          background: SCRIM,
        }}
        initial={reduced || native.current ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={present ? spring : exit}
      />
      <m.div
        ref={panel}
        layoutRoot
        initial={
          reduced || native.current
            ? false
            : { opacity: 0, y: MOTION.sheetDistance, scale: MOTION.depthScale }
        }
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={
          native.current || reduced
            ? { opacity: 0, transition: { duration: 0 } }
            : { opacity: 0, y: MOTION.sheetDistance / 2, scale: MOTION.depthScale }
        }
        transition={present ? spring : exit}
        className="room-sheet-panel"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface-overlay)',
          borderRadius: 'var(--radius-sheet) var(--radius-sheet) 0 0',
          boxShadow: 'var(--shadow-sheet)',
          overflow: 'hidden',
          ...(transitionName && present ? { viewTransitionName: transitionName } : {}),
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
          <div
            style={{
              width: 32,
              height: 4,
              borderRadius: 999,
              background: 'var(--hairline-strong)',
            }}
          />
        </div>
        <div
          className="exl-scroll room-sheet-content"
          style={{
            overflowY: 'auto',
            padding: '8px var(--space-4) calc(var(--space-5) + var(--safe-bottom))',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-5)',
          }}
        >
          {children}
        </div>
        {footer && <div className="room-sheet-footer">{footer}</div>}
      </m.div>
    </div>
  );
}

/* ── Segmented control ──────────────────────────────────────────────────── */

/** Selection needs a visible mark as well as colour, including in dark mode. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  const selectionId = useId();
  const { spring } = useMotion();
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        border: 'var(--hairline-width) solid var(--hairline)',
        borderRadius: 'var(--radius-button)',
        overflow: 'hidden',
      }}
    >
      {options.map((o, index) => {
        const on = o.value === value;
        return (
          <button
            className="room-segment"
            key={o.value}
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(event) => {
              const offset =
                event.key === 'ArrowRight' || event.key === 'ArrowDown'
                  ? 1
                  : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                    ? -1
                    : 0;
              const next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? options.length - 1
                    : offset
                      ? (index + offset + options.length) % options.length
                      : -1;
              if (next < 0) return;
              event.preventDefault();
              onChange(options[next]!.value);
              const controls =
                event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                  '[role="radio"]',
                );
              controls?.[next]?.focus();
            }}
            style={{
              ...resetButton,
              position: 'relative',
              isolation: 'isolate',
              flex: 1,
              minWidth: 0,
              minHeight: 'var(--touch-min)',
              padding: 'var(--space-2) var(--space-1)',
              textAlign: 'center',
              ...caption,
              lineHeight: 'var(--lh-body)',
              background: on ? 'var(--accent)' : 'transparent',
              color: on ? 'var(--on-accent)' : 'var(--text-secondary)',
            }}
          >
            {on && (
              <m.span
                className="room-selection"
                layoutId={selectionId}
                transition={spring}
                aria-hidden="true"
              />
            )}
            {on && (
              <span aria-hidden="true" data-selection-mark>
                ✓{' '}
              </span>
            )}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Field ──────────────────────────────────────────────────────────────── */

/** The labelled input from the add-by-hand sheet, reused by the edit sheet so
 *  the two feel like one form rather than two. */
export function Field({
  label: text,
  value,
  onChange,
  placeholder,
  display,
  inputMode,
  note,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Titles are set in the display face, as the prototype does. */
  display?: boolean;
  inputMode?: 'text' | 'numeric';
  note?: string;
}) {
  // A <label> with no htmlFor names nothing: the association is what makes a
  // screen reader read "Title, edit text" instead of "edit text", and what lets
  // a tap on the word focus the field. Found by an end-to-end test that could
  // not find the input by its label either.
  const id = useId();
  const noteId = note ? `${id}-note` : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <label htmlFor={id} style={label}>
        {text}
      </label>
      <input
        id={id}
        type="text"
        inputMode={inputMode ?? 'text'}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={noteId}
        data-focus="accent"
        style={{
          height: 44,
          background: 'var(--surface-sunken)',
          border: 'none',
          borderBottom: 'var(--hairline-width) solid var(--hairline-strong)',
          borderRadius: 'var(--radius-button) var(--radius-button) 0 0',
          padding: '0 14px',
          color: 'var(--text-primary)',
          fontFamily: display ? 'var(--font-display)' : 'var(--font-ui)',
          fontWeight: display ? ('var(--display-vf-sm)' as unknown as number) : 400,
          fontSize: display ? 'var(--size-body-l)' : 'var(--size-body)',
          outline: 'none',
          minWidth: 0,
          width: '100%',
        }}
      />
      {note ? (
        <span id={noteId} style={{ ...label, paddingTop: 2 }}>
          {note}
        </span>
      ) : null}
    </div>
  );
}

/* ── Ledger row ─────────────────────────────────────────────────────────── */

/** Label left, value right, hairline between. No card, no shadow, no icon per
 *  row (COMPONENTS, LedgerRow). A figure that does not exist yet renders as an
 *  em dash, never as 0. */
export function LedgerRow({
  label: text,
  value,
  onClick,
  chevron,
}: {
  label: string;
  value?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
}) {
  const inner = (
    <>
      <span style={{ flex: 1, fontSize: 'var(--size-body)', lineHeight: 'var(--lh-body)' }}>
        {text}
      </span>
      <span style={{ ...caption, ...tabular, color: 'var(--text-secondary)' }}>{value ?? '—'}</span>
      {chevron ? <ChevronSpacer /> : null}
    </>
  );
  const style: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    minHeight: 44,
    padding: '13px 0',
    ...hairline,
  };
  return onClick ? (
    <button
      {...{ 'data-hover': 'raised' }}
      onClick={onClick}
      style={{ ...resetButton, width: '100%', ...style }}
    >
      {inner}
    </button>
  ) : (
    <div style={style}>{inner}</div>
  );
}

const hairline: CSSProperties = { borderTop: 'var(--hairline-width) solid var(--hairline)' };

function ChevronSpacer() {
  return (
    <svg
      width={7}
      height={12}
      viewBox="0 0 7 12"
      fill="none"
      stroke="var(--text-muted)"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 1l5 5-5 5" />
    </svg>
  );
}

/* ── Empty state ────────────────────────────────────────────────────────── */

/** Headline names the space, one line explains the rule of the space, the CTA
 *  is a verb. Never "Nothing here yet", never an apology (D-026). */
export function EmptyState({
  art,
  artWidth,
  head,
  body: text,
  cta,
  onCta,
}: {
  art?: IllustrationName;
  artWidth?: string;
  head: string;
  body: string;
  cta?: string;
  onCta?: () => void;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-5)',
        textAlign: 'center',
        paddingBottom: 'var(--space-7)',
      }}
    >
      {art ? (
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Illustration name={art} style={{ width: artWidth ?? '78%' }} />
        </div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div
          style={{
            ...displayS,
            fontSize: 'var(--size-display-m)',
            lineHeight: 'var(--lh-display-m)',
          }}
        >
          {head}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--size-body-l)',
            lineHeight: 'var(--lh-body-l)',
            color: 'var(--text-secondary)',
            maxWidth: '30ch',
            margin: '0 auto',
            textWrap: 'pretty',
          }}
        >
          {text}
        </div>
      </div>
      {cta && onCta ? (
        <button
          data-active="accent"
          onClick={onCta}
          style={{
            ...resetButton,
            height: 44,
            padding: '0 20px',
            lineHeight: '44px',
            borderRadius: 'var(--radius-button)',
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            fontSize: 'var(--size-body)',
            fontWeight: 500,
          }}
        >
          {cta}
        </button>
      ) : null}
    </div>
  );
}
