import { useEffect, useRef, useState } from 'react';
import { nav, useTopOverlay } from '../../router/router';
import { caption, displayS, resetButton } from '../styles';
import { Close } from '../icons';
import { Cover, EmptyState } from '../components';
import { PUBLICATION_LABEL } from '../../db/derive';
import { useWishlist } from '../store';
import * as repo from '../../db/repo';
import { tick } from '../haptics';
import { prefersReducedMotion } from '../theme';
import { SCRIM } from '../design-literals';
import { localDay } from '../../db/dates';
import type { WorkWithAuthor } from '../store';
import { withInteractionFeedback } from '../interaction-feedback';

/**
 * The wishlist. Ported from design/Ex Libris.dc.html.
 *
 * Two audit additions, both of the "obviously expected and simply absent" kind:
 * the design's Start button has no handler at all, and the rows are not
 * tappable, so a wishlist entry could be removed but never opened or started.
 *
 * Removing from the wishlist is NOT a deletion and gets no confirmation and no
 * trash entry: the work was never in the library, so nothing is destroyed
 * (D-080). That is why this is the only single-tap × in the app.
 */
export function Wishlist() {
  const rows = useWishlist();
  const [error, setError] = useState('');
  /**
   * The dealt card is an OVERLAY, not local state.
   *
   * It looked like transient UI and was built that way first, which quietly
   * exempted it from the one rule the router exists to enforce: every modal
   * surface owns a history entry, so the Android back gesture closes it. A
   * scrim the hardware back button cannot dismiss traps the reader on the
   * screen — and it also swallowed Escape, because only the shared Sheet
   * handled that.
   */
  const overlay = useTopOverlay();
  const items = rows ?? [];
  const pick =
    overlay?.kind === 'surprise' ? (items.find((i) => i.work.id === overlay.id) ?? null) : null;
  const count = items.length
    ? `${items.length} waiting`
    : // A zero rendered as a numeral looks like a bug (D-090).
      'nothing waiting';

  const roll = () => {
    if (items.length === 0) return;
    tick();
    let i = Math.floor(Math.random() * items.length);
    // Re-rolling should give you something else. With one item there is nothing
    // else, and pretending otherwise would be a lie.
    if (items.length > 1 && items[i]?.work.id === pick?.work.id) i = (i + 1) % items.length;
    const next = items[i];
    if (!next) return;
    // Swap rather than open-again: a re-roll is the same step, so back from the
    // fifth pick returns to the wishlist and not through the previous four.
    if (pick) nav.swap({ kind: 'surprise', id: next.work.id });
    else nav.open({ kind: 'surprise', id: next.work.id });
  };

  return (
    <main className="room-page room-wishlist exl-scroll">
      <header className="room-wishlist-heading">
        <p className="room-eyebrow">For another day</p>
        <h1>Wishlist</h1>
        <div className="room-section-heading">
          <p>{count}</p>
          <button className="room-text" disabled={!items.length} onClick={roll}>
            Surprise me ↗
          </button>
        </div>
      </header>
      {error && <p role="alert">{error}</p>}
      {rows === undefined ? (
        <p role="status">Opening your wishlist…</p>
      ) : !items.length ? (
        <EmptyState
          art="cherry-blossom-cuate"
          artWidth="78%"
          head="Nothing waiting"
          body="Put things here when you hear about them. Surprise me picks one once there is something to pick."
        />
      ) : (
        <div className="room-wishlist-grid">
          {items.map(({ work, authorName }) => (
            <article className="room-wish" key={work.id} data-work={work.id}>
              <button
                className="room-wish-open"
                onClick={() => nav.push({ screen: 'detail', id: work.id })}
              >
                <Cover
                  color={work.coverDominantColor ?? 'var(--cover-fallback)'}
                  path={work.coverPath}
                  width={112}
                  height={168}
                  title={work.title}
                />
                <span>
                  <h2>{work.title}</h2>
                  <p>{authorName ?? 'Author unknown'}</p>
                  <small>
                    {work.publicationStatus === 'unknown'
                      ? 'Publication unknown'
                      : PUBLICATION_LABEL[work.publicationStatus]}
                  </small>
                </span>
              </button>
              <div className="room-wish-actions">
                <button
                  className="room-primary"
                  onClick={() =>
                    void withInteractionFeedback('Moving the work to Reading…', () =>
                      repo.setStatus(work.id, 'reading'),
                    ).catch(() => setError('This work could not be moved to Reading. Try again.'))
                  }
                >
                  Start reading ↗
                </button>
                <button
                  className="room-icon"
                  aria-label={`Remove ${work.title} from the wishlist`}
                  onClick={() =>
                    void withInteractionFeedback('Removing the wishlist entry…', () =>
                      repo.purgeWork(work.id),
                    ).catch(() => setError('This wishlist entry could not be removed. Try again.'))
                  }
                >
                  <Close />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {pick ? <SurpriseCard pick={pick} onRoll={roll} onClose={() => nav.close()} /> : null}
    </main>
  );
}

/**
 * The pick is dealt onto the list rather than pushed in from an edge, so it
 * scales 0.96 → 1 and never travels more than a few pixels (D-040). It
 * re-rolls in place, so a rejected pick costs one tap.
 */
function SurpriseCard({
  pick,
  onRoll,
  onClose,
}: {
  pick: WorkWithAuthor;
  onRoll: () => void;
  onClose: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const controls = () =>
      Array.from(card.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []);
    const frame = requestAnimationFrame(() => controls()[0]?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Tab') {
        const buttons = controls();
        const first = buttons[0];
        const last = buttons.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first || !card.current?.contains(document.activeElement))
        ) {
          e.preventDefault();
          last?.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last || !card.current?.contains(document.activeElement))
        ) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKey);
      if (previous?.isConnected) previous.focus();
    };
  }, [onClose]);

  useEffect(() => {
    const el = card.current;
    if (!el || prefersReducedMotion()) return;
    el.style.transition = 'none';
    el.style.transform = 'scale(0.96)';
    el.style.opacity = '0';
    void el.offsetWidth;
    el.style.transition =
      'transform var(--dur-base) var(--ease-out), opacity var(--dur-fast) linear';
    el.style.transform = 'none';
    el.style.opacity = '1';
    // Keyed on the work: a re-roll deals a NEW card onto the list, so it plays
    // again rather than swapping the text inside a card already at rest.
  }, [pick.work.id]);

  const { work, authorName } = pick;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="A pick from your wishlist"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-5)',
      }}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        data-dismiss-scrim
        data-no-press
        style={{
          ...resetButton,
          position: 'absolute',
          inset: 0,
          background: SCRIM,
          animation: 'exl-fade var(--dur-base) var(--ease-out) both',
        }}
      />
      <div
        ref={card}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 300,
          padding: 'var(--space-5)',
          borderRadius: 'var(--radius-sheet)',
          background: 'var(--surface-overlay)',
          // One of only two surfaces besides the FAB and its sheets permitted a
          // shadow — it is a modal surface, so the exception is the existing one
          // rather than a new one (D-040).
          boxShadow: 'var(--shadow-sheet)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-4)',
          textAlign: 'center',
        }}
      >
        <Cover
          color={work.coverDominantColor ?? 'var(--cover-fallback)'}
          path={work.coverPath}
          width={96}
          height={144}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={displayS}>{work.title}</div>
          {authorName ? (
            <div style={{ ...caption, color: 'var(--text-secondary)' }}>{authorName}</div>
          ) : null}
          <div style={{ ...caption, color: 'var(--text-secondary)' }}>
            On the list since {localDay(work.dateAdded)}
          </div>
        </div>
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
          }}
        >
          <button
            data-active="accent"
            onClick={() => {
              void withInteractionFeedback('Moving the work to Reading…', () =>
                repo.setStatus(work.id, 'reading'),
              )
                .then(() => nav.closeAndPush({ screen: 'detail', id: work.id }))
                .catch(() => setError('This work could not be moved to Reading. Try again.'));
            }}
            style={{
              ...resetButton,
              width: '100%',
              height: 44,
              lineHeight: '44px',
              textAlign: 'center',
              borderRadius: 'var(--radius-button)',
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              fontSize: 'var(--size-body)',
              fontWeight: 500,
            }}
          >
            Start reading it
          </button>
          {error && <p role="alert">{error}</p>}
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              data-hover="ink"
              onClick={onRoll}
              style={{
                ...resetButton,
                flex: 1,
                height: 40,
                lineHeight: '40px',
                textAlign: 'center',
                borderRadius: 'var(--radius-button)',
                border: 'var(--hairline-width) solid var(--hairline-strong)',
                color: 'var(--text-secondary)',
                ...caption,
              }}
            >
              Pick another
            </button>
            <button
              data-hover="ink"
              onClick={onClose}
              style={{
                ...resetButton,
                flex: 1,
                height: 40,
                lineHeight: '40px',
                textAlign: 'center',
                borderRadius: 'var(--radius-button)',
                color: 'var(--text-secondary)',
                ...caption,
              }}
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
