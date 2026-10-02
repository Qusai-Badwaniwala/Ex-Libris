import { nav } from '../../router/router';
import { Cover, EmptyState, ProgressBar } from '../components';
import { displayWork } from '../../db/derive';
import { useContinuing, useHomeFigures, useLibrary, useShelfCounts } from '../store';
import type { Format } from '../../db/schema';

export function Home() {
  const continuing = useContinuing();
  const library = useLibrary();
  const figures = useHomeFigures();
  const counts = useShelfCounts();
  const lead = continuing?.[0];
  const rest = continuing?.slice(1) ?? [];
  const shelves: { key: Format; label: string }[] = [
    { key: 'book', label: 'Books' },
    { key: 'novel', label: 'Novels' },
    { key: 'manhwa', label: 'Manhwa' },
  ];
  return (
    <main className="room-page room-reading exl-scroll">
      <div className="room-view-tabs" aria-label="Library view">
        <button aria-current="page">Reading</button>
        <button data-tour="everything" onClick={() => nav.push({ screen: 'everything' })}>
          Collection <span>{figures?.libraryTotal ?? '—'}</span>
        </button>
      </div>
      {library === undefined ? (
        <p role="status">Opening your library…</p>
      ) : lead ? (
        (() => {
          const d = displayWork(lead.work, lead.authorName);
          return (
            <section className="room-current" data-tour="continue">
              <div className="room-current-title">
                <p className="room-eyebrow">Back to your book</p>
                <button
                  className="room-title-link"
                  data-work={d.id}
                  onClick={() => nav.push({ screen: 'detail', id: d.id })}
                >
                  <h1>{d.title}</h1>
                </button>
                <p className="room-author">{d.authorLine}</p>
              </div>
              <div className="room-current-body">
                <button
                  className="room-cover-link"
                  data-work={d.id}
                  aria-label={`Open ${d.title}`}
                  onClick={() => nav.push({ screen: 'detail', id: d.id })}
                >
                  <Cover
                    color={d.coverColor}
                    ink={d.coverInk}
                    path={lead.work.coverPath}
                    width={148}
                    height={222}
                    title={d.title}
                  />
                </button>
                <div className="room-current-progress">
                  <p className="room-eyebrow">Where you left off</p>
                  <p className="room-position">{d.progressLabel}</p>
                  {d.showBar && (
                    <ProgressBar
                      width={d.barWidth}
                      track={d.trackBackground}
                      fill={d.fillBackground}
                    />
                  )}
                  <button
                    className="room-primary"
                    onClick={() => nav.open({ kind: 'session', id: d.id })}
                  >
                    Log a session <span aria-hidden="true">↗</span>
                  </button>
                  <button
                    className="room-text"
                    onClick={() => nav.push({ screen: 'detail', id: d.id })}
                  >
                    Open this record →
                  </button>
                </div>
              </div>
            </section>
          );
        })()
      ) : (
        <section data-tour="continue" data-tour-state="empty" className="room-reading-empty">
          <EmptyState
            art="dragon-rafiki"
            artWidth="72%"
            head={library.length ? 'Room for your next read' : 'Your library begins here'}
            body={
              library.length
                ? 'Choose a work from your collection and mark it as reading.'
                : 'Books, web novels and manhwa. Keep the things you read, and the thoughts you want to return to.'
            }
            cta={library.length ? 'Open your collection' : 'Add a work'}
            onCta={() =>
              library.length ? nav.push({ screen: 'everything' }) : nav.open({ kind: 'byHand' })
            }
          />
        </section>
      )}
      <div className="room-reading-lower">
        {!!rest.length && (
          <section>
            <div className="room-section-heading">
              <h2>Also on your mind</h2>
              <span>{rest.length}</span>
            </div>
            <div className="room-active-list">
              {rest.map(({ work, authorName }) => {
                const d = displayWork(work, authorName);
                return (
                  <button
                    className="room-book-row"
                    key={work.id}
                    data-work={work.id}
                    onClick={() => nav.push({ screen: 'detail', id: work.id })}
                  >
                    <Cover color={d.coverColor} path={work.coverPath} width={48} height={72} />
                    <span>
                      <strong>{work.title}</strong>
                      <small>{d.shortProgress}</small>
                    </span>
                    <span aria-hidden="true">↗</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
        <section className="room-shelves">
          <div className="room-section-heading">
            <h2>Your shelves</h2>
            <button className="room-text" onClick={() => nav.push({ screen: 'everything' })}>
              See all →
            </button>
          </div>
          {shelves.map((shelf) => (
            <button
              key={shelf.key}
              className="room-shelf-row"
              onClick={() =>
                nav.push({
                  screen: 'format',
                  format: shelf.key,
                })
              }
            >
              <span>{shelf.label}</span>
              <span>
                {counts?.[shelf.key] ?? '—'} <span aria-hidden="true">↗</span>
              </span>
            </button>
          ))}
        </section>
      </div>
      <button className="room-reading-summary" onClick={() => nav.reset({ screen: 'stats' })}>
        <span>
          <strong>{figures?.finishedThisYear ?? '—'}</strong> finished in {new Date().getFullYear()}
        </span>
        <span>See your reading life →</span>
      </button>
    </main>
  );
}
