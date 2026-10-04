import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { GENRES } from '../../data/taxonomy';
import { STATUS_LABEL, displayWork } from '../../db/derive';
import type { Format, GenreIndex, ReadingStatus } from '../../db/schema';
import { nav, useNav } from '../../router/router';
import { Cover, EmptyState, ProgressBar, Segmented, Sheet } from '../components';
import { Filter } from '../icons';
import { useLibrary, useSettings } from '../store';
import { caption, displayS, resetButton, tabular } from '../styles';
import { SORTS, sortWorks, type SortKey } from '../work-sort';
import { AnimatePresence, m, useMotion } from '../motion';

type FormatFilter = 'all' | Format;
const Codex = lazy(() => import('../Codex').then((module) => ({ default: module.Codex })));
let collectionView: 'index' | 'codex' = 'index';
type StatusFilter = 'all' | ReadingStatus;
const FORMAT_OPTIONS: { value: FormatFilter; label: string }[] = [
  { value: 'all', label: 'All formats' },
  { value: 'book', label: 'Books' },
  { value: 'novel', label: 'Novels' },
  { value: 'manhwa', label: 'Manhwa' },
];
// Presentation state only: preserve the browsing context when a record closes.
const positions = new Map<
  string,
  { format: FormatFilter; status: StatusFilter; sort: SortKey; genres: GenreIndex[]; top: number }
>();

export function Everything({
  initialGenre,
  initialFormat,
}: {
  initialGenre?: GenreIndex;
  initialFormat?: Format;
}) {
  const library = useLibrary();
  const { reduced, settle } = useMotion();
  const measured = useRef({ columns: 1, rowHeight: 132 });
  const [view, setView] = useState(collectionView);
  const [browseOptions, setBrowseOptions] = useState(false);
  const { settings, update } = useSettings();
  const { overlays } = useNav();
  const cacheKey = `${initialFormat ?? 'all'}:${initialGenre ?? 'all'}`;
  const saved = positions.get(cacheKey);
  const [picked, setPicked] = useState<GenreIndex[]>(
    saved?.genres ?? (initialGenre === undefined ? [] : [initialGenre]),
  );
  const [mode, setMode] = useState<'any' | 'all'>(settings?.genreFilterMode ?? 'any');
  const [format, setFormat] = useState<FormatFilter>(saved?.format ?? initialFormat ?? 'all');
  const [status, setStatus] = useState<StatusFilter>(saved?.status ?? 'all');
  const [sort, setSort] = useState<SortKey>(saved?.sort ?? 'recent');
  const [scrollTop, setScrollTop] = useState(saved?.top ?? 0);
  const [viewport, setViewport] = useState(700);
  const [columns, setColumns] = useState(1);
  const [rowHeight, setRowHeight] = useState(132);
  const scroll = useRef<HTMLDivElement>(null);
  const genreOpen = overlays.at(-1)?.kind === 'genreFilter';
  const libraryReady = library !== undefined;
  useLayoutEffect(() => {
    if (view === 'index' && libraryReady && scroll.current)
      scroll.current.scrollTop = positions.get(cacheKey)?.top ?? 0;
  }, [view, cacheKey, libraryReady]);

  useEffect(() => {
    if (settings?.genreFilterMode) setMode(settings.genreFilterMode);
  }, [settings?.genreFilterMode]);
  useEffect(() => {
    const element = scroll.current;
    if (!element) return;
    const measure = () => {
      const nextColumns = element.clientWidth > 850 ? 2 : 1;
      const nextHeight = Math.max(132, parseFloat(getComputedStyle(element).fontSize) * 8.25);
      const previous = measured.current;
      if (previous.columns !== nextColumns || previous.rowHeight !== nextHeight) {
        const anchor = Math.floor(element.scrollTop / previous.rowHeight) * previous.columns;
        const nextTop = Math.floor(anchor / nextColumns) * nextHeight;
        element.scrollTop = nextTop;
        setScrollTop(nextTop);
      }
      measured.current = { columns: nextColumns, rowHeight: nextHeight };
      setViewport(element.clientHeight);
      setColumns(nextColumns);
      setRowHeight(nextHeight);
    };
    measure();
    element.scrollTop = positions.get(cacheKey)?.top ?? 0;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [cacheKey]);
  useEffect(() => {
    positions.set(cacheKey, { format, status, sort, genres: picked, top: scrollTop });
  }, [cacheKey, format, status, sort, picked, scrollTop]);

  const filtered = useMemo(
    () =>
      sortWorks(
        (library ?? []).filter(
          ({ work }) =>
            (format === 'all' || work.format === format) &&
            (status === 'all' || work.status === status) &&
            (!picked.length ||
              (mode === 'all'
                ? picked.every((g) => work.genres.includes(g))
                : picked.some((g) => work.genres.includes(g)))),
        ),
        sort,
      ),
    [format, library, mode, picked, sort, status],
  );
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 4) * columns;
  const end = Math.min(
    filtered.length,
    (Math.ceil((scrollTop + viewport) / rowHeight) + 4) * columns,
  );
  const resetScroll = () => {
    setScrollTop(0);
    scroll.current?.scrollTo({ top: 0 });
  };
  const statuses: StatusFilter[] = ['all', 'reading', 'caught_up', 'finished', 'dropped'];

  return (
    <main className="room-collection">
      <div className="room-collection-head">
        <div className="room-view-tabs" aria-label="Library view">
          <button onClick={() => nav.reset({ screen: 'home' })}>Reading</button>
          <button aria-current="page">
            Collection <span>{library?.length ?? '—'}</span>
          </button>
        </div>
        <div className="room-section-heading">
          <h1>Your collection</h1>
          <div
            className="room-collection-presentation"
            role="group"
            aria-label="Collection presentation"
          >
            {(['index', 'codex'] as const).map((item) => (
              <button
                key={item}
                aria-pressed={view === item}
                onClick={() => {
                  collectionView = item;
                  setView(item);
                }}
              >
                {item === 'index' ? 'Index' : 'Codex'}
              </button>
            ))}
          </div>
        </div>
        <div hidden={view === 'codex' && !browseOptions}>
          <Segmented
            ariaLabel="Format"
            options={FORMAT_OPTIONS}
            value={format}
            onChange={(next) => {
              setFormat(next);
              resetScroll();
            }}
          />
          <div className="room-status-tabs" role="group" aria-label="Reading status">
            {statuses.map((item) => (
              <button
                key={item}
                aria-pressed={status === item}
                onClick={() => {
                  setStatus(item);
                  resetScroll();
                }}
              >
                {item === 'all' ? 'Everything' : STATUS_LABEL[item]}
              </button>
            ))}
          </div>
        </div>
        <div className="room-collection-controls">
          <span>
            {library === undefined
              ? 'Opening…'
              : `${filtered.length} ${filtered.length === 1 ? 'work' : 'works'}`}
          </span>
          {view === 'codex' && (
            <button
              className="room-text"
              aria-expanded={browseOptions}
              onClick={() => setBrowseOptions(!browseOptions)}
            >
              {browseOptions
                ? 'Hide formats'
                : `${FORMAT_OPTIONS.find((item) => item.value === format)?.label} · ${status === 'all' ? 'All states' : STATUS_LABEL[status]}`}
            </button>
          )}
          <button
            className="room-text"
            aria-label="Filter and sort"
            onClick={() => nav.open({ kind: 'genreFilter' })}
          >
            <Filter size={16} />
            {picked.length ? `${picked.length} genres · ` : ''}
            {sort === 'recent'
              ? 'Filter and sort'
              : SORTS.find((item) => item.value === sort)?.label}
          </button>
        </div>
      </div>
      <div
        ref={scroll}
        className="exl-scroll room-collection-list"
        data-scroll-owner="collection"
        onScroll={(event) => {
          if (view === 'index') setScrollTop(event.currentTarget.scrollTop);
        }}
      >
        {library === undefined ? (
          <p role="status">Opening your collection…</p>
        ) : !filtered.length ? (
          <EmptyState
            art={library.length ? undefined : 'library-rafiki'}
            artWidth="64%"
            head={library.length ? 'No works match these filters' : 'A shelf to make your own'}
            body={
              library.length
                ? 'Choose another reading status or adjust the genres to see more of your collection.'
                : 'Add books, novels or manhwa. Everything you keep will find a place here.'
            }
            cta={library.length ? 'Clear filters' : 'Add a work'}
            onCta={() => {
              if (!library.length) nav.open({ kind: 'byHand' });
              else {
                setPicked([]);
                setStatus('all');
                setFormat('all');
                resetScroll();
              }
            }}
          />
        ) : view === 'codex' ? (
          <Suspense fallback={<p role="status">Opening the Codex…</p>}>
            <Codex
              works={filtered}
              library={library}
              context={`${cacheKey}:${format}:${status}:${sort}:${picked.join(',')}:${mode}`}
            />
          </Suspense>
        ) : (
          <div
            style={{
              position: 'relative',
              height: Math.ceil(filtered.length / columns) * rowHeight,
            }}
          >
            {filtered.slice(start, end).map(({ work, authorName }, index) => {
              const d = displayWork(work, authorName);
              const position = start + index;
              return (
                <m.button
                  layout={reduced ? false : 'position'}
                  layoutDependency={filtered}
                  initial={false}
                  transition={settle}
                  key={work.id}
                  className="room-collection-row"
                  data-work={work.id}
                  onClick={(event) => {
                    const cover = event.currentTarget.querySelector<HTMLElement>('[data-cover]');
                    if (cover) nav.pushWithCover({ screen: 'detail', id: work.id }, cover);
                    else nav.push({ screen: 'detail', id: work.id });
                  }}
                  style={{
                    position: 'absolute',
                    top: Math.floor(position / columns) * rowHeight,
                    left: `${((position % columns) * 100) / columns}%`,
                    width: `${100 / columns}%`,
                    height: rowHeight,
                  }}
                >
                  <Cover
                    color={d.coverColor}
                    ink={d.coverInk}
                    path={work.coverPath}
                    width={52}
                    height={78}
                  />
                  <span className="room-collection-record">
                    <strong>{work.title}</strong>
                    <span className="room-collection-author">{authorName ?? 'Author unknown'}</span>
                    <span className="room-collection-meta">
                      <span>{STATUS_LABEL[work.status]}</span>
                      <span>{d.shortProgress}</span>
                    </span>
                    {d.showBar && (
                      <ProgressBar
                        width={d.barWidth}
                        track={d.trackBackground}
                        fill={d.fillBackground}
                      />
                    )}
                  </span>
                </m.button>
              );
            })}
          </div>
        )}
      </div>
      <AnimatePresence initial={false}>
        {genreOpen && (
          <GenreFilter
            key="genre-filter"
            library={library ?? []}
            picked={picked}
            mode={mode}
            sort={sort}
            onMode={(next) => {
              setMode(next);
              void update({ genreFilterMode: next });
              resetScroll();
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
        )}
      </AnimatePresence>
    </main>
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
    <Sheet
      onClose={() => nav.close()}
      title="Filter and sort"
      maxHeight="88%"
      footer={
        <div className="room-form-actions">
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
      }
    >
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
    </Sheet>
  );
}
