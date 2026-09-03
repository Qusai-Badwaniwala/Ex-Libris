import { nav } from '../../router/router';
import { displayS, label, resetButton, tabular } from '../styles';
import { ChevronRight, Menu, Moon, Search, Sun } from '../icons';
import { Cover, ProgressBar } from '../components';
import { displayWork } from '../../db/derive';
import { useContinuing, useHomeFigures, useLibrary, useShelfCounts } from '../store';
import type { Format, ThemeChoice } from '../../db/schema';
import { Constellation } from '../constellation';

/**
 * Home. Ported from design/Ex Libris.dc.html.
 *
 * No wordmark: the app name is on the splash, the bookplate, the drawer head
 * and About, and none of those is the top of the screen you look at forty times
 * a day (D-054). Search shares the row with the drawer button, and the two
 * theme glyphs sit to its right (D-082).
 */

const SHELVES: { key: Format; label: string }[] = [
  { key: 'book', label: 'Books' },
  { key: 'novel', label: 'Novels' },
  { key: 'manhwa', label: 'Manhwa' },
];

export function Home({
  theme,
  onTheme,
}: {
  theme: 'light' | 'dark';
  onTheme: (t: ThemeChoice) => void;
}) {
  const continuing = useContinuing();
  const counts = useShelfCounts();
  const figures = useHomeFigures();
  const library = useLibrary();

  const reading = continuing ?? [];
  const lead = reading[0];
  const peek = reading.slice(1, 3);

  /** Three cover colours per shelf, as slivers. */
  const slivers = (format: Format) =>
    (library ?? [])
      .filter((x) => x.work.format === format)
      .slice(0, 3)
      .map((x) => x.work.coverDominantColor ?? 'var(--cover-fallback)');

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Constellation />
      <div
        className="exl-scroll"
        style={{
          position: 'absolute',
          inset: 0,
          overflowY: 'auto',
          padding: 'calc(var(--space-5) + var(--safe-top)) var(--page-gutter) 104px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-6)',
          }}
        >
          <button
            data-tour="drawer"
            aria-label="Menu"
            onClick={() => nav.open({ kind: 'drawer' })}
            style={{
              ...resetButton,
              width: 40,
              height: 44,
              flex: 'none',
              marginLeft: -10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Menu />
          </button>
          <button
            data-tour="search"
            data-hover="hairline"
            onClick={() => nav.push({ screen: 'search' })}
            style={{
              ...resetButton,
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              flex: 1,
              minWidth: 0,
              height: 44,
              padding: '0 14px',
              background: 'var(--surface-sunken)',
              border: 'var(--hairline-width) solid var(--hairline)',
              borderRadius: 'var(--radius-pill)',
            }}
          >
            <Search />
            <span style={{ fontSize: 'var(--size-body)', color: 'var(--text-secondary)' }}>
              Search your library
            </span>
          </button>
          {/* The selected state is a raised pill plus full-strength ink, not
              accent ink: --accent-text against --text-muted measures 1.14:1 in
              the dark theme, so the two glyphs were indistinguishable (D-082). */}
          <div style={{ display: 'flex', flex: 'none', gap: 6 }}>
            {(
              [
                { key: 'light', title: 'Light', Icon: Sun },
                { key: 'dark', title: 'Dark', Icon: Moon },
              ] as const
            ).map(({ key, title, Icon }) => {
              const on = theme === key;
              return (
                <button
                  key={key}
                  title={title}
                  aria-label={`${title} theme`}
                  aria-pressed={on}
                  onClick={() => onTheme(key)}
                  style={{
                    ...resetButton,
                    // --touch-min is 44 and two small targets that flip the
                    // whole app's appearance are the worst place to shave it.
                    width: 'var(--touch-min)',
                    height: 'var(--touch-min)',
                    borderRadius: 'var(--radius-pill)',
                    background: on ? 'var(--surface-raised)' : 'transparent',
                    color: on ? 'var(--text-primary)' : 'var(--text-faint)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon />
                </button>
              );
            })}
          </div>
        </div>

        {lead ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
              marginBottom: 'var(--space-7)',
            }}
          >
            <div style={displayS}>Continue</div>
            {(() => {
              const d = displayWork(lead.work, lead.authorName);
              return (
                <button
                  data-tour="continue"
                  data-work={d.id}
                  onClick={() => nav.push({ screen: 'detail', id: d.id })}
                  style={{
                    ...resetButton,
                    display: 'flex',
                    gap: 'var(--space-4)',
                    alignItems: 'flex-start',
                  }}
                >
                  <Cover
                    color={d.coverColor}
                    ink={d.coverInk}
                    width={132}
                    height={198}
                    title={d.title}
                  />
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-2)',
                      paddingTop: 'var(--space-1)',
                      minWidth: 0,
                      textAlign: 'left',
                    }}
                  >
                    <div style={displayS}>{d.title}</div>
                    <div
                      style={{
                        fontSize: 'var(--size-caption)',
                        lineHeight: 'var(--lh-caption)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {d.authorLine}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        marginTop: 'var(--space-2)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 'var(--size-caption)',
                          lineHeight: 'var(--lh-caption)',
                          color: 'var(--text-secondary)',
                          ...tabular,
                        }}
                      >
                        {d.progressLabel}
                      </div>
                      {d.showBar ? (
                        <ProgressBar
                          width={d.barWidth}
                          track={d.trackBackground}
                          fill={d.fillBackground}
                        />
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })()}

            {peek.length ? (
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                {peek.map(({ work, authorName }) => {
                  const d = displayWork(work, authorName);
                  return (
                    <button
                      key={d.id}
                      data-work={d.id}
                      data-hover="hairline"
                      onClick={() => nav.push({ screen: 'detail', id: d.id })}
                      style={{
                        ...resetButton,
                        display: 'flex',
                        gap: 10,
                        alignItems: 'center',
                        flex: 1,
                        minWidth: 0,
                        padding: 'var(--space-2)',
                        borderRadius: 'var(--radius-button)',
                        border: 'var(--hairline-width) solid var(--hairline)',
                      }}
                    >
                      <Cover color={d.coverColor} width={32} height={48} />
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                          minWidth: 0,
                          textAlign: 'left',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 'var(--size-caption)',
                            lineHeight: 'var(--lh-caption)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {d.title}
                        </div>
                        <div style={{ ...label, ...tabular }}>{d.shortProgress}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 'var(--space-7)' }}>
          <div style={{ ...displayS, marginBottom: 'var(--space-4)' }}>Shelves</div>
          {SHELVES.map((s) => (
            <button
              key={s.key}
              data-hover="raised"
              onClick={() => nav.push({ screen: 'format', format: s.key })}
              style={{
                ...resetButton,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-4)',
                height: 64,
                borderTop: 'var(--hairline-width) solid var(--hairline)',
              }}
            >
              <div style={{ display: 'flex', gap: 3, width: 44, flex: 'none' }}>
                {slivers(s.key).map((c, i) => (
                  <div key={i} style={{ width: 6, height: 36, borderRadius: 1, background: c }} />
                ))}
              </div>
              <div style={{ ...displayS, flex: 1, textAlign: 'left' }}>{s.label}</div>
              <div
                style={{
                  fontSize: 'var(--size-body)',
                  color: 'var(--text-secondary)',
                  ...tabular,
                }}
              >
                {counts?.[s.key] ?? 0}
              </div>
              <ChevronRight />
            </button>
          ))}
          {/* Everything is the last row of Shelves. Three grey slivers instead
              of cover colours, because it is not a shelf — it is all of them
              (D-069). */}
          <button
            data-tour="everything"
            data-hover="raised"
            onClick={() => nav.push({ screen: 'everything' })}
            style={{
              ...resetButton,
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-4)',
              height: 64,
              borderTop: 'var(--hairline-width) solid var(--hairline)',
            }}
          >
            <div style={{ display: 'flex', gap: 3, width: 44, flex: 'none' }}>
              {['var(--text-faint)', 'var(--text-muted)', 'var(--text-secondary)'].map((c) => (
                <div key={c} style={{ width: 6, height: 36, borderRadius: 1, background: c }} />
              ))}
            </div>
            <div style={{ ...displayS, flex: 1, textAlign: 'left' }}>Everything</div>
            <span
              style={{
                fontSize: 'var(--size-caption)',
                lineHeight: 'var(--lh-caption)',
                color: 'var(--text-secondary)',
                ...tabular,
              }}
            >
              {figures?.libraryTotal ?? 0}
            </span>
            <ChevronRight />
          </button>
          <div style={{ borderTop: 'var(--hairline-width) solid var(--hairline)' }} />
        </div>

        <div
          style={{
            display: 'flex',
            border: 'var(--hairline-width) solid var(--hairline)',
            borderRadius: 'var(--radius-card)',
            overflow: 'hidden',
          }}
        >
          {[
            { n: figures?.finishedThisYear, text: `finished in ${new Date().getFullYear()}` },
            { n: figures?.readingNow, text: 'reading now' },
            { n: figures?.libraryTotal, text: 'in the library' },
          ].map((f, i) => (
            <div key={f.text} style={{ display: 'contents' }}>
              {i > 0 ? <div style={{ width: 0.5, background: 'var(--hairline)' }} /> : null}
              <div
                style={{
                  flex: 1,
                  padding: '16px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-1)',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    ...displayS,
                    fontSize: 'var(--size-display-m)',
                    lineHeight: 'var(--lh-display-m)',
                    ...tabular,
                  }}
                >
                  {f.n ?? 0}
                </div>
                <div style={{ ...label, textAlign: 'center' }}>{f.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
