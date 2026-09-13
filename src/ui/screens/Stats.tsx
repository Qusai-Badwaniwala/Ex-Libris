import { useMemo, useState, type ReactNode } from 'react';
import type { GenreStat } from '../../db/repo';
import { nav } from '../../router/router';
import { Illustration } from '../illustration';
import { Menu } from '../icons';
import { useLibraryStats } from '../store';
import { caption, displayL, displayS, resetButton, tabular } from '../styles';

const number = new Intl.NumberFormat();

export function Stats() {
  const stats = useLibraryStats();
  const [genreScope, setGenreScope] = useState<'all' | 'finished'>('all');
  const genreView = useMemo(
    () => describeGenres(stats?.genres[genreScope] ?? []),
    [genreScope, stats?.genres],
  );

  return (
    <div
      className="exl-scroll"
      style={{
        position: 'absolute',
        inset: 0,
        overflowY: 'auto',
        padding: 'calc(var(--space-5) + var(--safe-top)) var(--page-gutter) 112px',
      }}
    >
      <button
        aria-label="Menu"
        onClick={() => nav.open({ kind: 'drawer' })}
        style={{
          ...resetButton,
          width: 44,
          height: 44,
          marginLeft: -10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Menu />
      </button>

      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 16px' }}>
        <Illustration name="knowledge-rafiki" style={{ width: 200, maxWidth: '62%' }} />
      </div>

      <h1 style={{ ...displayL, margin: '0 0 4px' }}>
        {stats?.year ?? new Date().getFullYear()} so far
      </h1>
      <p
        style={{
          margin: '0 0 var(--space-7)',
          fontSize: 'var(--size-body)',
          lineHeight: 'var(--lh-body)',
          color: 'var(--text-secondary)',
        }}
      >
        Counted from the day you started keeping this.
      </p>

      <div
        aria-label="This year's reading figures"
        style={{ display: 'flex', alignItems: 'stretch', gap: 'var(--space-3)', marginBottom: 32 }}
      >
        <PulledFigure value={stats?.finishedThisYear} label="finished" />
        <Rule />
        <PulledFigure value={stats?.chaptersRead} label="chapters read" grow={1.2} />
        <Rule />
        <PulledFigure value={stats?.yearsTracked} label="years tracked" grow={0.8} />
      </div>

      {stats ? (
        <>
          <LedgerGroup
            title="The library"
            rows={[
              ['In the library', number.format(stats.libraryTotal)],
              ['Reading now', number.format(stats.readingNow)],
              ['Caught up, still running', number.format(stats.caughtUp)],
              ['On the wishlist', number.format(stats.wishlistTotal)],
              ['Dropped', number.format(stats.dropped)],
            ]}
          />

          {genreView ? (
            <section style={{ marginTop: 32 }} aria-labelledby="stats-genres">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 'var(--space-3)',
                  marginBottom: 'var(--space-3)',
                }}
              >
                <h2 id="stats-genres" style={{ ...displayS, margin: 0 }}>
                  Genres
                </h2>
                <span style={{ flex: 1 }} />
                <div
                  role="group"
                  aria-label="Genre scope"
                  style={{
                    display: 'flex',
                    border: 'var(--hairline-width) solid var(--hairline)',
                    borderRadius: 'var(--radius-pill)',
                    overflow: 'hidden',
                  }}
                >
                  {(['all', 'finished'] as const).map((scope) => {
                    const selected = genreScope === scope;
                    return (
                      <button
                        key={scope}
                        aria-pressed={selected}
                        onClick={() => setGenreScope(scope)}
                        style={{
                          ...resetButton,
                          minHeight: 32,
                          padding: '5px 12px',
                          fontSize: 'var(--size-label)',
                          background: selected ? 'var(--surface-raised)' : 'transparent',
                          color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}
                      >
                        {scope === 'all' ? 'Everything' : 'Finished'}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div
                aria-label={genreView.label}
                style={{
                  display: 'flex',
                  gap: 0.5,
                  height: 12,
                  borderRadius: 2,
                  overflow: 'hidden',
                  marginBottom: 'var(--space-3)',
                }}
              >
                {genreView.segments.map((segment) => (
                  <span
                    key={segment.key}
                    style={{
                      flex: `${segment.count} 1 0`,
                      minWidth: segment.count / genreView.total < 0.02 ? 0 : 1,
                      background: segment.color,
                    }}
                  />
                ))}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  fontSize: 'var(--size-caption)',
                  lineHeight: 'var(--lh-caption)',
                }}
              >
                {genreView.top.map((genre, index) => (
                  <span
                    key={genre.index}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
                  >
                    {index ? (
                      <span
                        aria-hidden="true"
                        style={{ width: 0.5, height: 12, background: 'var(--hairline-strong)' }}
                      />
                    ) : null}
                    <span>{genre.name}</span>
                    <span style={{ color: 'var(--text-secondary)', ...tabular }}>
                      {genre.count}
                    </span>
                  </span>
                ))}
              </div>
              {genreView.rest ? (
                <p style={{ ...caption, margin: '6px 0 0', color: 'var(--text-secondary)' }}>
                  {genreView.rest}
                </p>
              ) : null}
            </section>
          ) : null}

          <LedgerGroup
            title="Series"
            rows={[
              ['Started', number.format(stats.seriesStarted)],
              ['Completed', number.format(stats.seriesCompleted)],
              ['One entry away', number.format(stats.seriesOneAway)],
            ]}
          />

          {stats.authorsInLibrary ? (
            <LedgerGroup
              title="Authors"
              rows={[
                ...(stats.mostReadAuthor
                  ? ([
                      ['Most read', stats.mostReadAuthor.name, true],
                      ['By that author', number.format(stats.mostReadAuthor.count)],
                    ] as LedgerRowData[])
                  : []),
                ['Authors in the library', number.format(stats.authorsInLibrary)],
              ]}
            />
          ) : null}

          {stats.finishing ? (
            <LedgerGroup
              title="Finishing"
              rows={[
                ['Finished what you started', `${stats.finishing.finished}%`],
                ['Dropped it', `${stats.finishing.dropped}%`],
                ['Still open', `${stats.finishing.open}%`],
              ]}
            />
          ) : null}

          {stats.priorYears.length ? (
            <section style={{ marginTop: 32 }} aria-labelledby="stats-before-year">
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  marginBottom: 'var(--space-2)',
                }}
              >
                <Illustration name="cherry-tree-amico" style={{ width: 140, maxWidth: '44%' }} />
                <h2 id="stats-before-year" style={{ ...displayS, margin: 0 }}>
                  Before this year
                </h2>
              </div>
              {stats.priorYears.map((row, index) => (
                <LedgerRow
                  key={row.year}
                  row={[String(row.year), `${number.format(row.finished)} finished`]}
                  last={index === stats.priorYears.length - 1}
                />
              ))}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function PulledFigure({
  value,
  label,
  grow = 1,
}: {
  value?: number;
  label: string;
  grow?: number;
}) {
  return (
    <div style={{ flex: grow, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ ...displayL, ...tabular }}>
        {value === undefined ? '—' : number.format(value)}
      </div>
      <div style={{ ...caption, color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );
}

function Rule() {
  return (
    <span
      aria-hidden="true"
      style={{ width: 0.5, alignSelf: 'stretch', background: 'var(--hairline)' }}
    />
  );
}

type LedgerRowData = readonly [label: string, value: ReactNode, secondaryLabel?: boolean];

function LedgerGroup({ title, rows }: { title: string; rows: LedgerRowData[] }) {
  return (
    <section
      style={{ marginTop: 32 }}
      aria-labelledby={`stats-${title.toLowerCase().replaceAll(' ', '-')}`}
    >
      <h2
        id={`stats-${title.toLowerCase().replaceAll(' ', '-')}`}
        style={{ ...displayS, margin: '0 0 var(--space-2)' }}
      >
        {title}
      </h2>
      {rows.map((row, index) => (
        <LedgerRow key={row[0]} row={row} last={index === rows.length - 1} />
      ))}
    </section>
  );
}

function LedgerRow({ row, last }: { row: LedgerRowData; last: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 'var(--space-4)',
        minHeight: 48,
        padding: '13px 0',
        borderTop: 'var(--hairline-width) solid var(--hairline)',
        ...(last ? { borderBottom: 'var(--hairline-width) solid var(--hairline)' } : {}),
      }}
    >
      <span style={{ color: row[2] ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
        {row[0]}
      </span>
      <span style={{ flex: 1 }} />
      <span style={{ maxWidth: '52%', textAlign: 'right', overflowWrap: 'anywhere', ...tabular }}>
        {row[1]}
      </span>
    </div>
  );
}

function describeGenres(genres: GenreStat[]) {
  if (!genres.length) return null;
  const sorted = genres
    .slice()
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
  const total = sorted.reduce((sum, genre) => sum + genre.count, 0);
  const thin = sorted.filter((genre) => genre.count / total < 0.02);
  const visible = sorted.filter((genre) => genre.count / total >= 0.02);
  const segments = visible.map((genre) => ({
    key: String(genre.index),
    count: genre.count,
    color: `var(--genre-${genre.index})`,
  }));
  if (thin.length) {
    segments.push({
      key: 'other',
      count: thin.reduce((sum, genre) => sum + genre.count, 0),
      color: 'var(--text-faint)',
    });
  }
  const top = sorted.slice(0, 3);
  const restCount = Math.max(0, sorted.length - top.length);
  const singletons = sorted.slice(3).filter((genre) => genre.count === 1).length;
  const rest = restCount
    ? `and ${restCount} other${restCount === 1 ? '' : 's'}${
        singletons === 1
          ? ', one of which holds one work'
          : singletons > 1
            ? `, of which ${singletons} hold one work each`
            : ''
      }.`
    : '';
  return {
    total,
    segments,
    top,
    rest,
    label: sorted.map((genre) => `${genre.name} ${genre.count}`).join(', '),
  };
}
