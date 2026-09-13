import { useEffect, useMemo, useRef, useState } from 'react';
import { GENRES } from '../../data/taxonomy';
import { STATUS_LABEL, displayWork } from '../../db/derive';
import type { Format, GenreIndex } from '../../db/schema';
import { nav, useNav } from '../../router/router';
import { Cover, ProgressBar, Segmented, Sheet, ShelfMarker } from '../components';
import { ChevronLeft, Filter } from '../icons';
import { useLibrary, useSettings } from '../store';
import { bodyL, caption, displayM, displayS, resetButton, tabular } from '../styles';
import { SORTS, sortWorks, type SortKey } from '../work-sort';

const ROW_HEIGHT = 92;
const OVERSCAN_ROWS = 4;
type FormatFilter = 'all' | Format;

const FORMAT_OPTIONS: { value: FormatFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'book', label: 'Books' },
  { value: 'novel', label: 'Novels' },
  { value: 'manhwa', label: 'Manhwa' },
];

export function Everything({ initialGenre }: { initialGenre?: GenreIndex }) {
  const library = useLibrary();
  const { settings, update } = useSettings();
  const { overlays } = useNav();
  const [picked, setPicked] = useState<GenreIndex[]>(
    initialGenre === undefined ? [] : [initialGenre],
  );
  const [mode, setMode] = useState<'any' | 'all'>(settings?.genreFilterMode ?? 'any');
  const [format, setFormat] = useState<FormatFilter>('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(560);
  const scroll = useRef<HTMLDivElement>(null);
  const genreOpen = overlays.at(-1)?.kind === 'genreFilter';

  useEffect(() => {
    if (settings?.genreFilterMode) setMode(settings.genreFilterMode);
  }, [settings?.genreFilterMode]);

  useEffect(() => {
    const element = scroll.current;
    if (!element) return;
    const measure = () => setViewport(element.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const filtered = useMemo(() => {
    if (!library) return [];
    const inFormat =
      format === 'all' ? library : library.filter(({ work }) => work.format === format);
    const inGenres =
      picked.length === 0
        ? inFormat
        : inFormat.filter(({ work }) =>
            mode === 'all'
              ? picked.every((genre) => work.genres.includes(genre))
              : picked.some((genre) => work.genres.includes(genre)),
          );
    return sortWorks(inGenres, sort);
  }, [format, library, mode, picked, sort]);

  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS);
  const end = Math.min(
    filtered.length,
    Math.ceil((scrollTop + viewport) / ROW_HEIGHT) + OVERSCAN_ROWS,
  );
  const pickedNames = picked.map((index) => GENRES[index]?.name ?? '').filter(Boolean);
  const filterLabel =
    picked.length === 0 && sort === 'recent'
      ? 'Filter and sort'
      : picked.length === 1
        ? `${pickedNames[0]} · ${SORTS.find((item) => item.value === sort)?.label}`
        : `${picked.length || 'All'} genres · ${SORTS.find((item) => item.value === sort)?.label}`;
  const markerColors = (library ?? [])
    .slice(0, 3)
    .map(({ work }) => work.coverDominantColor ?? 'var(--cover-fallback)');
  const resetScroll = () => {
    setScrollTop(0);
    scroll.current?.scrollTo({ top: 0 });
  };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'calc(var(--space-5) + var(--safe-top)) var(--page-gutter) var(--space-1)',
          flex: 'none',
        }}
      >
        <button
          aria-label="Back"
          onClick={() => nav.back()}
          style={{
            ...resetButton,
            width: 44,
            height: 44,
            marginLeft: -14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronLeft />
        </button>
        <ShelfMarker colors={markerColors} compact />
        <h1 style={{ ...displayM, flex: 1, margin: 0 }}>Everything</h1>
      </header>

      <div style={{ padding: '0 var(--page-gutter) var(--space-3)', flex: 'none' }}>
        <Segmented
          ariaLabel="Format"
          options={FORMAT_OPTIONS}
          value={format}
          onChange={(next) => {
            setFormat(next);
            resetScroll();
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: '0 var(--page-gutter) var(--space-3)',
          flex: 'none',
        }}
      >
        <span style={{ ...caption, ...tabular, color: 'var(--text-secondary)' }}>
          {library === undefined
            ? '—'
            : `${filtered.length.toLocaleString('en-US')} ${filtered.length === 1 ? 'work' : 'works'}`}
        </span>
        <span style={{ flex: 1 }} />
        <button
          onClick={() => nav.open({ kind: 'genreFilter' })}
          aria-label={filterLabel}
          style={{
            ...resetButton,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            height: 32,
            padding: '0 var(--space-3)',
            borderRadius: 'var(--radius-pill)',
            border: `var(--hairline-width) solid ${
              picked.length ? 'var(--accent)' : 'var(--hairline-strong)'
            }`,
            background: picked.length ? 'var(--accent-deep)' : 'transparent',
            color: picked.length ? 'var(--accent-text)' : 'var(--text-secondary)',
            ...caption,
          }}
        >
          <Filter size={13} />
          <span
            style={{
              whiteSpace: 'nowrap',
              maxWidth: '24ch',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {filterLabel}
          </span>
        </button>
      </div>

      <div
        ref={scroll}
        className="exl-scroll"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '0 var(--page-gutter) 120px',
        }}
      >
        {library?.length === 0 ? (
          <div style={{ padding: 'var(--space-7) 0 var(--space-2)' }}>
            <div style={displayS}>An empty library</div>
            <div
              style={{
                ...bodyL,
                color: 'var(--text-secondary)',
                maxWidth: '32ch',
                marginTop: 'var(--space-2)',
                textWrap: 'pretty',
              }}
            >
              Add a work and it will appear here with everything else you own.
            </div>
          </div>
        ) : filtered.length === 0 && picked.length ? (
          <div style={{ padding: 'var(--space-7) 0 var(--space-2)' }}>
            <div style={displayS}>
              {mode === 'all' ? 'Nothing carries all of those' : 'Nothing carries any of those'}
            </div>
            <div
              style={{
                ...bodyL,
                color: 'var(--text-secondary)',
                maxWidth: '32ch',
                marginTop: 'var(--space-2)',
                textWrap: 'pretty',
              }}
            >
              {mode === 'all' ? (
                <>
                  Switch to <em>any</em> and you will see everything that carries at least one of
                  them.
                </>
              ) : (
                'Clear the filter or choose another genre.'
              )}
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative', height: filtered.length * ROW_HEIGHT }}>
            {filtered.slice(start, end).map(({ work, authorName }, index) => {
              const display = displayWork(work, authorName);
              return (
                <button
                  key={work.id}
                  data-work={work.id}
                  data-hover="raised"
                  onClick={() => nav.push({ screen: 'detail', id: work.id })}
                  style={{
                    ...resetButton,
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    height: ROW_HEIGHT,
                    paddingRight: 'var(--space-1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    borderTop: 'var(--hairline-width) solid var(--hairline)',
                    transform: `translateY(${(start + index) * ROW_HEIGHT}px)`,
                  }}
                >
                  <Cover color={display.coverColor} path={work.coverPath} width={44} height={66} />
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-1)',
                      textAlign: 'left',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 'var(--size-body)',
                        lineHeight: 'var(--lh-body)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {work.title}
                    </span>
                    <span style={{ ...caption, color: 'var(--text-secondary)' }}>
                      {authorName ?? 'Author unknown'}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span style={{ ...caption, color: 'var(--text-secondary)' }}>
                        {work.format === 'book'
                          ? 'Book'
                          : work.format === 'novel'
                            ? 'Novel'
                            : 'Manhwa'}
                      </span>
                      <span aria-hidden="true" style={{ color: 'var(--text-faint)' }}>
                        ·
                      </span>
                      <span style={{ ...caption, color: display.statusColor }}>
                        {STATUS_LABEL[work.status]}
                      </span>
                      {display.showBar ? (
                        <span style={{ flex: 1 }}>
                          <ProgressBar
                            width={display.barWidth}
                            track={display.trackBackground}
                            fill={display.fillBackground}
                          />
                        </span>
                      ) : (
                        <span style={{ flex: 1 }} />
                      )}
                      <span style={{ ...caption, ...tabular }}>{display.shortProgress}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 66,
          height: 72,
          pointerEvents: 'none',
          background: 'linear-gradient(to top, var(--surface-base), transparent)',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 66,
          pointerEvents: 'none',
          background: 'var(--surface-base)',
        }}
      />

      {genreOpen ? (
        <GenreFilter
          library={library ?? []}
          picked={picked}
          mode={mode}
          sort={sort}
          onMode={(next) => {
            setMode(next);
            void update({ genreFilterMode: next });
          }}
          onPicked={(next) => {
            setPicked(next);
            resetScroll();
          }}
          onSort={(next) => {
            setSort(next);
            resetScroll();
          }}
          resultCount={filtered.length}
        />
      ) : null}
    </div>
  );
}

function GenreFilter({
  library,
  picked,
  mode,
  sort,
  onMode,
  onPicked,
  onSort,
  resultCount,
}: {
  library: NonNullable<ReturnType<typeof useLibrary>>;
  picked: GenreIndex[];
  mode: 'any' | 'all';
  sort: SortKey;
  onMode: (mode: 'any' | 'all') => void;
  onPicked: (genres: GenreIndex[]) => void;
  onSort: (sort: SortKey) => void;
  resultCount: number;
}) {
  const resultLabel =
    picked.length === 0
      ? 'Show everything'
      : resultCount === 1
        ? 'Show the one work'
        : `Show ${resultCount.toLocaleString('en-US')} works`;

  return (
    <Sheet onClose={() => nav.close()} title="Filter and sort" maxHeight="88%">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div style={{ ...displayS, flex: 1 }}>Filter and sort</div>
        <Segmented
          ariaLabel="Genre matching"
          options={[
            { value: 'any' as const, label: 'Any' },
            { value: 'all' as const, label: 'All' },
          ]}
          value={mode}
          onChange={onMode}
        />
      </div>
      <div style={{ ...caption, color: 'var(--text-secondary)', textWrap: 'pretty' }}>
        {mode === 'all'
          ? 'Only works carrying every genre you pick.'
          : 'Works carrying at least one of the genres you pick.'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <span style={{ ...caption, color: 'var(--text-secondary)' }}>Order</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {SORTS.map((option) => {
            const selected = sort === option.value;
            return (
              <button
                key={option.value}
                aria-pressed={selected}
                onClick={() => onSort(option.value)}
                style={{
                  ...resetButton,
                  height: 36,
                  padding: '0 14px',
                  borderRadius: 'var(--radius-pill)',
                  border: `var(--hairline-width) solid ${
                    selected ? 'var(--accent)' : 'var(--hairline)'
                  }`,
                  background: selected ? 'var(--accent-deep)' : 'transparent',
                  color: selected ? 'var(--accent-text)' : 'var(--text-primary)',
                  ...caption,
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ ...caption, color: 'var(--text-secondary)' }}>
        {SORTS.find((option) => option.value === sort)?.note}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {GENRES.map((genre) => {
          const selected = picked.includes(genre.colorIndex);
          const count = library.filter(({ work }) => work.genres.includes(genre.colorIndex)).length;
          return (
            <button
              key={genre.colorIndex}
              aria-pressed={selected}
              onClick={() =>
                onPicked(
                  selected
                    ? picked.filter((index) => index !== genre.colorIndex)
                    : [...picked, genre.colorIndex],
                )
              }
              style={{
                ...resetButton,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                height: 36,
                padding: '0 14px',
                borderRadius: 'var(--radius-pill)',
                border: `var(--hairline-width) solid ${
                  selected ? 'var(--accent)' : 'var(--hairline)'
                }`,
                background: selected ? 'var(--accent-deep)' : 'transparent',
                color: selected ? 'var(--accent-text)' : 'var(--text-primary)',
                ...caption,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 12,
                  borderRadius: 1,
                  background: `var(--genre-${genre.colorIndex})`,
                }}
              />
              <span style={{ whiteSpace: 'nowrap' }}>{genre.name}</span>
              <span style={{ ...tabular, color: 'var(--text-secondary)' }}>{count}</span>
            </button>
          );
        })}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          paddingTop: 'var(--space-3)',
          borderTop: 'var(--hairline-width) solid var(--hairline)',
        }}
      >
        <button
          disabled={picked.length === 0}
          onClick={() => onPicked([])}
          style={{
            ...resetButton,
            flex: 'none',
            padding: '0 18px',
            height: 48,
            lineHeight: '48px',
            textAlign: 'center',
            borderRadius: 'var(--radius-button)',
            border: 'var(--hairline-width) solid var(--hairline-strong)',
            fontSize: 'var(--size-body)',
            color: picked.length ? 'var(--text-primary)' : 'var(--text-faint)',
          }}
        >
          Clear
        </button>
        <button
          data-ripple
          data-active="accent"
          onClick={() => nav.close()}
          style={{
            ...resetButton,
            flex: 1,
            height: 48,
            lineHeight: '48px',
            textAlign: 'center',
            borderRadius: 'var(--radius-button)',
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            fontSize: 'var(--size-body)',
            fontWeight: 500,
          }}
        >
          {resultLabel}
        </button>
      </div>
    </Sheet>
  );
}
