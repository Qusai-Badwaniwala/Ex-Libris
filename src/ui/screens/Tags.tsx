import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { normalizeTag } from '../../db/keys';
import * as repo from '../../db/repo';
import { nav } from '../../router/router';
import { withInteractionFeedback } from '../interaction-feedback';
import { ChevronLeft } from '../icons';
import { caption, displayM, label, quietButton, resetButton, tabular } from '../styles';

/** Phase 10's deliberately small tag maintenance surface. */
export function Tags() {
  const rows = useLiveQuery(() => repo.listTagsForMaintenance(), []);
  const [editingId, setEditingId] = useState<string>();
  const [name, setName] = useState('');
  const [armed, setArmed] = useState<{ kind: 'merge' | 'delete'; id: string }>();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const editing = rows?.find((row) => row.tag.id === editingId);
  const destination = useMemo(() => {
    const normalized = normalizeTag(name.trim());
    return rows?.find((row) => row.tag.id !== editingId && row.tag.normalizedName === normalized);
  }, [editingId, name, rows]);

  const beginEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setName(currentName);
    setArmed(undefined);
    setMessage('');
    setError('');
  };

  const save = async () => {
    if (!editing || !name.trim() || pending) return;
    if (destination && (armed?.kind !== 'merge' || armed.id !== editing.tag.id)) {
      setArmed({ kind: 'merge', id: editing.tag.id });
      return;
    }
    setPending(true);
    setError('');
    try {
      const result = await withInteractionFeedback('Updating the tags…', () =>
        repo.renameOrMergeTag(editing.tag.id, name),
      );
      setMessage(
        result.kind === 'merged'
          ? `Merged into ${result.tag.name}. Every attachment was kept.`
          : `Renamed to ${result.tag.name}.`,
      );
      setEditingId(undefined);
      setArmed(undefined);
    } catch {
      setError('The tag could not be changed. Nothing was changed.');
    } finally {
      setPending(false);
    }
  };

  const remove = async (id: string, tagName: string) => {
    if (pending) return;
    if (armed?.kind !== 'delete' || armed.id !== id) {
      setArmed({ kind: 'delete', id });
      setMessage(`Tap Remove ${tagName} again to confirm.`);
      return;
    }
    setPending(true);
    setError('');
    try {
      await withInteractionFeedback('Removing the unused tag…', () => repo.deleteUnusedTag(id));
      setMessage(`Removed ${tagName}.`);
      setArmed(undefined);
    } catch {
      setError('That tag is still attached to something, so it was kept.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className="exl-scroll"
      style={{
        position: 'absolute',
        inset: 0,
        overflowY: 'auto',
        padding: 'calc(var(--space-5) + var(--safe-top)) var(--page-gutter) 104px',
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
          aria-label="Back"
          onClick={() => nav.back()}
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
        <h1 style={{ ...displayM, margin: 0 }}>Tidy up the tags</h1>
      </header>

      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--size-body-l)',
          lineHeight: 'var(--lh-body-l)',
          color: 'var(--text-secondary)',
          margin: '0 0 var(--space-5)',
          textWrap: 'pretty',
        }}
      >
        Rename a tag to correct it. Rename it to another existing tag to merge the two. Only tags
        attached to nothing can be removed.
      </p>

      {message ? (
        <p role="status" style={{ ...caption, color: 'var(--text-secondary)' }}>
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" style={{ ...caption, color: 'var(--danger-text)' }}>
          {error}
        </p>
      ) : null}

      {rows === undefined ? (
        <p role="status" style={label}>
          Reading the tags…
        </p>
      ) : rows.length === 0 ? (
        <p style={label}>No tags yet. Tags appear here after they are used on a work or note.</p>
      ) : (
        <div style={{ borderBottom: 'var(--hairline-width) solid var(--hairline)' }}>
          {rows.map((row) => {
            const isEditing = editingId === row.tag.id;
            const unused = row.activeUses === 0 && row.trashUses === 0;
            const useText = row.trashUses
              ? `${row.activeUses} active · ${row.trashUses} in Trash`
              : row.activeUses === 0
                ? 'unused'
                : `${row.activeUses} ${row.activeUses === 1 ? 'use' : 'uses'}`;
            return (
              <section
                key={row.tag.id}
                style={{ borderTop: 'var(--hairline-width) solid var(--hairline)' }}
              >
                <div
                  style={{
                    minHeight: 56,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-2) 0',
                  }}
                >
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 'var(--size-body)',
                        lineHeight: 'var(--lh-body)',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {row.tag.name}
                    </span>
                    <span style={{ ...label, ...tabular }}>{useText}</span>
                  </span>
                  <button
                    aria-label={`Edit ${row.tag.name}`}
                    onClick={() => beginEdit(row.tag.id, row.tag.name)}
                    style={{
                      ...resetButton,
                      minWidth: 44,
                      minHeight: 44,
                      textAlign: 'center',
                      ...caption,
                    }}
                  >
                    Edit
                  </button>
                  {unused ? (
                    <button
                      aria-label={`Remove ${row.tag.name}`}
                      onClick={() => void remove(row.tag.id, row.tag.name)}
                      style={{
                        ...resetButton,
                        minWidth: 44,
                        minHeight: 44,
                        textAlign: 'center',
                        ...caption,
                        color: 'var(--danger-text)',
                      }}
                    >
                      {armed?.kind === 'delete' && armed.id === row.tag.id ? 'Confirm' : 'Remove'}
                    </button>
                  ) : null}
                </div>

                {isEditing ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void save();
                    }}
                    style={{ padding: '0 0 var(--space-3)' }}
                  >
                    <label htmlFor={`tag-${row.tag.id}`} style={{ ...label, display: 'block' }}>
                      Tag name
                    </label>
                    <input
                      id={`tag-${row.tag.id}`}
                      autoFocus
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value);
                        setArmed(undefined);
                      }}
                      style={{
                        width: '100%',
                        minHeight: 44,
                        marginTop: 'var(--space-1)',
                        padding: '0 var(--space-3)',
                        borderRadius: 'var(--radius-button)',
                        border: 'var(--hairline-width) solid var(--hairline-strong)',
                        background: 'var(--surface-sunken)',
                        color: 'var(--text-primary)',
                        font: 'inherit',
                      }}
                    />
                    {destination ? (
                      <p style={{ ...label, margin: 'var(--space-2) 0 0' }}>
                        This will keep every attachment and merge into {destination.tag.name}.
                      </p>
                    ) : null}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 'var(--space-2)',
                        marginTop: 'var(--space-3)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(undefined);
                          setArmed(undefined);
                        }}
                        style={quietButton}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={pending || !name.trim() || name.trim() === row.tag.name}
                        style={{
                          ...quietButton,
                          color: destination ? 'var(--danger-text)' : 'var(--accent-text)',
                        }}
                      >
                        {destination && armed?.kind === 'merge'
                          ? 'Confirm merge'
                          : destination
                            ? 'Merge'
                            : 'Save'}
                      </button>
                    </div>
                  </form>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
