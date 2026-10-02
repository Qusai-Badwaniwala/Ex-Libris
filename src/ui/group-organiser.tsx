import { useEffect, useRef, useState } from 'react';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { readRelationships } from '../relationships/library';
import { assertOrganisation, mergeGroups, saveGroup } from '../relationships/organise';
import * as repo from '../db/repo';
import { createSafetyBackup } from '../data-safety/backup';
import { APP_VERSION } from './store';
import { Field, Sheet } from './components';
import { guardOverlayDismiss, nav } from '../router/router';
import { withInteractionFeedback } from './interaction-feedback';

export function GroupOrganiser({ id, kind }: { id: string; kind: 'series' | 'universe' }) {
  const graph = useLiveQuery(readRelationships, []);
  const group = kind === 'series' ? graph?.seriesById.get(id) : graph?.worldsById.get(id);
  const [name, setName] = useState('');
  const [world, setWorld] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<string[]>([]);
  const [positions, setPositions] = useState<Record<string, string>>({});
  const [startingPoint, setStartingPoint] = useState('');
  const [revision, setRevision] = useState('');
  const [query, setQuery] = useState('');
  const [merge, setMerge] = useState('');
  const [review, setReview] = useState<'save' | 'merge' | 'delete'>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [initialDraft, setInitialDraft] = useState('');
  const [discard, setDiscard] = useState(false);
  const bypassGuard = useRef(false);
  const draft = JSON.stringify([name, world, selected, selectedSeries, positions, startingPoint]);
  const dirty = !!initialDraft && draft !== initialDraft;
  useEffect(
    () =>
      guardOverlayDismiss('groupOrganiser', () => {
        if (bypassGuard.current) return true;
        if (busy) return false;
        if (!dirty) return true;
        setDiscard((value) => !value);
        return false;
      }),
    [busy, dirty],
  );
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);
  useEffect(() => {
    if (discard) document.querySelector<HTMLButtonElement>('[data-keep-organisation]')?.focus();
  }, [discard]);
  useEffect(() => {
    if (!graph || !group || revision) return;
    setRevision(group.updatedAt);
    setOrganisation(graph.revision);
    setName(group.name);
    setWorld(graph.seriesById.get(id)?.universeId ?? '');
    setStartingPoint(graph.worldsById.get(id)?.readingOrderNote ?? '');
    const members =
      kind === 'series'
        ? graph.seriesWorks(id)
        : graph.worldWorks(id).filter((work) => !work.seriesId);
    setSelected(members.map((work) => work.id));
    setPositions(
      Object.fromEntries(members.map((work) => [work.id, work.seriesPosition?.toString() ?? ''])),
    );
    setSelectedSeries(
      graph.series.filter((series) => series.universeId === id).map((series) => series.id),
    );
    setInitialDraft(
      JSON.stringify([
        group.name,
        graph.seriesById.get(id)?.universeId ?? '',
        members.map((work) => work.id),
        graph.series.filter((series) => series.universeId === id).map((series) => series.id),
        Object.fromEntries(members.map((work) => [work.id, work.seriesPosition?.toString() ?? ''])),
        graph.worldsById.get(id)?.readingOrderNote ?? '',
      ]),
    );
  }, [graph, group, id, kind, revision]);
  useEffect(
    () => setReview(undefined),
    [name, world, selected, selectedSeries, positions, startingPoint, merge],
  );
  if (!graph)
    return (
      <Sheet title="Organiser" onClose={() => nav.close()}>
        <p role="status">Opening your groups…</p>
      </Sheet>
    );
  if (!group)
    return (
      <Sheet title="Organiser" onClose={() => nav.close()}>
        <p>This group no longer exists.</p>
      </Sheet>
    );
  const candidates = graph.works.filter(
    (work) =>
      (kind === 'series' || !work.seriesId) &&
      work.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const otherGroups = (kind === 'series' ? graph.series : graph.worlds).filter(
    (row) => row.id !== id,
  );
  const toggle = (values: string[], value: string) =>
    values.includes(value) ? values.filter((id) => id !== value) : [...values, value];
  const invalid = Object.entries(positions).some(
    ([id, value]) =>
      selected.includes(id) &&
      value.trim() &&
      (!Number.isFinite(Number(value)) || Number(value) <= 0),
  );
  const apply = async () => {
    if (!review || busy) return;
    setBusy(true);
    setError('');
    try {
      await withInteractionFeedback('Saving the organisation…', async () => {
        if (review !== 'save') await createSafetyBackup(APP_VERSION);
        if (review !== 'save')
          await db.transaction(
            'rw',
            [db.work, db.series, db.universe, db.readingOrder, db.readingOrderEntry],
            async () => {
              await assertOrganisation(organisation);
              if (review === 'merge') await mergeGroups(kind, id, merge);
              else await (kind === 'series' ? repo.deleteSeries(id) : repo.deleteUniverse(id));
            },
          );
        else
          await saveGroup({
            kind,
            id,
            name,
            worldId: world || undefined,
            workIds: selected,
            seriesIds: selectedSeries,
            positions: Object.fromEntries(
              Object.entries(positions).map(([id, value]) => [
                id,
                value.trim() ? Number(value) : undefined,
              ]),
            ),
            startingPoint,
            expectedRevision: revision,
            expectedOrganisation: organisation,
          });
      });
      bypassGuard.current = true;
      if (review === 'save') nav.close();
      else
        nav.closeAndPush(
          review === 'merge' ? { screen: kind, id: merge } : { screen: 'everything' },
        );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The change could not be saved. Your choices remain here.',
      );
    } finally {
      setBusy(false);
    }
  };
  if (discard)
    return (
      <Sheet title="Discard unsaved organisation?" onClose={() => setDiscard(false)}>
        <h2>Keep your changes?</h2>
        <p>Your organisation has not been saved.</p>
        <button className="room-primary" data-keep-organisation onClick={() => setDiscard(false)}>
          Keep editing
        </button>
        <button
          className="room-text"
          onClick={() => {
            bypassGuard.current = true;
            nav.close();
          }}
        >
          Discard changes
        </button>
      </Sheet>
    );
  return (
    <Sheet
      title={`Organise ${group.name}`}
      onClose={() => {
        if (!busy) nav.close();
      }}
      maxHeight="92%"
    >
      <fieldset
        className="room-organiser"
        disabled={busy}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
        <h2>Organise {kind === 'series' ? 'series' : 'world'}</h2>
        <Field label="Name" value={name} onChange={setName} />
        {kind === 'series' ? (
          <label>
            World
            <select value={world} onChange={(event) => setWorld(event.target.value)}>
              <option value="">No shared world</option>
              {graph.worlds.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <Field
            label="Where to begin"
            value={startingPoint}
            onChange={setStartingPoint}
            placeholder="Optional guidance, in your own words"
          />
        )}
        {kind === 'universe' && (
          <fieldset>
            <legend>Series in this world</legend>
            {graph.series.map((series) => (
              <label className="room-member" key={series.id}>
                <input
                  type="checkbox"
                  checked={selectedSeries.includes(series.id)}
                  onChange={() => setSelectedSeries(toggle(selectedSeries, series.id))}
                />
                <span>{series.name}</span>
              </label>
            ))}
          </fieldset>
        )}
        <Field
          label={kind === 'series' ? 'Find library or Wishlist entries' : 'Find standalone entries'}
          value={query}
          onChange={setQuery}
        />
        <fieldset>
          <legend>
            {selected.length} selected {kind === 'series' ? 'entries' : 'standalone works'}
          </legend>
          {candidates.map((work) => (
            <div className="room-member" key={work.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.includes(work.id)}
                  onChange={() => setSelected(toggle(selected, work.id))}
                />
                <span>
                  {work.title}
                  <small>
                    {graph.seriesById.get(work.seriesId ?? '')?.name ?? 'Standalone'} ·{' '}
                    {work.status === 'wishlist' ? 'Wishlist' : 'In library'}
                  </small>
                </span>
              </label>
              {kind === 'series' && selected.includes(work.id) && (
                <input
                  aria-label={`Entry number for ${work.title}`}
                  placeholder="No."
                  inputMode="decimal"
                  value={positions[work.id] ?? ''}
                  onChange={(event) =>
                    setPositions({ ...positions, [work.id]: event.target.value })
                  }
                />
              )}
            </div>
          ))}
        </fieldset>
        {invalid && <p role="alert">Entry numbers must be positive, or empty.</p>}
        {review && (
          <div className="room-organise-preview" role="status">
            <strong>
              {review === 'save'
                ? 'Review membership'
                : review === 'merge'
                  ? 'Review merge'
                  : 'Review deletion'}
            </strong>
            <p>
              {review === 'save'
                ? `${selected.length} selected works${kind === 'universe' ? ` and ${selectedSeries.length} series` : ''} will belong to ${name}. Removed members keep their books, progress and notes. Moving a work changes its primary series; moving a series changes its inherited world.`
                : review === 'merge'
                  ? `Merge ${group.name} into ${otherGroups.find((row) => row.id === merge)?.name}. All members and named orders move. A series merge clears its unverified total. A complete safety backup is required first.`
                  : `Delete ${group.name} and its named orders. All works and notes remain. A complete safety backup is required first.`}
            </p>
            {review === 'save' && (
              <>
                <p>
                  World: {kind === 'series' ? (graph.worldsById.get(world)?.name ?? 'None') : name}
                </p>
                <ul>
                  {graph.series
                    .filter(
                      (series) =>
                        kind === 'universe' &&
                        (selectedSeries.includes(series.id) || series.universeId === id),
                    )
                    .map((series) => (
                      <li key={series.id}>
                        {series.name} ·{' '}
                        {selectedSeries.includes(series.id)
                          ? 'Included series'
                          : 'Leaving this world'}
                      </li>
                    ))}
                  {graph.works
                    .filter(
                      (work) =>
                        selected.includes(work.id) ||
                        (kind === 'series'
                          ? work.seriesId === id
                          : !work.seriesId && work.universeId === id),
                    )
                    .map((work) => (
                      <li key={work.id}>
                        {work.title}
                        {selected.includes(work.id)
                          ? `${positions[work.id] ? ` · ${positions[work.id]}` : ''} · Included`
                          : ' · Leaving this group'}
                      </li>
                    ))}
                </ul>
              </>
            )}
            {review !== 'save' && (
              <ul>
                {(kind === 'series' ? graph.seriesWorks(id) : graph.worldWorks(id)).map((work) => (
                  <li key={work.id}>{work.title}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {error && <p role="alert">{error}</p>}
        <button
          className="room-primary"
          disabled={busy || invalid || !name.trim()}
          onClick={() => (review ? void apply() : setReview('save'))}
        >
          {busy ? 'Saving…' : review ? 'Confirm changes' : 'Review changes'}
        </button>
        <details>
          <summary>Merge or remove this group</summary>
          <label>
            Merge into
            <select value={merge} onChange={(event) => setMerge(event.target.value)}>
              <option value="">Choose a destination</option>
              {otherGroups.map((row) => (
                <option value={row.id} key={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="room-text"
            disabled={!merge || busy}
            onClick={() => setReview('merge')}
          >
            Review merge
          </button>
          <button className="room-text" disabled={busy} onClick={() => setReview('delete')}>
            Review group deletion
          </button>
        </details>
      </fieldset>
    </Sheet>
  );
}
