import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import * as repo from '../db/repo';
import { Field, Sheet } from './components';
import { withInteractionFeedback } from './interaction-feedback';
import { caption, displayS, label, resetButton } from './styles';

export function RelationshipEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const data = useLiveQuery(async () => {
    const work = await db.work.get(id);
    if (!work) return null;
    const [series, universe, allSeries, allUniverses] = await Promise.all([
      work.seriesId ? db.series.get(work.seriesId) : undefined,
      work.universeId ? db.universe.get(work.universeId) : undefined,
      repo.listSeries(),
      repo.listUniverses(),
    ]);
    return { work, series, universe, allSeries, allUniverses };
  }, [id]);
  const [seriesName, setSeriesName] = useState('');
  const [position, setPosition] = useState('');
  const [universeName, setUniverseName] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!data || initialized) return;
    setSeriesName(data.series?.name ?? '');
    setPosition(data.work.seriesPosition?.toString() ?? '');
    setUniverseName(data.universe?.name ?? '');
    setInitialized(true);
  }, [data, initialized]);

  if (!data) return null;
  const validPosition =
    position.trim() === '' || (/^\d+(?:\.\d+)?$/.test(position) && Number(position) > 0);

  const save = async () => {
    if (!validPosition || saving) return;
    setSaving(true);
    setError('');
    try {
      await withInteractionFeedback('Saving the relationships…', async () => {
        const cleanSeries = seriesName.trim();
        const cleanUniverse = universeName.trim();
        const series = cleanSeries ? await repo.seriesByName(cleanSeries) : undefined;
        const universe = cleanUniverse ? await repo.universeByName(cleanUniverse) : undefined;
        await repo.setSeries(id, {
          seriesId: series?.id,
          seriesPosition: series && position.trim() ? Number(position) : undefined,
        });
        await repo.setUniverse(id, universe?.id);
        if (series) await repo.linkSeriesToUniverse(series.id, universe?.id);
      });
      onClose();
    } catch {
      setError('Those relationships could not be saved. Your entries are still here; try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title="Series and universe" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={displayS}>Series and universe</div>
        <p style={{ ...caption, color: 'var(--text-secondary)', margin: 0 }}>
          Nothing is inferred here. Choose an existing name or write the relationship you know.
        </p>
      </div>
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
            onChange={(event) => setSeriesName(event.target.value)}
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
      <Field
        label="Universe or continuity"
        value={universeName}
        onChange={setUniverseName}
        placeholder="Optional"
      />
      {data.allUniverses.length ? (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={label}>Existing universes</span>
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
          onClick={() => void save()}
          style={{
            ...resetButton,
            flex: 1,
            height: 48,
            borderRadius: 'var(--radius-button)',
            background: validPosition && !saving ? 'var(--accent)' : 'var(--surface-raised)',
            color: validPosition && !saving ? 'var(--on-accent)' : 'var(--text-faint)',
          }}
        >
          {saving ? 'Saving…' : 'Save relationships'}
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
