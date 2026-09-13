import { localDay } from '../db/dates';
import type { NoteContext } from '../db/repo';
import { Cover } from './components';
import { caption, displayS, resetButton } from './styles';

/** The same approved note hierarchy is used in the feed and on a linked work.
 * Keeping it here prevents Detail from drifting into a second kind of note. */
export function NoteCard({
  context,
  onOpen,
  showAttachedWorks = true,
}: {
  context: NoteContext;
  onOpen: () => void;
  showAttachedWorks?: boolean;
}) {
  const { note, works } = context;
  const accessibleName = note.title?.trim() || note.body.trim() || 'Open note';
  return (
    <button
      data-hover="raised"
      aria-label={`Edit note: ${accessibleName}`}
      onClick={onOpen}
      style={{
        ...resetButton,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        padding: 'var(--space-4) 0',
        borderTop: 'var(--hairline-width) solid var(--hairline)',
        textAlign: 'left',
      }}
    >
      {note.pinned ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            aria-hidden="true"
            style={{ width: 4, height: 4, borderRadius: 999, background: 'var(--accent)' }}
          />
          <span style={{ ...caption, color: 'var(--text-secondary)' }}>Pinned</span>
        </span>
      ) : null}
      {note.title ? <span style={displayS}>{note.title}</span> : null}
      {note.body ? (
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--size-body)',
            lineHeight: 'var(--lh-body)',
            color: 'var(--text-primary)',
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            textWrap: 'pretty',
          }}
        >
          {note.body}
        </span>
      ) : null}
      {showAttachedWorks && works.length ? (
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {works.map((work) => (
            <span
              key={work.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: '4px 10px 4px 4px',
                maxWidth: '100%',
                borderRadius: 'var(--radius-pill)',
                border: 'var(--hairline-width) solid var(--hairline)',
              }}
            >
              <Cover
                width={14}
                height={20}
                color={
                  work.deletedAt
                    ? 'var(--cover-fallback)'
                    : (work.coverDominantColor ?? 'var(--cover-fallback)')
                }
                path={work.deletedAt ? undefined : work.coverPath}
              />
              <span
                style={{
                  minWidth: 0,
                  maxWidth: 130,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 'var(--size-caption)',
                  lineHeight: 'var(--lh-caption)',
                  color: 'var(--text-secondary)',
                }}
              >
                {work.title}
              </span>
            </span>
          ))}
        </span>
      ) : null}
      <span style={{ ...caption, color: 'var(--text-secondary)' }}>{localDay(note.updatedAt)}</span>
    </button>
  );
}
