import { nav, useNav } from '../../router/router';
import { EmptyState } from '../components';
import { NoteCard } from '../note-card';
import { useNotes } from '../store';
import { AnimatePresence } from '../motion';

export function Notes() {
  const notes = useNotes();
  const { overlays } = useNav();
  const editorOpen = overlays.some((overlay) => overlay.kind === 'noteEditor');
  return (
    <main className="room-page room-notes exl-scroll">
      <header className="room-notes-heading">
        <p className="room-eyebrow">In the margins</p>
        <h1>Notes</h1>
        <p>Thoughts worth keeping.</p>
      </header>
      {notes === undefined ? (
        <p role="status">Opening your notes…</p>
      ) : !notes.length && !editorOpen ? (
        <EmptyState
          art="research-paper-amico"
          artWidth="78%"
          head="A clear page"
          body="A passing thought, a passage to revisit, a thread between books. Write a note and keep it here."
        />
      ) : (
        <div className="room-note-feed">
          <AnimatePresence initial={false}>
            {notes.map((context) => (
              <NoteCard
                key={context.note.id}
                context={context}
                onOpen={() => nav.open({ kind: 'noteEditor', id: context.note.id })}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </main>
  );
}
