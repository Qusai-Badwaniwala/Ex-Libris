import { useRef, useState, type ReactNode } from 'react';
import { nav, useTopOverlay } from '../../router/router';
import { caption, displayS, resetButton } from '../styles';
import { Close } from '../icons';
import { Cover, EmptyState } from '../components';
import { PUBLICATION_LABEL } from '../../db/derive';
import { useWishlist } from '../store';
import * as repo from '../../db/repo';
import { tick } from '../haptics';
import { AnimatePresence, Arrive, m, useIsPresent, useMotion } from '../motion';
import { useModalFocus } from '../modal-focus';
import { useDraftGuard } from '../draft-guard';
import { MOTION, SCRIM } from '../design-literals';
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
 * Removal uses Trash so authored covers, notes and profiles remain recoverable.
 */
export function Wishlist() {
  const rows = useWishlist();
  const [error, setError] = useState('');
  const feedback = useRef<HTMLDivElement>(null);
  const showNotice = (next: { id: string; title: string; kind: 'started' | 'removed' }) => {
    setNotice(next);
    requestAnimationFrame(() =>
      feedback.current?.querySelector('button')?.focus({ preventScroll: true }),
    );
  };
  const [notice, setNotice] = useState<{
    id: string;
    title: string;
    kind: 'started' | 'removed';
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
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
      {notice && (
        <div ref={feedback} className="room-feedback" role="status">
          <span>
            {notice.title} {notice.kind === 'started' ? 'moved to Reading.' : 'moved to Trash.'}
          </span>
          <button
            className="room-text"
            onClick={() => {
              if (notice.kind === 'started') nav.push({ screen: 'detail', id: notice.id });
              else
                void withInteractionFeedback('Restoring the wishlist entry…', () =>
                  repo.restoreWork(notice.id),
                )
                  .then(() => setNotice(null))
                  .catch(() => setError('The entry could not be restored. Try again.'));
            }}
          >
            {notice.kind === 'started' ? 'Open record' : 'Undo'}
          </button>
        </div>
      )}
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
          <AnimatePresence initial={false}>
            {items.map(({ work, authorName }) => (
              <WishItem key={work.id} workId={work.id}>
                <button className="room-wish-open" onClick={() => nav.openWork(work.id)}>
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
                    disabled={busy === work.id}
                    onClick={() => {
                      setBusy(work.id);
                      setError('');
                      void withInteractionFeedback('Moving the work to Reading…', () =>
                        repo.setStatus(work.id, 'reading'),
                      )
                        .then(() => showNotice({ id: work.id, title: work.title, kind: 'started' }))
                        .catch(() =>
                          setError('This work could not be moved to Reading. Try again.'),
                        )
                        .finally(() => setBusy(null));
                    }}
                  >
                    Start reading ↗
                  </button>
                  <button
                    className="room-icon"
                    aria-label={`Remove ${work.title} from the wishlist`}
                    disabled={busy === work.id}
                    onClick={() => {
                      setBusy(work.id);
                      setError('');
                      void withInteractionFeedback('Removing the wishlist entry…', () =>
                        repo.softDeleteWork(work.id),
                      )
                        .then(() => showNotice({ id: work.id, title: work.title, kind: 'removed' }))
                        .catch(() =>
                          setError('This wishlist entry could not be removed. Try again.'),
                        )
                        .finally(() => setBusy(null));
                    }}
                  >
                    <Close />
                  </button>
                </div>
              </WishItem>
            ))}
          </AnimatePresence>
        </div>
      )}
      <AnimatePresence>
        {pick ? (
          <SurpriseCard key="surprise" pick={pick} onRoll={roll} onClose={() => nav.close()} />
        ) : null}
      </AnimatePresence>
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
  const root = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const present = useIsPresent();
  const { reduced, spring, exit, settle } = useMotion();
  useDraftGuard(false, busy, 'surprise');
  useModalFocus(root, onClose, present);

  const { work, authorName } = pick;

  return (
    <m.div
      ref={root}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={present ? settle : exit}
      inert={!present || undefined}
      aria-hidden={!present || undefined}
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
        }}
      />
      <m.div
        initial={reduced ? false : { scale: MOTION.dealtScale }}
        animate={{ scale: 1 }}
        transition={spring}
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
        <Arrive
          motionKey={work.id}
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--space-4)',
          }}
        >
          <Cover
            color={work.coverDominantColor ?? 'var(--cover-fallback)'}
            path={work.coverPath}
            width={96}
            height={144}
          />
          <div
            aria-live="polite"
            aria-atomic="true"
            style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
          >
            <h2 style={{ ...displayS, margin: 0 }}>{work.title}</h2>
            {authorName ? (
              <div style={{ ...caption, color: 'var(--text-secondary)' }}>{authorName}</div>
            ) : null}
            <div style={{ ...caption, color: 'var(--text-secondary)' }}>
              On the list since {localDay(work.dateAdded)}
            </div>
          </div>
        </Arrive>
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
            disabled={busy}
            onClick={() => {
              if (busy) return;
              setBusy(true);
              setError('');
              void withInteractionFeedback('Moving the work to Reading…', () =>
                repo.setStatus(work.id, 'reading'),
              )
                .then(() => nav.closeAndPush({ screen: 'detail', id: work.id }))
                .catch(() => setError('This work could not be moved to Reading. Try again.'))
                .finally(() => setBusy(false));
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
            {busy ? 'Starting…' : 'Start reading it'}
          </button>
          {error && <p role="alert">{error}</p>}
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              data-hover="ink"
              disabled={busy}
              onClick={onRoll}
              style={{
                ...resetButton,
                flex: 1,
                height: 44,
                lineHeight: '44px',
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
              disabled={busy}
              onClick={onClose}
              style={{
                ...resetButton,
                flex: 1,
                height: 44,
                lineHeight: '44px',
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
      </m.div>
    </m.div>
  );
}

function WishItem({ children, workId }: { children: ReactNode; workId: string }) {
  const present = useIsPresent();
  const { reduced, settle, exit } = useMotion();
  return (
    <m.article
      className="room-wish"
      data-work={workId}
      layout={reduced ? false : 'position'}
      initial={false}
      exit={{ opacity: 0 }}
      transition={present ? settle : exit}
      inert={!present || undefined}
      aria-hidden={!present || undefined}
    >
      {children}
    </m.article>
  );
}
