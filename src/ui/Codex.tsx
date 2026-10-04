import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Work } from '../db/schema';
import { displayWork, STATUS_LABEL } from '../db/derive';
import { codexSections } from '../relationships/library';
import { nav } from '../router/router';
import { Cover } from './components';
import type { WorkWithAuthor } from './store';
import { createCabinet } from './codex-scene';

const savedPositions = new Map<string, number>();
export function Codex({
  works,
  library,
  context,
}: {
  works: WorkWithAuthor[];
  library: WorkWithAuthor[];
  context: string;
}) {
  const groups = useLiveQuery(
    async () => ({ series: await db.series.toArray(), worlds: await db.universe.toArray() }),
    [],
  );
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ReturnType<typeof createCabinet> | undefined>(undefined);
  const [size, setSize] = useState({ width: 360, height: 600, scale: 1 });
  const [top, setTop] = useState(savedPositions.get(context) ?? 0);
  const [fallback, setFallback] = useState(false);
  const restoredContext = useRef<string | undefined>(undefined);
  const columns = Math.max(2, Math.min(6, Math.floor((size.width - 36) / 148)));
  const rowHeight = 274 + Math.max(0, size.scale - 1) * 70;
  const headerHeight = 78 + Math.max(0, size.scale - 1) * 44;
  const sections = useMemo(
    () =>
      codexSections(
        works.map((row) => row.work),
        library.map((row) => row.work),
        groups?.series ?? [],
        groups?.worlds ?? [],
      ),
    [works, library, groups],
  );
  const layout = useMemo(() => {
    let y = 20;
    const rows = sections.flatMap((section) => {
      const header = {
        key: `${section.id}:head`,
        top: y,
        section,
        works: [] as Work[],
        header: true,
      };
      y += headerHeight;
      const result = [header];
      for (let i = 0; i < section.works.length; i += columns) {
        result.push({
          key: `${section.id}:${i}`,
          top: y,
          section,
          works: section.works.slice(i, i + columns),
          header: false,
        });
        y += rowHeight;
      }
      y += 18;
      return result;
    });
    return { rows, height: y + 24 };
  }, [sections, columns, headerHeight, rowHeight]);
  const visible = useMemo(
    () =>
      layout.rows.filter(
        (row) => row.top + rowHeight > top - 300 && row.top < top + size.height + 300,
      ),
    [layout, top, size.height, rowHeight],
  );

  useLayoutEffect(() => {
    const element = root.current;
    if (!element || !groups || restoredContext.current === context) return;
    element.scrollTop = savedPositions.get(context) ?? 0;
    setTop(element.scrollTop);
    restoredContext.current = context;
  }, [context, groups, layout.height]);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () =>
      setSize({
        width: element.clientWidth,
        height: element.clientHeight,
        scale: parseFloat(getComputedStyle(document.documentElement).fontSize) / 16,
      });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [context]);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    try {
      renderer.current = createCabinet(element);
    } catch {
      setFallback(true);
    }
    const lost = (event: Event) => {
      event.preventDefault();
      setFallback(true);
      renderer.current?.dispose();
      renderer.current = undefined;
    };
    element.addEventListener('webglcontextlost', lost);
    return () => {
      element.removeEventListener('webglcontextlost', lost);
      renderer.current?.dispose();
      renderer.current = undefined;
    };
  }, []);
  useEffect(() => {
    const draw = () =>
      renderer.current?.draw(
        size.width,
        size.height,
        visible.map((row) => ({
          top: row.top - top,
          count: row.works.length,
          header: row.header,
          height: headerHeight - 10,
        })),
        columns,
      );
    const frame = requestAnimationFrame(draw);
    const observer = new MutationObserver(draw);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    document.addEventListener('visibilitychange', draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', draw);
    };
  }, [size, top, columns, visible, headerHeight]);

  return (
    <div className={`codex ${fallback ? 'codex--flat' : ''}`}>
      <canvas ref={canvas} aria-hidden="true" className="codex-cabinet" />
      <div
        ref={root}
        className="codex-scroll exl-scroll"
        data-scroll-owner="codex"
        role="region"
        tabIndex={0}
        aria-label="Codex bookcase"
        onScroll={(event) => {
          const next = event.currentTarget.scrollTop;
          setTop(next);
          savedPositions.set(context, next);
        }}
      >
        <div style={{ height: layout.height, position: 'relative' }}>
          {visible.map((row) =>
            row.header ? (
              <header
                className="codex-heading"
                key={row.key}
                style={{ top: row.top, height: headerHeight - 10 }}
              >
                <span>{row.section.world?.name ?? 'The private collection'}</span>
                <button
                  disabled={!row.section.series && !row.section.world}
                  onClick={() =>
                    nav.push(
                      row.section.series
                        ? { screen: 'series', id: row.section.series.id }
                        : { screen: 'universe', id: row.section.world?.id },
                    )
                  }
                >
                  {row.section.name}
                </button>
                <small>
                  {row.section.works.length === row.section.total
                    ? `${row.section.total} works`
                    : `${row.section.works.length} of ${row.section.total} shown`}
                </small>
              </header>
            ) : (
              <div
                className="codex-row"
                data-codex-row
                key={row.key}
                style={{
                  top: row.top,
                  height: rowHeight,
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                }}
              >
                {row.works.map((work) => {
                  const d = displayWork(work);
                  return (
                    <button
                      className="codex-book"
                      key={work.id}
                      aria-label={`${work.title}, ${STATUS_LABEL[work.status]}`}
                      onClick={() => nav.push({ screen: 'detail', id: work.id })}
                    >
                      <span className="codex-cover">
                        <Cover
                          color={d.coverColor}
                          ink={d.coverInk}
                          path={work.coverPath}
                          title={work.title}
                          width={Math.min(112, (size.width - 48) / columns - 22)}
                          height={168}
                        />
                      </span>
                      <strong>{work.title}</strong>
                      <small>{STATUS_LABEL[work.status]}</small>
                    </button>
                  );
                })}
              </div>
            ),
          )}
        </div>
      </div>
      {fallback && (
        <span className="codex-fallback" role="status">
          Two-dimensional bookcase · 3D unavailable
        </span>
      )}
    </div>
  );
}
