import { displayWork } from '../../db/derive';
import { localDay } from '../../db/dates';
import { nav } from '../../router/router';
import { Illustration } from '../illustration';
import { useWork } from '../store';
import { resetButton } from '../styles';

export function Finish({ id }: { id: string }) {
  const row = useWork(id);
  if (!row) return null;
  const { work } = row;
  const d = displayWork(work, row.authorName);
  const unit = work.progressUnit;
  const count = `${work.progressCurrent.toLocaleString('en-US')} ${unit}${work.progressCurrent === 1 ? '' : 's'}`;
  const day = finishDay(work.dateFinished ? localDay(work.dateFinished) : localDay(new Date()));

  return (
    <main
      aria-labelledby="finish-heading"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        gap: 32,
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: '150%',
          transform: 'translate(-50%, -50%)',
          opacity: 0.14,
          pointerEvents: 'none',
        }}
      >
        <Illustration name="cherry-tree-pana" style={{ display: 'block', width: '100%' }} />
      </div>

      <div style={{ position: 'relative', width: 88, height: 88 }}>
        <svg width="88" height="88" viewBox="0 0 88 88" fill="none" aria-hidden="true">
          <circle cx="44" cy="44" r="43" stroke="var(--status-finished)" strokeWidth="1" />
          <path
            className="exl-finish-tick"
            d="M28 45 L39 56 L61 33"
            stroke="var(--status-finished)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="48"
          />
        </svg>
      </div>

      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          textAlign: 'center',
        }}
      >
        <h1
          id="finish-heading"
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontWeight: 'var(--display-vf)' as unknown as number,
            fontSize: 40,
            lineHeight: '44px',
          }}
        >
          Finished
        </h1>
        <div style={{ fontSize: 17, lineHeight: '26px', color: 'var(--text-secondary)' }}>
          {work.title}
        </div>
        <div
          style={{
            fontSize: 'var(--size-caption)',
            lineHeight: 'var(--lh-caption)',
            color: 'var(--text-secondary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {count}, {day}
        </div>
        <span className="exl-sr">{d.statusLabel}</span>
      </div>

      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 320,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <button
          data-hover="accent-border"
          onClick={() => nav.replace({ screen: 'axis', id })}
          style={{
            ...resetButton,
            textAlign: 'center',
            height: 52,
            borderRadius: 'var(--radius-button)',
            border: 'var(--hairline-width) solid var(--hairline-strong)',
            fontSize: 'var(--size-body)',
          }}
        >
          Set the axes
        </button>
        <button
          data-hover="ink"
          onClick={() => nav.back()}
          style={{
            ...resetButton,
            minHeight: 44,
            textAlign: 'center',
            fontSize: 'var(--size-caption)',
            color: 'var(--text-secondary)',
            padding: 12,
          }}
        >
          Later
        </button>
      </div>
    </main>
  );
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

function finishDay(day: string): string {
  const [year, month, date] = day.split('-');
  const monthName = MONTHS[Number(month) - 1];
  if (!year || !monthName || !date) return day;
  return `${Number(date)} ${monthName} ${year}`;
}
