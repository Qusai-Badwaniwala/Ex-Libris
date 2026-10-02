import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { readRelationships, sequence } from '../../relationships/library';
import { seriesCompletionFacts } from '../../relationships/completion';
import { nav } from '../../router/router';
import { catalogue } from '../../catalogue/client';
import type { ReadingOrderEntry, Work } from '../../db/schema';
import { displayWork, STATUS_LABEL } from '../../db/derive';
import { Cover, Segmented } from '../components';
import { withInteractionFeedback } from '../interaction-feedback';

export function GroupScreen({ id, kind }: { id: string; kind: 'series' | 'universe' }) {
  const graph = useLiveQuery(readRelationships, []);
  const [view, setView] = useState<'members' | 'orders'>('members');
  const [orderId, setOrderId] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  if (!graph)
    return (
      <main className="room-page">
        <p role="status">Opening this {kind === 'series' ? 'series' : 'world'}…</p>
      </main>
    );
  const group = kind === 'series' ? graph.seriesById.get(id) : graph.worldsById.get(id);
  if (!group)
    return (
      <main className="room-page">
        <button className="room-text" onClick={() => nav.back()}>
          ← Back
        </button>
        <h1>This group is no longer here</h1>
        <p>Your library is still available.</p>
      </main>
    );
  const members = kind === 'series' ? graph.seriesWorks(id) : graph.worldWorks(id);
  const owned = members.filter((work) => work.status !== 'wishlist');
  const wished = members.filter((work) => work.status === 'wishlist');
  const childSeries =
    kind === 'universe' ? graph.series.filter((series) => series.universeId === id) : [];
  const world =
    kind === 'series'
      ? graph.worldsById.get(graph.seriesById.get(id)?.universeId ?? '')
      : undefined;
  const startingPoint =
    kind === 'universe' ? graph.worldsById.get(id)?.readingOrderNote : undefined;
  const orders = graph.orders.filter(
    (order) => order.contextType === kind && order.contextId === id,
  );
  const order = orders.find((order) => order.id === orderId);
  const entries = order
    ? graph.entries
        .filter((entry) => entry.orderId === order.id)
        .sort((a, b) => a.position - b.position)
    : [];
  const known =
    kind === 'series' ? seriesCompletionFacts(graph.seriesById.get(id)!, members) : undefined;
  const knownMissing = graph.entries
    .filter(
      (entry) =>
        orders.some((order) => order.id === entry.orderId) &&
        entry.kind === 'work' &&
        !graph.deletedWorks.some((work) => work.id === entry.workId) &&
        !graph.works.some(
          (work) =>
            work.id === entry.workId || (!!entry.corpusId && work.corpusId === entry.corpusId),
        ),
    )
    .filter(
      (entry, index, rows) =>
        rows.findIndex((row) => (row.corpusId ?? row.id) === (entry.corpusId ?? entry.id)) ===
        index,
    );
  const addMissing = async (entry: ReadingOrderEntry) => {
    if (busy) return;
    if (!entry.corpusId) {
      nav.open({ kind: 'byHand', initialTitle: entry.label });
      return;
    }
    setBusy(entry.id);
    setError('');
    try {
      const evidence = await withInteractionFeedback('Opening the catalogue entry…', () =>
        catalogue.relationship(entry.corpusId!),
      );
      if (!evidence)
        throw new Error('This catalogue entry is unavailable. You can add it by hand.');
      nav.open({
        kind: 'byHand',
        candidate: {
          ...evidence.work,
          seriesName: evidence.series?.name,
          universeName: evidence.universe?.name,
        },
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The catalogue is unavailable. Add this title by hand.',
      );
    } finally {
      setBusy('');
    }
  };
  const renderEntry = (entry: ReadingOrderEntry) => {
    const trashed = graph.deletedWorks.find((work) => work.id === entry.workId);
    if (trashed)
      return (
        <div className="room-group-row" key={entry.id}>
          <span>{entry.position}</span>
          <strong>{trashed.title}</strong>
          <button className="room-text" onClick={() => nav.push({ screen: 'trash' })}>
            In Trash →
          </button>
        </div>
      );
    const work = graph.works.find(
      (work) => work.id === entry.workId || (!!entry.corpusId && work.corpusId === entry.corpusId),
    );
    const series = entry.seriesId ? graph.seriesById.get(entry.seriesId) : undefined;
    if (work)
      return (
        <GroupWork
          key={entry.id}
          work={work}
          author={graph.authorLine(work)}
          ordinal={entry.position}
        />
      );
    if (series)
      return (
        <button
          className="room-group-row"
          key={entry.id}
          onClick={() => nav.push({ screen: 'series', id: series.id })}
        >
          <span>{entry.position}</span>
          <strong>{series.name}</strong>
          <span>Series →</span>
        </button>
      );
    return (
      <div className="room-group-row room-group-missing" key={entry.id}>
        <span>{entry.position}</span>
        <div>
          <strong>{entry.label}</strong>
          <small>Not in your library</small>
        </div>
        <button className="room-text" disabled={!!busy} onClick={() => void addMissing(entry)}>
          {busy === entry.id ? 'Opening…' : 'Add'}
        </button>
      </div>
    );
  };
  return (
    <main className="room-page room-group exl-scroll">
      <div className="room-section-heading">
        <button className="room-text" onClick={() => nav.back()}>
          ← Back
        </button>
        <button
          className="room-text"
          onClick={() => nav.open({ kind: 'groupOrganiser', id, contextType: kind })}
        >
          Organise
        </button>
      </div>
      <header className="room-group-heading">
        <div>
          <p className="room-eyebrow">
            {kind === 'series' ? 'A series in your library' : 'A world in your library'}
          </p>
          <h1>{group.name}</h1>
          {world && (
            <button
              className="room-text"
              onClick={() => nav.push({ screen: 'universe', id: world.id })}
            >
              {world.name} →
            </button>
          )}
          <p>
            {owned.length} in your library ·{' '}
            {owned.filter((work) => work.status === 'finished').length} finished
            {wished.length ? ` · ${wished.length} on Wishlist` : ''}
          </p>
          {known?.totalEntriesKnown !== undefined && (
            <small>
              {known.finished} of {known.totalEntriesKnown} known entries finished
            </small>
          )}
        </div>
        <div className="room-group-covers" aria-hidden="true">
          {owned.slice(0, 3).map((work) => {
            const d = displayWork(work);
            return (
              <Cover
                key={work.id}
                color={d.coverColor}
                ink={d.coverInk}
                path={work.coverPath}
                title={work.title}
                width={100}
                height={150}
              />
            );
          })}
        </div>
      </header>
      {members.some((work) => graph.relation(work).conflict) && (
        <p className="room-organise-preview" role="status">
          Some entries have a legacy world that differs from their series. Open the entry’s
          organiser to review and resolve it.
        </p>
      )}
      <Segmented
        ariaLabel="Group view"
        value={view}
        options={[
          { value: 'members' as const, label: 'Library' },
          { value: 'orders' as const, label: 'Reading orders' },
        ]}
        onChange={setView}
      />
      {view === 'members' ? (
        <>
          {startingPoint && (
            <section className="room-group-start">
              <h2>Where to begin</h2>
              <p>{startingPoint}</p>
            </section>
          )}
          {kind === 'universe' && (
            <section aria-label="Series in this world">
              {childSeries.map((series) => {
                const works = graph.seriesWorks(series.id);
                const facts = seriesCompletionFacts(series, works);
                return (
                  <button
                    className="room-group-series"
                    key={series.id}
                    onClick={() => nav.push({ screen: 'series', id: series.id })}
                  >
                    <div>
                      <h2>{series.name}</h2>
                      <p>
                        {facts.owned} in your library · {facts.finished} finished
                      </p>
                    </div>
                    <span aria-hidden="true">↗</span>
                  </button>
                );
              })}
            </section>
          )}
          <section aria-label="Series entries">
            {(kind === 'series' ? owned : owned.filter((work) => !work.seriesId))
              .sort(sequence)
              .map((work) => (
                <GroupWork
                  key={work.id}
                  work={work}
                  author={graph.authorLine(work)}
                  ordinal={work.seriesPosition}
                />
              ))}
          </section>
          {!members.length && (
            <p>
              No works belong here yet. Use Organise to add entries from your library or Wishlist.
            </p>
          )}
          {wished.length > 0 && (
            <section>
              <h2>On your Wishlist</h2>
              {wished
                .filter((work) => kind === 'series' || !work.seriesId)
                .map((work) => (
                  <GroupWork
                    key={work.id}
                    work={work}
                    author={graph.authorLine(work)}
                    ordinal={work.seriesPosition}
                  />
                ))}
            </section>
          )}
          {knownMissing.length > 0 && (
            <details>
              <summary>Known entries outside your library · {knownMissing.length}</summary>
              {knownMissing.map(renderEntry)}
            </details>
          )}
        </>
      ) : (
        <section className="room-group-orders">
          <div className="room-section-heading">
            <h2>Choose a reading order</h2>
            <button
              className="room-text"
              onClick={() => nav.open({ kind: 'readingOrderEditor', id, contextType: kind })}
            >
              Manage orders
            </button>
          </div>
          <p>
            Membership does not prescribe a reading order. Choose a named sequence, or follow the
            series entry numbers in Library.
          </p>
          {orders.length ? (
            <label>
              Named order
              <select value={orderId} onChange={(event) => setOrderId(event.target.value)}>
                <option value="">Choose an order</option>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p>No named orders yet. Add one when you have a sequence you want to keep.</p>
          )}
          {order?.description && <p>{order.description}</p>}
          {entries.map(renderEntry)}
        </section>
      )}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button className="room-text" onClick={() => nav.open({ kind: 'byHand' })}>
            Add by hand
          </button>
        </div>
      )}
    </main>
  );
}

function GroupWork({ work, author, ordinal }: { work: Work; author: string; ordinal?: number }) {
  const d = displayWork(work, author);
  return (
    <button className="room-group-row" onClick={() => nav.push({ screen: 'detail', id: work.id })}>
      <span className="room-group-number">{ordinal ?? '—'}</span>
      <Cover color={d.coverColor} ink={d.coverInk} path={work.coverPath} width={46} height={69} />
      <span className="room-group-record">
        <strong>{work.title}</strong>
        <small>{author || 'Author unknown'}</small>
        <small>
          {STATUS_LABEL[work.status]} · {d.shortProgress}
          {ordinal === undefined && work.seriesId ? ' · Unnumbered' : ''}
        </small>
      </span>
      <span aria-hidden="true">↗</span>
    </button>
  );
}
