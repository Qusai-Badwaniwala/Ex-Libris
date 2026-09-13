import { useEffect, useId, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import * as repo from '../db/repo';
import type { ReadingOrder, ReadingOrderEntry } from '../db/schema';
import { Field, Sheet } from './components';
import { withInteractionFeedback } from './interaction-feedback';
import { caption, displayS, label, resetButton } from './styles';

type ContextType = ReadingOrder['contextType'];

interface DraftEntry extends repo.NewReadingOrderEntry {
  key: string;
}

interface Candidate {
  key: string;
  entry: repo.NewReadingOrderEntry;
}

export function ReadingOrderEditor({
  contextType,
  id,
  onClose,
}: {
  contextType: ContextType;
  id: string;
  onClose: () => void;
}) {
  const data = useLiveQuery(async () => {
    const context = contextType === 'series' ? await db.series.get(id) : await db.universe.get(id);
    if (!context) return null;
    const orders = await db.readingOrder
      .where('[contextType+contextId]')
      .equals([contextType, id])
      .toArray();
    const storedEntries = await db.readingOrderEntry
      .where('orderId')
      .anyOf(orders.map((order) => order.id))
      .toArray();
    const localCandidates: Candidate[] =
      contextType === 'series'
        ? (await db.work.where('seriesId').equals(id).toArray())
            .filter((work) => !work.deletedAt)
            .sort(
              (left, right) =>
                (left.seriesPosition ?? Number.POSITIVE_INFINITY) -
                  (right.seriesPosition ?? Number.POSITIVE_INFINITY) ||
                left.sortTitle.localeCompare(right.sortTitle),
            )
            .map((work) => ({
              key: `work:${work.id}`,
              entry: {
                kind: 'work' as const,
                label: work.title,
                workId: work.id,
                corpusId: work.corpusId,
              },
            }))
        : (await db.series.where('universeId').equals(id).sortBy('sortName')).map((series) => ({
            key: `series:${series.id}`,
            entry: { kind: 'series' as const, label: series.name, seriesId: series.id },
          }));
    const candidates = uniqueCandidates([
      ...localCandidates,
      ...storedEntries.map((entry) => ({
        key: entryIdentity(entry),
        entry: asNewEntry(entry),
      })),
    ]);
    return {
      context,
      orders: orders
        .sort((left, right) =>
          left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }),
        )
        .map((order) => ({
          ...order,
          entries: storedEntries
            .filter((entry) => entry.orderId === order.id)
            .sort((left, right) => left.position - right.position),
        })),
      candidates,
    };
  }, [contextType, id]);
  const [initialized, setInitialized] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [entries, setEntries] = useState<DraftEntry[]>([]);
  const [candidateKey, setCandidateKey] = useState('');
  const [startingPoint, setStartingPoint] = useState('');
  const [busy, setBusy] = useState<'order' | 'delete' | 'starting'>();
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [error, setError] = useState('');
  const candidateSelectId = useId();

  useEffect(() => {
    if (!data || initialized) return;
    setStartingPoint(
      'readingOrderNote' in data.context ? (data.context.readingOrderNote ?? '') : '',
    );
    const first = data.orders[0];
    if (first) loadOrder(first);
    else loadNew(data.candidates);
    setInitialized(true);
  }, [data, initialized]);

  if (!data) return null;

  const available = data.candidates.filter(
    (candidate) => !entries.some((entry) => entryIdentity(entry) === candidate.key),
  );
  const valid = name.trim().length > 0 && entries.length > 0 && !busy;
  const storedStartingPoint =
    'readingOrderNote' in data.context ? (data.context.readingOrderNote ?? '') : '';
  const startingChanged = startingPoint.trim() !== storedStartingPoint.trim();

  function loadOrder(order: ReadingOrder & { entries: ReadingOrderEntry[] }) {
    setSelectedOrderId(order.id);
    setName(order.name);
    setDescription(order.description ?? '');
    setEntries(
      order.entries.map((entry) => ({
        ...asNewEntry(entry),
        key: entry.id,
      })),
    );
    setCandidateKey('');
    setDeleteArmed(false);
    setError('');
  }

  function loadNew(candidates: Candidate[]) {
    setSelectedOrderId(undefined);
    setName('');
    setDescription('');
    setEntries(candidates.map((candidate) => ({ ...candidate.entry, key: candidate.key })));
    setCandidateKey('');
    setDeleteArmed(false);
    setError('');
  }

  const move = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= entries.length) return;
    setEntries((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
    setDeleteArmed(false);
  };

  const saveOrder = async () => {
    if (!valid) return;
    setBusy('order');
    setError('');
    const cleanEntries = entries.map(stripDraftKey);
    try {
      await withInteractionFeedback(
        selectedOrderId ? 'Saving the reading order…' : 'Creating the reading order…',
        () =>
          selectedOrderId
            ? repo.saveReadingOrder(selectedOrderId, { name, description }, cleanEntries)
            : repo.createReadingOrder(
                { contextType, contextId: id, name, description },
                cleanEntries,
              ),
      );
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error && /already exists/.test(caught.message)
          ? caught.message
          : 'The reading order could not be saved. Your name and sequence are still here; try again.',
      );
    } finally {
      setBusy(undefined);
    }
  };

  const removeOrder = async () => {
    if (!selectedOrderId || busy) return;
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    setBusy('delete');
    setError('');
    try {
      await withInteractionFeedback('Deleting the reading order…', () =>
        repo.deleteReadingOrder(selectedOrderId),
      );
      onClose();
    } catch {
      setError('The reading order could not be deleted. It is still here; try again.');
    } finally {
      setBusy(undefined);
    }
  };

  const saveStartingPoint = async () => {
    if (contextType !== 'universe' || busy) return;
    setBusy('starting');
    setError('');
    try {
      await withInteractionFeedback('Saving the starting point…', () =>
        repo.updateUniverse(id, { readingOrderNote: startingPoint }),
      );
    } catch {
      setError('The starting point could not be saved. Your note is still here; try again.');
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <Sheet title="Reading orders" onClose={onClose} maxHeight="94%">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={displayS}>Reading orders</div>
        <p style={{ ...caption, color: 'var(--text-secondary)', margin: 0 }}>
          {data.context.name} can keep several named sequences. None becomes the default silently.
        </p>
      </div>

      {contextType === 'universe' ? (
        <section style={sectionStyle} aria-labelledby="starting-point-heading">
          <h2 id="starting-point-heading" style={{ ...displayS, margin: 0 }}>
            Starting point
          </h2>
          <p style={{ ...caption, color: 'var(--text-secondary)', margin: 0 }}>
            If publication order is a poor place to begin, say where to start before following a
            named order.
          </p>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={label}>Where to begin and why</span>
            <textarea
              aria-label="Where to begin and why"
              value={startingPoint}
              onChange={(event) => setStartingPoint(event.target.value)}
              placeholder="Start with…"
              rows={3}
              data-focus="accent"
              style={textareaStyle}
            />
          </label>
          <button
            disabled={!!busy || !startingChanged}
            onClick={() => void saveStartingPoint()}
            style={{ ...secondaryButton, width: '100%' }}
          >
            {busy === 'starting'
              ? 'Saving…'
              : storedStartingPoint && !startingPoint.trim()
                ? 'Clear starting point'
                : 'Save starting point'}
          </button>
        </section>
      ) : null}

      <section style={sectionStyle} aria-labelledby="named-orders-heading">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <h2 id="named-orders-heading" style={{ ...displayS, flex: 1, margin: 0 }}>
            Named orders
          </h2>
          <button
            onClick={() => loadNew(data.candidates)}
            style={{ ...secondaryButton, flex: 'none', padding: '0 14px' }}
          >
            New order
          </button>
        </div>

        {data.orders.length ? (
          <div
            aria-label="Choose a reading order"
            style={{ display: 'flex', gap: 'var(--space-2)', overflowX: 'auto' }}
          >
            {data.orders.map((order) => (
              <button
                key={order.id}
                aria-pressed={selectedOrderId === order.id}
                onClick={() => loadOrder(order)}
                style={{
                  ...secondaryButton,
                  flex: 'none',
                  padding: '0 14px',
                  background:
                    selectedOrderId === order.id ? 'var(--surface-raised)' : 'transparent',
                  color:
                    selectedOrderId === order.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                {order.name}
              </button>
            ))}
          </div>
        ) : (
          <p style={{ ...caption, color: 'var(--text-secondary)', margin: 0 }}>
            No named order yet. Create one from the linked entries below.
          </p>
        )}

        <Field label="Order name" value={name} onChange={setName} placeholder="Preferred order" />
        <Field
          label="Short explanation"
          value={description}
          onChange={setDescription}
          placeholder="Optional"
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div style={label}>Sequence</div>
          {entries.map((entry, index) => (
            <div key={entry.key} style={entryRowStyle}>
              <span style={{ ...caption, flex: 1, minWidth: 0 }}>
                <span style={{ color: 'var(--text-secondary)', marginRight: 8 }}>{index + 1}</span>
                {entry.label}
              </span>
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                <button
                  disabled={index === 0 || !!busy}
                  aria-label={`Move ${entry.label} earlier`}
                  onClick={() => move(index, -1)}
                  style={smallButton}
                >
                  Earlier
                </button>
                <button
                  disabled={index === entries.length - 1 || !!busy}
                  aria-label={`Move ${entry.label} later`}
                  onClick={() => move(index, 1)}
                  style={smallButton}
                >
                  Later
                </button>
                <button
                  disabled={!!busy}
                  aria-label={`Remove ${entry.label} from this order`}
                  onClick={() =>
                    setEntries((current) => current.filter((row) => row.key !== entry.key))
                  }
                  style={{ ...smallButton, color: 'var(--danger)' }}
                >
                  Remove
                </button>
              </span>
            </div>
          ))}
          {entries.length === 0 ? (
            <p role="note" style={{ ...caption, color: 'var(--danger-text)', margin: 0 }}>
              A named order needs at least one linked entry.
            </p>
          ) : null}
        </div>

        {available.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor={candidateSelectId} style={label}>
              Add a linked entry
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <select
                id={candidateSelectId}
                value={candidateKey}
                onChange={(event) => setCandidateKey(event.target.value)}
                style={{ ...selectStyle, flex: 1 }}
              >
                <option value="">Choose an entry</option>
                {available.map((candidate) => (
                  <option key={candidate.key} value={candidate.key}>
                    {candidate.entry.label}
                  </option>
                ))}
              </select>
              <button
                disabled={!candidateKey || !!busy}
                onClick={() => {
                  const candidate = available.find((row) => row.key === candidateKey);
                  if (!candidate) return;
                  setEntries((current) => [...current, { ...candidate.entry, key: candidate.key }]);
                  setCandidateKey('');
                }}
                style={{ ...secondaryButton, flex: 'none', width: 72 }}
              >
                Add
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <p role="alert" style={{ ...caption, color: 'var(--danger-text)', margin: 0 }}>
            {error}
          </p>
        ) : null}

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button onClick={onClose} style={{ ...secondaryButton, width: 96, flex: 'none' }}>
            Cancel
          </button>
          <button
            disabled={!valid}
            onClick={() => void saveOrder()}
            style={{
              ...primaryButton,
              background: valid ? 'var(--accent)' : 'var(--surface-raised)',
              color: valid ? 'var(--on-accent)' : 'var(--text-faint)',
            }}
          >
            {busy === 'order' ? 'Saving…' : selectedOrderId ? 'Save order' : 'Create order'}
          </button>
        </div>

        {selectedOrderId ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              disabled={!!busy}
              onClick={() => void removeOrder()}
              style={{
                ...secondaryButton,
                width: '100%',
                borderColor: 'var(--danger)',
                color: 'var(--danger)',
                background: deleteArmed ? 'var(--danger-soft)' : 'transparent',
              }}
            >
              {deleteArmed ? 'Delete order permanently' : 'Delete this order'}
            </button>
            <span style={{ ...label, textAlign: 'center' }}>
              This removes only the named order. Works and series stay in the library.
            </span>
          </div>
        ) : null}
      </section>
    </Sheet>
  );
}

function asNewEntry(entry: ReadingOrderEntry): repo.NewReadingOrderEntry {
  return {
    kind: entry.kind,
    label: entry.label,
    workId: entry.workId,
    seriesId: entry.seriesId,
    corpusId: entry.corpusId,
    note: entry.note,
  };
}

function stripDraftKey(draft: DraftEntry): repo.NewReadingOrderEntry {
  const { key, ...entry } = draft;
  void key;
  return entry;
}

function entryIdentity(entry: repo.NewReadingOrderEntry): string {
  return entry.workId
    ? `work:${entry.workId}`
    : entry.seriesId
      ? `series:${entry.seriesId}`
      : entry.corpusId
        ? `${entry.kind}-corpus:${entry.corpusId}`
        : `${entry.kind}-label:${entry.label}`;
}

function uniqueCandidates(candidates: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.key)) return false;
    seen.add(candidate.key);
    return true;
  });
}

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
  paddingTop: 'var(--space-4)',
  borderTop: 'var(--hairline-width) solid var(--hairline)',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 88,
  resize: 'vertical',
  boxSizing: 'border-box',
  border: 'var(--hairline-width) solid var(--hairline-strong)',
  borderRadius: 'var(--radius-button)',
  background: 'var(--surface-sunken)',
  color: 'var(--text-primary)',
  padding: '12px 14px',
  font: 'inherit',
  lineHeight: 'var(--lh-body)',
  outline: 'none',
};

const selectStyle: React.CSSProperties = {
  minHeight: 44,
  minWidth: 0,
  color: 'var(--text-primary)',
  background: 'var(--surface-sunken)',
  border: 'var(--hairline-width) solid var(--hairline-strong)',
  borderRadius: 'var(--radius-button)',
  padding: '0 12px',
  font: 'inherit',
};

const entryRowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
  padding: 'var(--space-3) 0',
  borderTop: 'var(--hairline-width) solid var(--hairline)',
};

const secondaryButton: React.CSSProperties = {
  ...resetButton,
  minHeight: 44,
  border: 'var(--hairline-width) solid var(--hairline-strong)',
  borderRadius: 'var(--radius-button)',
  color: 'var(--text-secondary)',
  textAlign: 'center',
};

const smallButton: React.CSSProperties = {
  ...resetButton,
  minHeight: 44,
  padding: '0 10px',
  borderRadius: 'var(--radius-chip)',
  border: 'var(--hairline-width) solid var(--hairline)',
  color: 'var(--text-secondary)',
  fontSize: 'var(--size-label)',
  textAlign: 'center',
};

const primaryButton: React.CSSProperties = {
  ...resetButton,
  flex: 1,
  minHeight: 48,
  borderRadius: 'var(--radius-button)',
  textAlign: 'center',
};
