import { useState, type ReactNode } from 'react';
import { Illustration } from '../illustration';
import { useLibraryStats } from '../store';

const number = new Intl.NumberFormat();
export function Stats() {
  const stats = useLibraryStats();
  const [scope, setScope] = useState<'all' | 'finished'>('all');
  const genres = [...(stats?.genres[scope] ?? [])].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
  const maximum = Math.max(1, ...genres.map((genre) => genre.count));
  return (
    <main className="room-page room-stats exl-scroll">
      <header className="room-stats-heading">
        <div>
          <p className="room-eyebrow">Your reading life</p>
          <h1>{stats?.year ?? new Date().getFullYear()} so far</h1>
          <p>A little perspective on the pages behind you.</p>
        </div>
        <Illustration name="knowledge-rafiki" style={{ width: 150 }} />
      </header>
      <div className="room-stats-figures" aria-label="This year's reading figures">
        {[
          { value: stats?.finishedThisYear, label: 'finished' },
          { value: stats?.chaptersRead, label: 'chapters read' },
          { value: stats?.yearsTracked, label: 'years tracked' },
        ].map((figure) => (
          <div key={figure.label}>
            <strong>{figure.value === undefined ? '—' : number.format(figure.value)}</strong>
            <span>{figure.label}</span>
          </div>
        ))}
      </div>
      {!stats ? (
        <p role="status">Reading your library’s history…</p>
      ) : (
        <div className="room-stats-body">
          <Register
            title="The library"
            rows={[
              ['In the library', number.format(stats.libraryTotal)],
              ['Reading now', number.format(stats.readingNow)],
              ['Caught up, still running', number.format(stats.caughtUp)],
              ['On the wishlist', number.format(stats.wishlistTotal)],
              ['Dropped', number.format(stats.dropped)],
            ]}
          />
          <section className="room-stat-genres">
            <div className="room-section-heading">
              <h2>Genres</h2>
              <div className="room-status-tabs" role="group" aria-label="Genre scope">
                {(['all', 'finished'] as const).map((value) => (
                  <button
                    key={value}
                    aria-pressed={scope === value}
                    onClick={() => setScope(value)}
                  >
                    {value === 'all' ? 'Everything' : 'Finished'}
                  </button>
                ))}
              </div>
            </div>
            {genres.length ? (
              <div
                role="img"
                aria-label={genres.map((genre) => `${genre.name} ${genre.count}`).join(', ')}
              >
                {genres.map((genre) => (
                  <div className="room-genre-bar" key={genre.index}>
                    <div>
                      <span>{genre.name}</span>
                      <span>{genre.count}</span>
                    </div>
                    <div aria-hidden="true">
                      <span
                        style={{
                          width: `${(100 * genre.count) / maximum}%`,
                          background: `var(--genre-${genre.index})`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="room-stat-note">
                Genre counts appear when works have genres. You can add them on a work’s record.
              </p>
            )}
            {!!genres.length && (
              <p className="room-stat-note">A work with two genres appears in both counts.</p>
            )}
          </section>
          <Register
            title="Series"
            rows={[
              ['Started', number.format(stats.seriesStarted)],
              ['Completed', number.format(stats.seriesCompleted)],
              ['One entry away', number.format(stats.seriesOneAway)],
            ]}
          />
          {!!stats.authorsInLibrary && (
            <Register
              title="Authors"
              rows={[
                ...(stats.mostReadAuthor
                  ? ([
                      ['Most read', stats.mostReadAuthor.name],
                      ['By that author', number.format(stats.mostReadAuthor.count)],
                    ] as [string, ReactNode][])
                  : []),
                ['Authors in the library', number.format(stats.authorsInLibrary)],
              ]}
            />
          )}
          {stats.finishing && (
            <Register
              title="Finishing"
              rows={[
                ['Finished what you started', `${stats.finishing.finished}%`],
                ['Dropped it', `${stats.finishing.dropped}%`],
                ['Still open', `${stats.finishing.open}%`],
              ]}
            />
          )}
          <section className="room-stats-years">
            <Illustration name="cherry-tree-amico" style={{ width: 130 }} />
            <div>
              <h2>Before this year</h2>
              {stats.priorYears.length ? (
                stats.priorYears.map((row) => (
                  <div className="room-register-row" key={row.year}>
                    <span>{row.year}</span>
                    <strong>{number.format(row.finished)} finished</strong>
                  </div>
                ))
              ) : (
                <p className="room-stat-note">
                  Earlier years will appear here when your library has finished works from those
                  years.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function Register({ title, rows }: { title: string; rows: [string, ReactNode][] }) {
  return (
    <section className="room-register">
      <h2>{title}</h2>
      {rows.map(([label, value]) => (
        <div className="room-register-row" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </section>
  );
}
