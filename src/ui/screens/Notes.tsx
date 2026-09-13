import { nav, useNav } from '../../router/router';
import { EmptyState } from '../components';
import { ChevronLeft } from '../icons';
import { NoteCard } from '../note-card';
import { useNotes } from '../store';
import { displayM, resetButton } from '../styles';

/** The plain-text notes feed from Claude Design. Phase 7 adds links, tags,
 * pinning and attachments without replacing this list or its pencil editor. */
export function Notes() {
  const notes = useNotes();
  const { overlays } = useNav();
  const editorOpen = overlays.some((overlay) => overlay.kind === 'noteEditor');
  return (
    <div
      className="exl-scroll"
      style={{
        position: 'absolute',
        inset: 0,
        overflowY: 'auto',
        padding: 'calc(var(--space-5) + var(--safe-top)) var(--page-gutter) 112px',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
          marginBottom: 'var(--space-5)',
        }}
      >
        <button
          aria-label="Back to the library"
          onClick={() => nav.reset({ screen: 'home' })}
          style={{
            ...resetButton,
            width: 44,
            height: 44,
            marginLeft: -14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronLeft />
        </button>
        <h1 style={{ ...displayM, flex: 1, margin: 0 }}>Notes</h1>
      </header>

      {notes === undefined || (notes.length === 0 && editorOpen) ? null : notes.length === 0 ? (
        <div style={{ display: 'flex', minHeight: '72%' }}>
          <EmptyState
            art="research-paper-amico"
            artWidth="82%"
            head="A clear page"
            body="Use the pencil to keep a thought. A note can stand on its own and stays private on this device."
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {notes.map((context) => (
            <NoteCard
              key={context.note.id}
              context={context}
              onOpen={() => nav.open({ kind: 'noteEditor', id: context.note.id })}
            />
          ))}
          <div style={{ borderTop: 'var(--hairline-width) solid var(--hairline)' }} />
        </div>
      )}
    </div>
  );
}
