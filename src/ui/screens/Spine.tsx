import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { displayWork } from '../../db/derive';
import type { Format } from '../../db/schema';
import { nav } from '../../router/router';
import {
  FIXED_SPINE_THRESHOLDS,
  SPINE_GAP,
  SPINE_ROW_HEIGHT,
  SPINE_ROW_SLOT,
  SPINE_WIDTHS,
  packSpineRows,
  spineHeight,
  spineWidth,
  visibleSpineRows,
} from '../../spine/layout';
import { EmptyState, ShelfMarker } from '../components';
import { ChevronLeft, ListView, SpineView } from '../icons';
import { useShelf, useSpineWidthProfile, type WorkWithAuthor } from '../store';
import { caption, displayM, displayS, resetButton, tabular } from '../styles';

const SHELF_NAME: Record<Format, string> = {
  book: 'Books',
  novel: 'Novels',
  manhwa: 'Manhwa',
};

interface SpineRecord {
  row: WorkWithAuthor;
  width: number;
  height: number;
}

/** Phase 4 restores Claude's real shelf view; Phase 9 adds row virtualisation
 * and the approved adaptive width buckets without changing this grammar. */
export function Spine({ format }: { format: Format }) {
  const works = useShelf(format);
  const widthProfile = useSpineWidthProfile();
  const measureRef = useRef<HTMLDivElement>(null);
  const [rowWidth, setRowWidth] = useState(358);
  const thresholds = widthProfile?.thresholds ?? FIXED_SPINE_THRESHOLDS;

  useEffect(() => {
    const element = measureRef.current;
    if (!element) return;
    const measure = () => setRowWidth(element.clientWidth || 358);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const spines = useMemo(
    () =>
      (works ?? []).map((row) => ({
        row,
        width: spineWidth(row.work, thresholds),
        height: spineHeight(row.work.id),
      })),
    [thresholds, works],
  );
  const rows = useMemo(() => packSpineRows(spines, rowWidth), [rowWidth, spines]);
  const markerColors = (works ?? [])
    .slice(0, 3)
    .map(({ work }) => work.coverDominantColor ?? 'var(--cover-fallback)');
  const unit = format === 'book' ? 'page' : 'chapter';

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'calc(var(--space-5) + var(--safe-top)) var(--page-gutter) var(--space-4)',
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
            marginLeft: -12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronLeft />
        </button>
        <ShelfMarker colors={markerColors} compact />
        <h1 style={{ ...displayM, flex: 1, margin: 0 }}>{SHELF_NAME[format]}</h1>
        <div
          style={{
            display: 'flex',
            border: 'var(--hairline-width) solid var(--hairline)',
            borderRadius: 'var(--radius-button)',
            overflow: 'hidden',
          }}
        >
          <button
            aria-label="List view"
            onClick={() => nav.replace({ screen: 'format', format })}
            style={{
              ...resetButton,
              width: 40,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ListView />
          </button>
          <span aria-hidden="true" style={{ width: 0.5, background: 'var(--hairline)' }} />
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
            <SpineView color="var(--text-primary)" />
          </div>
        </div>
      </header>

      <div
        ref={measureRef}
        className="exl-scroll"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '0 var(--page-gutter) 112px',
        }}
      >
        {works === undefined ? null : works.length === 0 ? (
          <div style={{ display: 'flex', minHeight: '70%' }}>
            <EmptyState
              art="library-rafiki"
              artWidth="84%"
              head={`No ${SHELF_NAME[format].toLowerCase()} yet`}
              body="The shelf marker stays in place. Add the first work and its real spine will stand here."
              cta="Add a work"
              onCta={() => nav.open({ kind: 'byHand' })}
            />
          </div>
        ) : (
          <>
            <section aria-labelledby="spine-shelf-heading">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 'var(--space-2)',
                  marginBottom: 'var(--space-3)',
                }}
              >
                <h2 id="spine-shelf-heading" style={{ ...displayS, margin: 0 }}>
                  All {SHELF_NAME[format].toLowerCase()}
                </h2>
                <span style={{ ...caption, ...tabular, color: 'var(--text-secondary)' }}>
                  {works.length}
                </span>
              </div>
              <VirtualSpineRows rows={rows} scrollRef={measureRef} />
            </section>
            <WidthKey
              thresholds={thresholds[unit]}
              adaptive={widthProfile?.adaptiveUnits.includes(unit) ?? false}
              unit={unit}
            />
          </>
        )}
      </div>
    </div>
  );
}

function VirtualSpineRows({
  rows,
  scrollRef,
}: {
  rows: SpineRecord[][];
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const shelfRowsRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 12 });

  useEffect(() => {
    const scroll = scrollRef.current;
    const shelf = shelfRowsRef.current;
    if (!scroll || !shelf || !rows.length) return;
    let frame = 0;
    let lastScrollTop = Number.NEGATIVE_INFINITY;
    const update = () => {
      frame = 0;
      const next = visibleSpineRows(
        scroll.scrollTop,
        scroll.clientHeight,
        shelf.offsetTop,
        rows.length,
      );
      setVisibleRange((current) =>
        current.start === next.start && current.end === next.end ? current : next,
      );
    };
    const onScroll = () => {
      if (Math.abs(scroll.scrollTop - lastScrollTop) < 20) return;
      lastScrollTop = scroll.scrollTop;
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    scroll.addEventListener('scroll', onScroll, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(scroll);
    return () => {
      scroll.removeEventListener('scroll', onScroll);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [rows, scrollRef]);

  return (
    <div
      ref={shelfRowsRef}
      data-spine-row-count={rows.length}
      data-spine-mounted-rows={visibleRange.end - visibleRange.start}
      style={{
        position: 'relative',
        height: rows.length * SPINE_ROW_SLOT,
        contain: 'layout style',
      }}
    >
      {rows.slice(visibleRange.start, visibleRange.end).map((row, offset) => {
        const rowIndex = visibleRange.start + offset;
        return (
          <div
            key={rowIndex}
            data-spine-row={rowIndex}
            style={{
              position: 'absolute',
              insetInline: 0,
              top: 0,
              height: SPINE_ROW_HEIGHT,
              transform: `translateY(${rowIndex * SPINE_ROW_SLOT}px)`,
              display: 'flex',
              alignItems: 'flex-end',
              gap: SPINE_GAP,
              paddingBottom: 1,
              borderBottom: 'var(--hairline-width) solid var(--hairline-strong)',
            }}
          >
            {row.map((spine) => (
              <SpineButton key={spine.row.work.id} spine={spine} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

const SpineButton = memo(function SpineButton({ spine }: { spine: SpineRecord }) {
  const { work, authorName } = spine.row;
  const display = displayWork(work, authorName);
  const showTitle = spine.width >= 18;

  return (
    <button
      className="exl-spine"
      data-work={work.id}
      data-cover
      aria-label={`${work.title}, ${display.statusLabel}`}
      onClick={(event) => nav.pushWithCover({ screen: 'detail', id: work.id }, event.currentTarget)}
      style={{
        ...resetButton,
        position: 'relative',
        width: spine.width,
        height: spine.height,
        flex: 'none',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 10,
        borderRadius: 'var(--cover-radius) var(--cover-radius) 0 0',
        boxShadow: 'var(--cover-inset)',
        background: display.coverColor,
      }}
    >
      {showTitle ? (
        <span
          aria-hidden="true"
          style={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            fontFamily: 'var(--font-display)',
            fontWeight: 'var(--display-vf-xs)' as unknown as number,
            fontSize: spine.width >= 36 ? 13 : 11,
            lineHeight: 1,
            letterSpacing: '0.01em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxHeight: '86%',
            color: display.coverInk,
          }}
        >
          {work.title}
        </span>
      ) : null}
      {work.status === 'reading' ? (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 3,
            background: 'var(--status-reading)',
          }}
        />
      ) : null}
    </button>
  );
});

function WidthKey({
  thresholds,
  adaptive,
  unit,
}: {
  thresholds: readonly [number, number, number, number];
  adaptive: boolean;
  unit: 'chapter' | 'page';
}) {
  const compact = (value: number) => (value >= 1000 ? `${value / 1000}k` : String(value));
  const labels = [
    `<${compact(thresholds[0])}`,
    compact(thresholds[1]),
    compact(thresholds[2]),
    compact(thresholds[3]),
    `${compact(thresholds[3])}+`,
  ];
  return (
    <section
      aria-label="Spine width key"
      style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 'var(--space-2)' }}
    >
      <div style={{ ...caption, color: 'var(--text-secondary)' }}>Width is length</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-2)' }}>
        {SPINE_WIDTHS.map((width, index) => (
          <div
            key={width}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
          >
            <div
              style={{
                width,
                height: 40,
                borderRadius: 'var(--cover-radius) var(--cover-radius) 0 0',
                background: 'var(--surface-overlay)',
                border: 'var(--hairline-width) solid var(--hairline-strong)',
                borderBottom: 'none',
              }}
            />
            <span style={{ ...caption, ...tabular, color: 'var(--text-secondary)' }}>
              {labels[index]}
            </span>
          </div>
        ))}
      </div>
      <div style={{ ...caption, color: 'var(--text-secondary)', maxWidth: '34ch' }}>
        {adaptive
          ? `Based on this library's ${unit} lengths. The scale updates when the library changes.`
          : 'Fixed logarithmic scale, so long and ordinary works can share one shelf without the shorter work vanishing.'}
      </div>
    </section>
  );
}
