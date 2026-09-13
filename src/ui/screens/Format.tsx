import { useMemo, useState } from 'react';
import { nav } from '../../router/router';
import { caption, displayM, label, resetButton, tabular } from '../styles';
import { ChevronLeft, ListView, SpineView } from '../icons';
import {
  Cover,
  EmptyState,
  GenreChipsCompact,
  ProgressBar,
  Segmented,
  Sheet,
  ShelfMarker,
} from '../components';
import { STATUS_LABEL, displayWork } from '../../db/derive';
import { useShelf } from '../store';
import type { Format as FormatKey, ReadingStatus } from '../../db/schema';
import { SORTS, sortWorks, type SortKey } from '../work-sort';

/**
 * The format screen — one shelf.
 *
 * Ported from design/Ex Libris.dc.html, plus the two things a person would
 * reasonably expect and the design has no control for (audit B6): a sort, and a
 * way to see only what you dropped or only what you finished. Both are
 * assembled from the vocabulary the design already specifies — the header pill
 * and the sheet come straight from its Genre filter — rather than invented.
 */

const SHELF_NAME: Record<FormatKey, string> = {
  book: 'Books',
  novel: 'Novels',
  manhwa: 'Manhwa',
};

const EMPTY_COPY: Record<FormatKey, { head: string; cta: string }> = {
  book: { head: 'No books yet', cta: 'Add a book' },
  novel: { head: 'No novels yet', cta: 'Add a novel' },
  manhwa: { head: 'No manhwa yet', cta: 'Add a manhwa' },
};

type StatusFilter = 'all' | ReadingStatus;

export function Format({ format }: { format: FormatKey }) {
  const rows = useShelf(format);
  const [sort, setSort] = useState<SortKey>('recent');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sheetOpen, setSheetOpen] = useState(false);

  const shown = useMemo(() => {
    const base = rows ?? [];
    const filtered = status === 'all' ? base : base.filter((r) => r.work.status === status);
    return sortWorks(filtered, sort);
  }, [rows, sort, status]);

  const counts = useMemo(() => {
    const out = new Map<StatusFilter, number>([['all', (rows ?? []).length]]);
    for (const r of rows ?? []) out.set(r.work.status, (out.get(r.work.status) ?? 0) + 1);
    return out;
  }, [rows]);

  const filterLabel =
    status === 'all'
      ? SORTS.find((s) => s.value === sort)!.label
      : `${STATUS_LABEL[status]} · ${SORTS.find((s) => s.value === sort)!.label}`;
  const markerColors = (rows ?? [])
    .slice(0, 3)
    .map(({ work }) => work.coverDominantColor ?? 'var(--cover-fallback)');

  return (
    <div
      className="exl-scroll"
      style={{
        position: 'absolute',
        inset: 0,
        overflowY: 'auto',
        padding: 'calc(var(--space-5) + var(--safe-top)) 0 104px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: '0 var(--page-gutter)',
          marginBottom: 'var(--space-3)',
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
          }}
        >
          <ChevronLeft />
        </button>
        <ShelfMarker colors={markerColors} compact />
        <div style={{ ...displayM, flex: 1 }}>{SHELF_NAME[format]}</div>
        <div
          style={{
            display: 'flex',
            border: 'var(--hairline-width) solid var(--hairline)',
            borderRadius: 'var(--radius-button)',
            overflow: 'hidden',
          }}
        >
          <div
            aria-current="true"
            style={{
              width: 40,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--surface-raised)',
            }}
          >
            <ListView />
          </div>
          <div style={{ width: 0.5, background: 'var(--hairline)' }} />
          <button
            aria-label="Spine view"
            onClick={() => nav.push({ screen: 'spine', format })}
            style={{
              ...resetButton,
              width: 40,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SpineView />
          </button>
        </div>
      </div>

      {/* B6. The same header-pill-into-sheet shape the design specifies for the
          genre filter, so this reads as part of the app rather than beside it.
          It takes the accent when a filter is on, so the screen never looks
          unfiltered when it isn't. */}
      <div style={{ padding: '0 var(--page-gutter)', marginBottom: 'var(--space-4)' }}>
        <button
          onClick={() => setSheetOpen(true)}
          style={{
            ...resetButton,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            height: 32,
            padding: '0 14px',
            borderRadius: 'var(--radius-pill)',
            border: `var(--hairline-width) solid ${
              status === 'all' ? 'var(--hairline-strong)' : 'var(--accent)'
            }`,
            background: status === 'all' ? 'transparent' : 'var(--accent-deep)',
            color: status === 'all' ? 'var(--text-secondary)' : 'var(--accent-text)',
            ...caption,
          }}
        >
          {filterLabel}
          <span style={{ ...tabular, opacity: 0.7 }}>{shown.length}</span>
        </button>
      </div>

      {rows === undefined ? null : shown.length === 0 ? (
        <div style={{ padding: '0 var(--page-gutter)', display: 'flex', minHeight: '50vh' }}>
          <EmptyState
            art={status === 'all' ? 'library-rafiki' : undefined}
            artWidth="84%"
            head={
              status === 'all'
                ? EMPTY_COPY[format].head
                : `Nothing ${STATUS_LABEL[status].toLowerCase()} here`
            }
            body={
              status === 'all'
                ? 'The shelf is decided by how you read a thing, not by what it technically is. One tap moves anything here.'
                : 'Change the filter above to see the rest of this shelf.'
            }
            {...(status === 'all'
              ? { cta: EMPTY_COPY[format].cta, onCta: () => nav.open({ kind: 'byHand' }) }
              : {})}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {shown.map(({ work, authorName }) => {
            const d = displayWork(work, authorName);
            return (
              <button
                key={d.id}
                data-work={d.id}
                data-hover="raised"
                onClick={() => nav.push({ screen: 'detail', id: d.id })}
                style={{
                  ...resetButton,
                  display: 'flex',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3) var(--page-gutter)',
                  alignItems: 'flex-start',
                  borderTop: 'var(--hairline-width) solid var(--hairline)',
                }}
              >
                <Cover color={d.coverColor} path={work.coverPath} width={44} height={66} />
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
                    <span
                      style={{
                        fontSize: 'var(--size-body)',
                        lineHeight: 'var(--lh-body)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {d.title}
                    </span>
                    {/* Absent, not "#?" — a missing position says nothing. */}
                    {d.positionLabel ? (
                      <span style={{ ...label, ...tabular, flex: 'none' }}>{d.positionLabel}</span>
                    ) : null}
                  </div>
                  <GenreChipsCompact genres={work.genres} />
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      marginTop: 2,
                    }}
                  >
                    {d.showBar ? (
                      <div style={{ flex: 1 }}>
                        <ProgressBar
                          width={d.barWidth}
                          track={d.trackBackground}
                          fill={d.fillBackground}
                        />
                      </div>
                    ) : (
                      <span style={{ flex: 1 }} />
                    )}
                    <span style={{ ...label, ...tabular, flex: 'none' }}>{d.shortProgress}</span>
                  </div>
                </div>
              </button>
            );
          })}
          <div style={{ borderTop: 'var(--hairline-width) solid var(--hairline)' }} />
        </div>
      )}

      {sheetOpen ? (
        <Sheet onClose={() => setSheetOpen(false)} title="Sort and filter">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ ...displayM, fontSize: 'var(--size-display-s)' }}>Sort and filter</div>
            <div style={{ ...caption, color: 'var(--text-secondary)' }}>
              {SORTS.find((s) => s.value === sort)!.note}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <span style={label}>Order</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SORTS.map((s) => (
                <Chip
                  key={s.value}
                  on={sort === s.value}
                  text={s.label}
                  onClick={() => setSort(s.value)}
                />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <span style={label}>Show</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(['all', 'reading', 'caught_up', 'finished', 'dropped'] as StatusFilter[])
                // A status nothing on this shelf carries is not offered. An
                // option that can only ever return an empty list is a dead end.
                .filter((s) => s === 'all' || (counts.get(s) ?? 0) > 0)
                .map((s) => (
                  <Chip
                    key={s}
                    on={status === s}
                    text={s === 'all' ? 'Everything' : STATUS_LABEL[s]}
                    count={counts.get(s) ?? 0}
                    onClick={() => setStatus(s)}
                  />
                ))}
            </div>
          </div>

          <button
            data-active="accent"
            onClick={() => setSheetOpen(false)}
            style={{
              ...resetButton,
              width: '100%',
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
            {shown.length === 1 ? 'Show the one work' : `Show ${shown.length} works`}
          </button>
        </Sheet>
      ) : null}
    </div>
  );
}

function Chip({
  on,
  text,
  count,
  onClick,
}: {
  on: boolean;
  text: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={on}
      onClick={onClick}
      style={{
        ...resetButton,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        ...caption,
        padding: '7px 12px',
        borderRadius: 'var(--radius-pill)',
        border: `var(--hairline-width) solid ${on ? 'var(--accent)' : 'var(--hairline)'}`,
        background: on ? 'var(--accent-deep)' : 'transparent',
        color: on ? 'var(--accent-text)' : 'var(--text-primary)',
      }}
    >
      {text}
      {count !== undefined ? (
        <span style={{ ...tabular, color: 'var(--text-secondary)' }}>{count}</span>
      ) : null}
    </button>
  );
}

export { Segmented };
