import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import * as repo from '../db/repo';
import { Field, Sheet } from './components';
import { withInteractionFeedback } from './interaction-feedback';
import { caption, displayS, label, resetButton } from './styles';
import { organiseWork } from '../relationships/organise';
import { membership, readRelationships } from '../relationships/library';
import { DiscardDraft, useDraftGuard } from './draft-guard';

export function RelationshipEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const data = useLiveQuery(async () => {
    const graph = await readRelationships();
    const work = await db.work.get(id);
    if (!work) return null;
    const [series, universe, allSeries, allUniverses] = await Promise.all([
      work.seriesId ? db.series.get(work.seriesId) : undefined,
      work.universeId ? db.universe.get(work.universeId) : undefined,
      repo.listSeries(),
      repo.listUniverses(),
    ]);
    const inherited = series?.universeId ? await db.universe.get(series.universeId) : undefined;
    const members = series ? await db.work.where('seriesId').equals(series.id).toArray() : [];
    return {
      graph,
      work,
      series,
      universe: inherited ?? universe,
      allSeries,
      allUniverses,
      members,
      conflict: membership(work, series).conflict,
    };
  }, [id]);
  const [seriesName, setSeriesName] = useState('');
  const [position, setPosition] = useState('');
  const [universeName, setUniverseName] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [organisation, setOrganisation] = useState('');
  const guard = useDraftGuard(
    initialized &&
      !!data &&
      (seriesName !== (data.series?.name ?? '') ||
        position !== (data.work.seriesPosition?.toString() ?? '') ||
        universeName !== (data.universe?.name ?? '')),
    saving,
    'seriesPicker',
  );
  useEffect(() => setReviewing(false), [seriesName, position, universeName]);

  useEffect(() => {
    if (!data || initialized) return;
    setSeriesName(data.series?.name ?? '');
    setPosition(data.work.seriesPosition?.toString() ?? '');
    setUniverseName(data.universe?.name ?? '');
    setInitialized(true);
    setOrganisation(data.graph.revision);
  }, [data, initialized]);

  if (guard.confirm) return <DiscardDraft guard={guard} />;
  if (!data) return null;
  const validPosition =
    position.trim() === '' || (/^\d+(?:\.\d+)?$/.test(position) && Number(position) > 0);

  const save = async () => {
    if (!validPosition || saving) return;
    setSaving(true);
    setError('');
    try {
      await withInteractionFeedback('Saving the relationships…', async () => {
        await organiseWork(id, {
          seriesName,
          worldName: universeName,
          position: position.trim() ? Number(position) : undefined,
          expectedOrganisation: organisation,
        });
      });
      guard.allow();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Those relationships could not be saved. Your entries are still here; try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title="Organise this work" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={displayS}>Series and world</div>
        <p style={{ ...caption, color: 'var(--text-secondary)', margin: 0 }}>
          Nothing is inferred here. Choose an existing name or write the relationship you know.
        </p>
      </div>
      {data.conflict && (
        <p role="status">
          This work has a legacy world that differs from its series. Review the world below; saving
          resolves the conflict for this work.
        </p>
      )}
      <Field
        label="Series"
        value={seriesName}
        onChange={setSeriesName}
        placeholder="Leave empty for a standalone work"
      />
      {data.allSeries.length ? (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={label}>Existing series</span>
          <select
            value=""
            onChange={(event) => {
              setSeriesName(event.target.value);
              const selected = data.allSeries.find((item) => item.name === event.target.value);
              setUniverseName(
                data.allUniverses.find((item) => item.id === selected?.universeId)?.name ?? '',
              );
              setReviewing(false);
            }}
            style={selectStyle}
          >
            <option value="">Choose one</option>
            {data.allSeries.map((series) => (
              <option key={series.id} value={series.name}>
                {series.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <Field
        label="Entry number"
        value={position}
        onChange={setPosition}
        inputMode="numeric"
        placeholder="For example, 2 or 1.5"
        note={
          validPosition
            ? 'Optional. Decimals are allowed for between-book stories.'
            : 'Use a positive number, or leave it empty.'
        }
      />
      <Field label="World" value={universeName} onChange={setUniverseName} placeholder="Optional" />
      {data.allUniverses.length ? (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={label}>Existing worlds</span>
          <select
            value=""
            onChange={(event) => setUniverseName(event.target.value)}
            style={selectStyle}
          >
            <option value="">Choose one</option>
            {data.allUniverses.map((universe) => (
              <option key={universe.id} value={universe.name}>
                {universe.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {error ? (
        <p role="alert" style={{ ...caption, color: 'var(--danger-text)', margin: 0 }}>
          {error}
        </p>
      ) : null}
      {reviewing && (
        <div className="room-organise-preview" role="status">
          <strong>{data.work.title}</strong>
          <p>
            {seriesName.trim()
              ? `Series: ${seriesName.trim()}${position ? ` · entry ${position}` : ' · unnumbered'}`
              : 'Standalone work'}
            <br />
            World: {universeName.trim() || 'None'}
          </p>
          {seriesName.trim() && (
            <>
              <p>
                The world applies to the entire selected series. Its other members will inherit this
                world. No reading progress, notes or books are removed.
              </p>
              <ul>
                {data.graph
                  .seriesWorks(
                    data.allSeries.find(
                      (series) =>
                        series.name.toLocaleLowerCase() === seriesName.trim().toLocaleLowerCase(),
                    )?.id ?? '',
                  )
                  .filter((work) => work.id !== id)
                  .map((work) => (
                    <li key={work.id}>{work.title}</li>
                  ))}
              </ul>
            </>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button
          onClick={onClose}
          style={{
            ...resetButton,
            width: 96,
            height: 48,
            border: 'var(--hairline-width) solid var(--hairline-strong)',
            borderRadius: 'var(--radius-button)',
            color: 'var(--text-secondary)',
          }}
        >
          Cancel
        </button>
        <button
          disabled={!validPosition || saving}
          onClick={() => (reviewing ? void save() : setReviewing(true))}
          style={{
            ...resetButton,
            flex: 1,
            height: 48,
            borderRadius: 'var(--radius-button)',
            background: validPosition && !saving ? 'var(--accent)' : 'var(--surface-raised)',
            color: validPosition && !saving ? 'var(--on-accent)' : 'var(--text-faint)',
          }}
        >
          {saving ? 'Saving…' : reviewing ? 'Confirm organisation' : 'Review changes'}
        </button>
      </div>
    </Sheet>
  );
}

const selectStyle: React.CSSProperties = {
  minHeight: 44,
  width: '100%',
  color: 'var(--text-primary)',
  background: 'var(--surface-sunken)',
  border: 'var(--hairline-width) solid var(--hairline-strong)',
  borderRadius: 'var(--radius-button)',
  padding: '0 12px',
  font: 'inherit',
};
