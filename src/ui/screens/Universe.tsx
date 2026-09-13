import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { nav } from '../../router/router';
import { ChevronLeft, ChevronRight } from '../icons';
import { caption, displayS, label, resetButton } from '../styles';

export function UniverseScreen({ id }: { id: string }) {
  const data = useLiveQuery(async () => {
    const universe = await db.universe.get(id);
    if (!universe) return null;
    const [series, orders] = await Promise.all([
      db.series.where('universeId').equals(id).sortBy('sortName'),
      db.readingOrder.where('[contextType+contextId]').equals(['universe', id]).toArray(),
    ]);
    const works = await db.work.where('universeId').equals(id).toArray();
    const linkedSeriesWorks = await db.work
      .where('seriesId')
      .anyOf(series.map((row) => row.id))
      .toArray();
    const allWorks = [...works, ...linkedSeriesWorks].filter(
      (work, index, rows) =>
        !work.deletedAt && rows.findIndex((candidate) => candidate.id === work.id) === index,
    );
    const entries = await db.readingOrderEntry
      .where('orderId')
      .anyOf(orders.map((order) => order.id))
      .toArray();
    return {
      universe,
      series,
      works: allWorks,
      orders: orders.map((order) => ({
        ...order,
        entries: entries
          .filter((entry) => entry.orderId === order.id)
          .sort((a, b) => a.position - b.position),
      })),
    };
  }, [id]);

  if (data === undefined) return null;
  if (data === null) return <MissingUniverse />;

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
          padding: '0 var(--page-gutter) var(--space-4)',
        }}
      >
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
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1
            style={{
              ...displayS,
              fontSize: 'var(--size-display-m)',
              lineHeight: 'var(--lh-display-m)',
              margin: 0,
            }}
          >
            {data.universe.name}
          </h1>
          {data.universe.description ? (
            <p
              style={{
                margin: 0,
                color: 'var(--text-secondary)',
                fontSize: 'var(--size-body)',
                lineHeight: 'var(--lh-body)',
              }}
            >
              {data.universe.description}
            </p>
          ) : null}
        </div>
        <button
          onClick={() => nav.open({ kind: 'readingOrderEditor', contextType: 'universe', id })}
          style={{
            ...resetButton,
            ...caption,
            minHeight: 44,
            padding: '0 10px',
            borderRadius: 'var(--radius-button)',
            color: 'var(--accent-text)',
            flex: 'none',
          }}
        >
          Manage
        </button>
      </header>

      {data.universe.readingOrderNote ? (
        <ReadingOrderCard
          name="Start here"
          body={data.universe.readingOrderNote}
          intro="Before following a named order"
        />
      ) : null}
      {data.orders.map((order) => (
        <ReadingOrderCard
          key={order.id}
          name={order.name}
          body={order.description}
          entries={order.entries.map((entry) => entry.label)}
        />
      ))}

      <section aria-labelledby="universe-series-heading" style={{ marginTop: 'var(--space-5)' }}>
        <h2
          id="universe-series-heading"
          style={{ ...label, fontWeight: 400, margin: '0 var(--page-gutter) var(--space-2)' }}
        >
          Series in this continuity
        </h2>
        {data.series.map((series) => {
          const works = data.works.filter((work) => work.seriesId === series.id);
          const finished = works.filter((work) => work.status === 'finished').length;
          const note =
            series.totalEntriesKnown !== undefined
              ? `${finished} of ${series.totalEntriesKnown} finished`
              : `${works.length} ${works.length === 1 ? 'entry' : 'entries'} in your library`;
          const colors = works
            .slice(0, 3)
            .map((work) => work.coverDominantColor ?? 'var(--cover-fallback)');
          while (colors.length < 3) colors.push('var(--surface-overlay)');
          return (
            <button
              key={series.id}
              onClick={() => nav.push({ screen: 'series', id: series.id })}
              style={{
                ...resetButton,
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-4) var(--page-gutter)',
                borderTop: 'var(--hairline-width) solid var(--hairline)',
                textAlign: 'left',
              }}
              data-hover="raised"
            >
              <span aria-hidden="true" style={{ display: 'flex', gap: 3, flex: 'none' }}>
                {colors.map((color, index) => (
                  <span
                    key={index}
                    style={{
                      width: 6,
                      height: 40,
                      borderRadius: 1,
                      background: color,
                      boxShadow: 'var(--cover-inset)',
                    }}
                  />
                ))}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    ...displayS,
                    fontSize: 'var(--size-display-s)',
                    lineHeight: 'var(--lh-display-s)',
                    display: 'block',
                  }}
                >
                  {series.name}
                </span>
                <span
                  style={{
                    ...caption,
                    color: 'var(--text-secondary)',
                    display: 'block',
                    marginTop: 4,
                  }}
                >
                  {note}
                </span>
              </span>
              <ChevronRight />
            </button>
          );
        })}
        <div style={{ borderTop: 'var(--hairline-width) solid var(--hairline)' }} />
      </section>

      {data.series.length === 0 ? (
        <p
          style={{
            ...caption,
            color: 'var(--text-secondary)',
            margin: 'var(--space-5) var(--page-gutter)',
          }}
        >
          No series are linked to this continuity yet.
        </p>
      ) : null}
    </div>
  );
}

function ReadingOrderCard({
  name,
  body,
  entries = [],
  intro,
}: {
  name: string;
  body?: string;
  entries?: string[];
  intro?: string;
}) {
  return (
    <section
      style={{
        margin: 'var(--space-2) var(--page-gutter) var(--space-4)',
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-card)',
        border: 'var(--hairline-width) solid var(--hairline)',
        background: 'var(--surface-raised)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <h2 style={{ ...label, fontWeight: 400, margin: 0 }}>{name}</h2>
      {intro ? <div style={{ ...caption, color: 'var(--text-secondary)' }}>{intro}</div> : null}
      {body ? (
        <p style={{ margin: 0, fontSize: 'var(--size-body)', lineHeight: 'var(--lh-body)' }}>
          {body}
        </p>
      ) : null}
      {entries.length ? (
        <ol
          style={{
            margin: 'var(--space-1) 0 0',
            paddingLeft: 20,
            color: 'var(--text-secondary)',
            fontSize: 'var(--size-body)',
            lineHeight: 'var(--lh-body)',
          }}
        >
          {entries.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function MissingUniverse() {
  return (
    <div style={{ position: 'absolute', inset: 0, padding: 'var(--space-6) var(--page-gutter)' }}>
      <button
        onClick={() => nav.back()}
        style={{ ...resetButton, ...caption, color: 'var(--accent-text)' }}
      >
        ← Back
      </button>
      <div style={{ ...displayS, marginTop: 'var(--space-5)' }}>That universe is gone</div>
    </div>
  );
}
