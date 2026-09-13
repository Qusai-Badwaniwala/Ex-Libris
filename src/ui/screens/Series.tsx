import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { ReadingOrderEntry, Series, Universe, Work } from '../../db/schema';
import { nav } from '../../router/router';
import { catalogue } from '../../catalogue/client';
import type { CorpusMatch } from '../../catalogue/types';
import { Cover } from '../components';
import { withInteractionFeedback } from '../interaction-feedback';
import { ChevronLeft, ChevronRight } from '../icons';
import { caption, displayS, label, resetButton, tabular } from '../styles';

interface SeriesScreenData {
  series: Series;
  universe?: Universe;
  works: Array<Work & { authorLine?: string }>;
  orders: Array<{
    id: string;
    name: string;
    description?: string;
    entries: ReadingOrderEntry[];
  }>;
}

export function SeriesScreen({ id }: { id: string }) {
  const data = useLiveQuery<SeriesScreenData | null>(async () => {
    const series = await db.series.get(id);
    if (!series) return null;
    const [universe, works, authors, orders] = await Promise.all([
      series.universeId ? db.universe.get(series.universeId) : undefined,
      db.work.where('seriesId').equals(id).toArray(),
      db.author.toArray(),
      db.readingOrder.where('[contextType+contextId]').equals(['series', id]).toArray(),
    ]);
    const authorById = new Map(authors.map((author) => [author.id, author.name]));
    const visibleWorks = works
      .filter((work) => !work.deletedAt)
      .map((work) => ({
        ...work,
        authorLine:
          work.authorIds
            .map((authorId) => authorById.get(authorId))
            .filter(Boolean)
            .join(', ') || undefined,
      }));
    const entries = await db.readingOrderEntry
      .where('orderId')
      .anyOf(orders.map((order) => order.id))
      .toArray();
    return {
      series,
      universe,
      works: visibleWorks,
      orders: orders.map((order) => ({
        id: order.id,
        name: order.name,
        description: order.description,
        entries: entries
          .filter((entry) => entry.orderId === order.id)
          .sort((a, b) => a.position - b.position),
      })),
    };
  }, [id]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>();
  const [addingCorpusId, setAddingCorpusId] = useState<string>();
  const [addError, setAddError] = useState('');

  const selectedOrder =
    data?.orders.find((order) => order.id === selectedOrderId) ?? data?.orders[0];
  const ordered = useMemo(
    () => orderSeriesRows(data?.works ?? [], selectedOrder?.entries ?? []),
    [data?.works, selectedOrder?.entries],
  );

  if (data === undefined) return null;
  if (data === null) return <MissingRecord noun="series" />;

  const finished = data.works.filter((work) => work.status === 'finished').length;
  const authorNames = [...new Set(data.works.map((work) => work.authorLine).filter(Boolean))];
  const authorLine = authorNames.length === 1 ? authorNames[0] : undefined;
  const known = data.series.totalEntriesKnown;

  const addGhost = async (entry: ReadingOrderEntry) => {
    if (!entry.corpusId || addingCorpusId) return;
    setAddingCorpusId(entry.corpusId);
    setAddError('');
    try {
      const evidence = await withInteractionFeedback('Opening the catalogue entry…', () =>
        catalogue.relationship(entry.corpusId!),
      );
      if (!evidence) throw new Error('That catalogue record is unavailable.');
      const candidate: CorpusMatch = {
        ...evidence.work,
        seriesName: evidence.series?.name,
        universeName: evidence.universe?.name,
      };
      nav.open({ kind: 'byHand', candidate });
    } catch {
      setAddError(
        'That entry could not be opened from the downloaded index. Search the catalogue or add it by hand.',
      );
    } finally {
      setAddingCorpusId(undefined);
    }
  };

  return (
    <div
      className="exl-scroll"
      style={{
        position: 'absolute',
        inset: 0,
        overflowY: 'auto',
        padding: 'calc(var(--space-5) + var(--safe-top)) 0 112px',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--space-2)',
          padding: '0 var(--page-gutter) var(--space-5)',
        }}
      >
        <BackButton />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1
            style={{
              ...displayS,
              fontSize: 'var(--size-display-m)',
              lineHeight: 'var(--lh-display-m)',
              margin: 0,
            }}
          >
            {data.series.name}
          </h1>
          {authorLine ? (
            <div style={{ ...caption, color: 'var(--text-secondary)' }}>{authorLine}</div>
          ) : null}
        </div>
        {known !== undefined ? <CompletionRing finished={finished} total={known} /> : null}
      </header>

      <div
        style={{
          padding: '0 var(--page-gutter) var(--space-4)',
          ...caption,
          color: 'var(--text-secondary)',
        }}
      >
        {known !== undefined
          ? `${finished} of ${known} ${known === 1 ? 'entry' : 'entries'} finished`
          : `${data.works.length} ${data.works.length === 1 ? 'entry' : 'entries'} in your library · total unknown`}
      </div>

      <section
        aria-labelledby="series-reading-orders-heading"
        style={{ padding: '0 var(--page-gutter) var(--space-4)' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-2)',
          }}
        >
          <h2 id="series-reading-orders-heading" style={{ ...label, flex: 1, margin: 0 }}>
            Reading order
          </h2>
          <button
            onClick={() => nav.open({ kind: 'readingOrderEditor', contextType: 'series', id })}
            style={{
              ...resetButton,
              ...caption,
              minHeight: 44,
              padding: '0 12px',
              borderRadius: 'var(--radius-button)',
              color: 'var(--accent-text)',
            }}
          >
            Manage orders
          </button>
        </div>
        {data.orders.length ? (
          <>
            <div
              style={{
                display: 'flex',
                gap: 'var(--space-2)',
                overflowX: 'auto',
                scrollbarWidth: 'none',
              }}
            >
              {data.orders.map((order) => {
                const active = order.id === selectedOrder?.id;
                return (
                  <button
                    key={order.id}
                    aria-pressed={active}
                    onClick={() => setSelectedOrderId(order.id)}
                    style={{
                      ...resetButton,
                      ...caption,
                      flex: 'none',
                      minHeight: 44,
                      padding: '0 14px',
                      borderRadius: 'var(--radius-pill)',
                      border: 'var(--hairline-width) solid var(--hairline-strong)',
                      background: active ? 'var(--surface-raised)' : 'transparent',
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    {order.name}
                  </button>
                );
              })}
            </div>
            {selectedOrder?.description ? (
              <p
                style={{ ...caption, color: 'var(--text-secondary)', margin: 'var(--space-2) 0 0' }}
              >
                {selectedOrder.description}
              </p>
            ) : null}
          </>
        ) : (
          <p style={{ ...caption, color: 'var(--text-secondary)', margin: 0 }}>
            Entries follow their series numbers until you create a named order.
          </p>
        )}
      </section>

      <section aria-label="Series entries">
        {ordered.map((row) =>
          row.kind === 'owned' ? (
            <OwnedEntry key={row.work.id} work={row.work} position={row.position} />
          ) : (
            <GhostEntry
              key={row.entry.id}
              entry={row.entry}
              busy={addingCorpusId === row.entry.corpusId}
              onAdd={() => void addGhost(row.entry)}
            />
          ),
        )}
        <div style={{ borderTop: 'var(--hairline-width) solid var(--hairline)' }} />
      </section>

      {ordered.length === 0 ? (
        <p
          style={{
            ...caption,
            color: 'var(--text-secondary)',
            padding: 'var(--space-5) var(--page-gutter)',
            margin: 0,
          }}
        >
          No entries are linked to this series yet.
        </p>
      ) : null}
      {addError ? (
        <p
          role="alert"
          style={{
            ...caption,
            color: 'var(--danger-text)',
            padding: 'var(--space-3) var(--page-gutter)',
            margin: 0,
          }}
        >
          {addError}
        </p>
      ) : null}

      {data.universe ? (
        <button
          onClick={() => nav.push({ screen: 'universe', id: data.universe!.id })}
          style={{
            ...resetButton,
            width: 'calc(100% - (var(--page-gutter) * 2))',
            margin: 'var(--space-6) var(--page-gutter) 0',
            padding: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            borderRadius: 'var(--radius-card)',
            border: 'var(--hairline-width) solid var(--hairline)',
            background: 'var(--surface-raised)',
            textAlign: 'left',
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ ...caption, color: 'var(--text-secondary)', display: 'block' }}>
              This series sits inside
            </span>
            <span
              style={{
                ...displayS,
                fontSize: 'var(--size-display-s)',
                lineHeight: 'var(--lh-display-s)',
                display: 'block',
                marginTop: 4,
              }}
            >
              {data.universe.name}
            </span>
          </span>
          <ChevronRight />
        </button>
      ) : null}
    </div>
  );
}

type OrderedRow =
  | { kind: 'owned'; work: SeriesScreenData['works'][number]; position?: number }
  | { kind: 'ghost'; entry: ReadingOrderEntry; position?: number };

function orderSeriesRows(
  works: SeriesScreenData['works'],
  entries: ReadingOrderEntry[],
): OrderedRow[] {
  if (!entries.length) {
    return [...works]
      .sort(
        (a, b) =>
          (a.seriesPosition ?? Number.POSITIVE_INFINITY) -
            (b.seriesPosition ?? Number.POSITIVE_INFINITY) ||
          a.sortTitle.localeCompare(b.sortTitle),
      )
      .map((work) => ({ kind: 'owned' as const, work, position: work.seriesPosition }));
  }
  const used = new Set<string>();
  const rows: OrderedRow[] = [];
  for (const entry of entries) {
    const work = works.find(
      (candidate) =>
        candidate.id === entry.workId ||
        (!!entry.corpusId && candidate.corpusId === entry.corpusId),
    );
    if (work) {
      used.add(work.id);
      rows.push({ kind: 'owned', work, position: work.seriesPosition ?? entry.position });
      continue;
    }
    if (entry.kind === 'work') rows.push({ kind: 'ghost', entry, position: entry.position });
  }
  rows.push(
    ...works
      .filter((work) => !used.has(work.id))
      .map((work) => ({ kind: 'owned' as const, work, position: work.seriesPosition })),
  );
  return rows;
}

function OwnedEntry({
  work,
  position,
}: {
  work: SeriesScreenData['works'][number];
  position?: number;
}) {
  return (
    <button
      onClick={() => nav.push({ screen: 'detail', id: work.id })}
      style={{
        ...resetButton,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--page-gutter)',
        borderTop: 'var(--hairline-width) solid var(--hairline)',
        textAlign: 'left',
      }}
      data-hover="raised"
    >
      <span
        style={{ ...caption, ...tabular, width: 22, flex: 'none', color: 'var(--text-secondary)' }}
      >
        {position ?? ''}
      </span>
      <Cover
        width={44}
        height={66}
        color={work.coverDominantColor ?? 'var(--cover-fallback)'}
        path={work.coverPath}
      />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: 'var(--size-body)',
            lineHeight: 'var(--lh-body)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {work.title}
        </span>
        <span
          style={{ ...caption, color: 'var(--text-secondary)', display: 'block', marginTop: 4 }}
        >
          {statusLabel(work.status)}
        </span>
      </span>
    </button>
  );
}

function GhostEntry({
  entry,
  busy,
  onAdd,
}: {
  entry: ReadingOrderEntry;
  busy: boolean;
  onAdd: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--page-gutter)',
        borderTop: 'var(--hairline-width) solid var(--hairline)',
      }}
    >
      <span
        style={{ ...caption, ...tabular, width: 22, flex: 'none', color: 'var(--text-secondary)' }}
      >
        {entry.position || ''}
      </span>
      <span
        aria-hidden="true"
        style={{
          width: 44,
          height: 66,
          flex: 'none',
          borderRadius: 'var(--radius-button)',
          border: 'var(--hairline-width) dashed var(--hairline-strong)',
        }}
      />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          color: 'var(--text-secondary)',
          fontSize: 'var(--size-body)',
          lineHeight: 'var(--lh-body)',
        }}
      >
        {entry.label}
      </span>
      {entry.corpusId ? (
        <button
          disabled={busy}
          onClick={onAdd}
          style={{
            ...resetButton,
            ...caption,
            minWidth: 62,
            minHeight: 36,
            padding: '0 14px',
            borderRadius: 'var(--radius-pill)',
            border: 'var(--hairline-width) solid var(--accent)',
            color: 'var(--accent-text)',
          }}
        >
          {busy ? 'Opening…' : 'Add'}
        </button>
      ) : null}
    </div>
  );
}

function CompletionRing({ finished, total }: { finished: number; total: number }) {
  const circumference = 2 * Math.PI * 22;
  const fraction = total > 0 ? Math.min(1, finished / total) : 0;
  return (
    <div
      aria-label={`${finished} of ${total} entries finished`}
      style={{ position: 'relative', width: 52, height: 52, flex: 'none' }}
    >
      <svg
        width="52"
        height="52"
        viewBox="0 0 52 52"
        style={{ transform: 'rotate(-90deg)' }}
        aria-hidden="true"
      >
        <circle cx="26" cy="26" r="22" fill="none" stroke="var(--hairline)" strokeWidth="2" />
        <circle
          cx="26"
          cy="26"
          r="22"
          fill="none"
          stroke="var(--status-finished)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
        />
      </svg>
      <span
        style={{
          ...caption,
          ...tabular,
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {finished}/{total}
      </span>
    </div>
  );
}

function BackButton() {
  return (
    <button
      aria-label="Back"
      onClick={() => nav.back()}
      style={{
        ...resetButton,
        width: 44,
        height: 44,
        marginLeft: -12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none',
      }}
    >
      <ChevronLeft />
    </button>
  );
}

function MissingRecord({ noun }: { noun: string }) {
  return (
    <div style={{ position: 'absolute', inset: 0, padding: 'var(--space-6) var(--page-gutter)' }}>
      <button
        onClick={() => nav.back()}
        style={{ ...resetButton, ...caption, color: 'var(--accent-text)' }}
      >
        ← Back
      </button>
      <div style={{ ...displayS, marginTop: 'var(--space-5)' }}>That {noun} is gone</div>
    </div>
  );
}

function statusLabel(status: Work['status']) {
  return status === 'caught_up' ? 'Caught up' : status[0]!.toUpperCase() + status.slice(1);
}
