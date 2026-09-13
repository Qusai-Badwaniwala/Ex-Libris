import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AXES, axisWord, type AxisDefinition, type AxisKey } from '../../axes/axes';
import { db } from '../../db/db';
import * as repo from '../../db/repo';
import type { AxisScore } from '../../db/schema';
import { nav } from '../../router/router';
import { tickStops } from '../haptics';
import { caption, resetButton } from '../styles';
import { withInteractionFeedback } from '../interaction-feedback';

export function AxisScreen({ id, initialKey }: { id: string; initialKey?: AxisKey }) {
  const data = useLiveQuery(async () => {
    const [work, rating] = await Promise.all([db.work.get(id), db.axisRating.get(id)]);
    return work ? { work, rating } : null;
  }, [id]);
  const [index, setIndex] = useState(() =>
    Math.max(0, initialKey ? AXES.findIndex(({ key }) => key === initialKey) : 0),
  );
  const [value, setValue] = useState<AxisScore>();
  const [unfinished, setUnfinished] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const initializedKey = useRef<AxisKey | undefined>(undefined);

  const axis = AXES[index]!;
  useEffect(() => {
    if (!data || initializedKey.current === axis.key) return;
    initializedKey.current = axis.key;
    setValue(data.rating?.[axis.key]);
    setUnfinished(axis.key === 'ending' && data.rating?.endingNone === true);
    setError('');
  }, [axis.key, data]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') nav.back();
    };
    addEventListener('keydown', onKeyDown);
    return () => removeEventListener('keydown', onKeyDown);
  }, []);

  if (data === undefined) return null;
  if (data === null) {
    return (
      <div style={{ position: 'absolute', inset: 0, padding: 'var(--space-6)' }}>
        <button onClick={() => nav.back()} style={{ ...resetButton, ...caption }}>
          Back
        </button>
      </div>
    );
  }

  const endingLocked = axis.key === 'ending' && data.work.status !== 'finished';
  const setScore = (next: AxisScore) => {
    if (endingLocked) return;
    const previous = value;
    const crossings = previous === undefined ? 1 : Math.max(1, Math.abs(next - previous));
    if (previous !== next) tickStops(crossings);
    setValue(next);
    if (axis.key === 'ending') setUnfinished(false);
  };

  const persist = async () => {
    if (endingLocked) return;
    const changes: repo.AxisRatingChanges = { [axis.key]: value };
    if (axis.key === 'ending') changes.endingNone = unfinished;
    await withInteractionFeedback('Saving the reading profile…', () =>
      repo.saveAxisRating(id, changes),
    );
  };

  const move = (direction: -1 | 1) => {
    if (saving) return;
    setSaving(true);
    setError('');
    void persist()
      .then(() => {
        const next = index + direction;
        if (next < 0) nav.back();
        else if (next >= AXES.length) nav.back();
        else setIndex(next);
      })
      .catch(() => setError('This axis could not be saved. Your previous profile is unchanged.'))
      .finally(() => setSaving(false));
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60 }}>
      <button
        aria-label="Close axes"
        data-dismiss-scrim
        onClick={() => nav.back()}
        style={{ ...resetButton, position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${axis.name} axis`}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: 'calc(100% - var(--safe-top))',
          overflowY: 'auto',
          background: 'var(--surface-overlay)',
          borderRadius: 'var(--radius-sheet) var(--radius-sheet) 0 0',
          boxShadow: 'var(--shadow-sheet)',
          padding: '8px 0 calc(24px + var(--safe-bottom))',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 8 }}>
          <div
            style={{
              width: 32,
              height: 4,
              borderRadius: 999,
              background: 'var(--hairline-strong)',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px var(--space-4)',
          }}
        >
          <span style={caption}>{axis.name}</span>
          <button
            disabled={endingLocked}
            onClick={() => {
              setValue(undefined);
              setUnfinished(false);
            }}
            style={{
              ...resetButton,
              ...caption,
              minWidth: 44,
              minHeight: 44,
              textAlign: 'right',
              color: endingLocked ? 'var(--text-faint)' : 'var(--text-secondary)',
            }}
          >
            Clear
          </button>
        </div>

        <div
          style={{
            minHeight: 104,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 var(--space-4)',
            textAlign: 'center',
          }}
        >
          <div
            key={unfinished ? 'unfinished' : (value ?? 'unset')}
            className="exl-axis-word"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 'var(--display-vf)' as unknown as number,
              fontSize: 40,
              lineHeight: '44px',
              color: value || unfinished ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            {endingLocked
              ? 'Finish it first'
              : unfinished
                ? 'Unfinished'
                : value
                  ? axisWord(axis.key, value)
                  : 'Not set'}
          </div>
        </div>

        <AxisTrack axis={axis} value={value} disabled={endingLocked} onChange={setScore} />

        <div
          style={{
            padding: 'var(--space-5) var(--space-4) 0',
            ...caption,
            color: 'var(--text-secondary)',
            textWrap: 'pretty',
          }}
        >
          {endingLocked
            ? 'The ending becomes available after this work is marked Finished.'
            : axis.key === 'ending'
              ? 'The only axis that judges. Everything above is appetite, not quality.'
              : `Neither end is better. ${axis.low} is not worse than ${axis.high}.`}
        </div>

        {axis.key === 'ending' && !endingLocked ? (
          <div style={{ padding: 'var(--space-4) var(--space-4) 0' }}>
            <button
              aria-pressed={unfinished}
              onClick={() => {
                setUnfinished((current) => !current);
                setValue(undefined);
              }}
              style={{
                ...resetButton,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                minHeight: 48,
                borderRadius: 'var(--radius-button)',
                border: `var(--hairline-width) solid ${unfinished ? 'var(--accent)' : 'var(--hairline)'}`,
                width: '100%',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: unfinished ? 'var(--accent)' : 'var(--hairline-strong)',
                }}
              />
              <span style={{ flex: 1, fontSize: 'var(--size-body)' }}>Unfinished</span>
              <span style={{ ...caption, color: 'var(--text-secondary)' }}>the author stopped</span>
            </button>
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            style={{ ...caption, color: 'var(--danger-text)', padding: '12px 16px 0' }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 8, padding: '24px 16px 0' }}>
          <button
            disabled={saving}
            onClick={() => move(-1)}
            style={{
              ...resetButton,
              height: 44,
              padding: '0 16px',
              borderRadius: 'var(--radius-button)',
              border: 'var(--hairline-width) solid var(--hairline)',
              color: 'var(--text-secondary)',
              fontSize: 'var(--size-body)',
            }}
          >
            Back
          </button>
          <button
            data-active="accent"
            disabled={saving}
            onClick={() => move(1)}
            style={{
              ...resetButton,
              flex: 1,
              height: 44,
              textAlign: 'center',
              borderRadius: 'var(--radius-button)',
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              fontSize: 'var(--size-body)',
              fontWeight: 500,
            }}
          >
            {index === AXES.length - 1 ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AxisTrack({
  axis,
  value,
  disabled,
  onChange,
}: {
  axis: AxisDefinition;
  value: AxisScore | undefined;
  disabled: boolean;
  onChange: (value: AxisScore) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => track.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [axis.key]);
  const setFromX = (clientX: number) => {
    const bounds = track.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0) return;
    const fraction = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width));
    onChange((Math.round(fraction * 4) + 1) as AxisScore);
  };
  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setFromX(event.clientX);
  };

  return (
    <>
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label={axis.name}
        aria-disabled={disabled}
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={value ?? 1}
        aria-valuetext={value ? axisWord(axis.key, value) : 'Not set'}
        onPointerDown={down}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) setFromX(event.clientX);
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === 'Delete' || event.key === 'Backspace') return;
          let next: AxisScore | undefined;
          if (event.key === 'Home') next = 1;
          if (event.key === 'End') next = 5;
          if (event.key === 'ArrowLeft' || event.key === 'ArrowDown')
            next = Math.max(1, (value ?? 2) - 1) as AxisScore;
          if (event.key === 'ArrowRight' || event.key === 'ArrowUp')
            next = Math.min(5, (value ?? 0) + 1) as AxisScore;
          if (next !== undefined) {
            event.preventDefault();
            onChange(next);
          }
        }}
        style={{
          position: 'relative',
          height: 56,
          margin: '0 32px',
          touchAction: 'none',
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 27,
            height: 'var(--hairline-width)',
            background: 'var(--hairline-strong)',
          }}
        />
        {axis.words.map((word, stop) => {
          const score = (stop + 1) as AxisScore;
          return (
            <div
              key={word}
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 22,
                left: `${stop * 25}%`,
                width: 10,
                height: 10,
                marginLeft: -5,
                borderRadius: 999,
                background: value && score <= value ? 'var(--accent)' : 'var(--hairline-strong)',
              }}
            />
          );
        })}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 14,
            left: `${((value ?? 1) - 1) * 25}%`,
            width: 26,
            height: 26,
            marginLeft: -13,
            borderRadius: 999,
            background: value ? 'var(--accent)' : 'transparent',
            border: `1px solid ${value ? 'var(--accent)' : 'var(--hairline-strong)'}`,
            boxShadow: value ? 'var(--shadow-fab)' : 'none',
            transition: 'left var(--dur-fast) var(--ease-snap)',
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '4px 32px 0',
          fontSize: 'var(--size-label)',
          lineHeight: 'var(--lh-label)',
          color: 'var(--text-secondary)',
        }}
      >
        <span>{axis.low}</span>
        <span>{axis.high}</span>
      </div>
    </>
  );
}
