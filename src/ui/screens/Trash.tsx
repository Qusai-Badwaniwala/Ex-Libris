import { useRef, useState, type ReactNode } from 'react';
import { nav } from '../../router/router';
import { localDay } from '../../db/dates';
import * as repo from '../../db/repo';
import { useDeletedNotes, useTrash } from '../store';
import { Cover, EmptyState } from '../components';
import { AnimatePresence, m, useIsPresent, useMotion } from '../motion';
import { withInteractionFeedback } from '../interaction-feedback';

/** Trash is reversible; permanent actions arm in place and retain failed rows. */
export function Trash() {
  const rows = useTrash();
  const notes = useDeletedNotes();
  const [armed, setArmed] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const loaded = rows !== undefined && notes !== undefined;
  const items = [
    ...(rows ?? []).map(({ work }) => ({
      id: work.id,
      kind: 'work' as const,
      title: work.title,
      at: work.deletedAt!,
      work,
    })),
    ...(notes ?? []).map((note) => ({
      id: note.id,
      kind: 'note' as const,
      title: note.title || note.body || 'Untitled note',
      at: note.deletedAt!,
      work: undefined,
    })),
  ];
  const run = async (id: string, action: () => Promise<unknown>, message: string) => {
    if (busy) return;
    setBusy(id);
    setError('');
    try {
      await withInteractionFeedback(message, action);
      setArmed(undefined);
      heading.current?.focus({ preventScroll: true });
    } catch {
      setError('That action could not finish. Anything not changed remains here; try again.');
    } finally {
      setBusy(undefined);
    }
  };
  return (
    <main className="room-page room-trash exl-scroll">
      <button className="room-text" aria-label="Back" onClick={() => nav.back()}>
        ← Back
      </button>
      <h1 ref={heading} tabIndex={-1}>
        Trash
      </h1>
      {items.length > 0 && (
        <p className="room-stat-note">
          Things wait here for thirty days, and are cleared the next time you open the app after
          that. Notes attached to a deleted work are not deleted with it.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {!loaded && <p role="status">Opening Trash…</p>}
      {loaded && !items.length && (
        <EmptyState
          art="bibliophile-bro"
          artWidth="58%"
          head="Trash is empty"
          body="Deleted works and notes wait here for thirty days. Notes attached to a deleted work survive as loose notes."
        />
      )}
      <AnimatePresence initial={false}>
        {items.map((item) => {
          const left = repo.daysLeftInTrash(item.at);
          const isArmed = armed === item.id;
          return (
            <TrashRow key={item.id}>
              <div className="room-trash-record">
                {item.work && (
                  <Cover
                    color={item.work.coverDominantColor ?? 'var(--cover-fallback)'}
                    path={item.work.coverPath}
                    width={36}
                    height={54}
                  />
                )}
                <div>
                  <h2>{item.title}</h2>
                  <p>
                    {item.kind === 'note' ? 'Note · ' : ''}
                    {localDay(item.at)} ·{' '}
                    {left ? left + ' day' + (left === 1 ? '' : 's') + ' left' : 'due to be cleared'}
                  </p>
                </div>
              </div>
              <div className="room-trash-actions">
                <button
                  className="room-text"
                  disabled={!!busy}
                  onClick={() =>
                    void run(
                      item.id,
                      () =>
                        item.kind === 'work'
                          ? repo.restoreWork(item.id)
                          : repo.restoreNote(item.id),
                      'Restoring from Trash…',
                    )
                  }
                >
                  {busy === item.id ? 'Working…' : 'Restore'}
                </button>
                <button
                  className="room-text room-danger-text"
                  disabled={!!busy}
                  onClick={() => {
                    if (!isArmed) setArmed(item.id);
                    else
                      void run(
                        item.id,
                        () =>
                          item.kind === 'work' ? repo.purgeWork(item.id) : repo.purgeNote(item.id),
                        'Deleting permanently…',
                      );
                  }}
                >
                  {isArmed ? 'Sure?' : 'Delete now'}
                </button>
              </div>
            </TrashRow>
          );
        })}
      </AnimatePresence>
      {items.length > 0 && (
        <button
          className="room-trash-empty room-danger-text"
          disabled={!!busy}
          onClick={() => {
            if (armed !== 'all') setArmed('all');
            else void run('all', () => repo.emptyTrash(), 'Emptying Trash…');
          }}
        >
          {armed === 'all' ? 'Tap again to empty it for good' : 'Empty it now'}
        </button>
      )}
    </main>
  );
}

function TrashRow({ children }: { children: ReactNode }) {
  const present = useIsPresent();
  const { reduced, settle, exit } = useMotion();
  return (
    <m.article
      className="room-trash-row"
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
