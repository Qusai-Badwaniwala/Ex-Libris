import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { nav } from '../router/router';
import { catalogue } from '../catalogue/client';
import { openInstalledCatalogue } from '../catalogue/install';
import { searchMangaDex } from '../catalogue/mangadex';
import type { CorpusMatch } from '../catalogue/types';
import { Cover, Sheet } from './components';
import { SearchField } from './search-field';
import { withInteractionFeedback } from './interaction-feedback';
import { caption, label, quietButton, resetButton } from './styles';

const formatHintLabel = (match: CorpusMatch) =>
  match.formatHint === 'manhwa'
    ? 'Comic'
    : match.formatHint === 'novel'
      ? 'Novel'
      : match.formatHint === 'book'
        ? 'Book'
        : 'Format unknown — choose before adding';

export function CatalogueSheet({ initialQuery = '' }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [matches, setMatches] = useState<CorpusMatch[]>([]);
  const [message, setMessage] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [onlineResults, setOnlineResults] = useState(false);
  const generation = useRef(0);
  const onlineRequest = useRef<AbortController | null>(null);
  const settings = useLiveQuery(() => db.settings.get('singleton'), []);
  const owned = useLiveQuery(() => db.work.filter((work) => !work.deletedAt).toArray(), []);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    if (!settings?.corpusVersion) {
      setMessage('No index is installed. Add by hand or search online.');
      return;
    }
    setMessage('Opening the downloaded index…');
    void withInteractionFeedback('Opening the catalogue index…', () =>
      openInstalledCatalogue(settings.corpusVersion as string),
    )
      .then(() => {
        if (!cancelled) {
          setReady(true);
          setMessage('');
        }
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setMessage(error instanceof Error ? error.message : 'The index could not open.');
      });
    return () => {
      cancelled = true;
    };
  }, [settings?.corpusVersion]);

  useEffect(() => {
    const counter = generation;
    const request = ++counter.current;
    onlineRequest.current?.abort();
    setMatches([]);
    setOnlineResults(false);
    setBusy(false);
    if (!ready || query.trim().length < 3) return;
    setBusy(true);
    setMessage('');
    // No fixed debounce: 120ms of waiting would itself violate the 50ms gate.
    // Stale replies are ignored, SQLite is serialized inside the worker.
    void withInteractionFeedback('Searching the catalogue…', () => catalogue.search(query))
      .then((result) => {
        if (counter.current === request) {
          setMatches(result.matches);
          setBusy(false);
        }
      })
      .catch((error: unknown) => {
        if (counter.current === request) {
          setMessage(error instanceof Error ? error.message : 'Catalogue search stopped.');
          setBusy(false);
        }
      });
    return () => {
      counter.current++;
    };
  }, [query, ready]);

  useEffect(() => {
    const counter = generation;
    const pending = onlineRequest;
    return () => {
      counter.current++;
      pending.current?.abort();
    };
  }, []);

  async function searchOnline() {
    const request = ++generation.current;
    onlineRequest.current?.abort();
    const controller = new AbortController();
    onlineRequest.current = controller;
    setMatches([]);
    setBusy(true);
    setMessage('');
    setOnlineResults(true);
    try {
      if (!navigator.onLine)
        throw new Error('You are offline. Your library and downloaded index still work.');
      const results = await withInteractionFeedback('Searching online…', () =>
        searchMangaDex(query, controller.signal),
      );
      if (generation.current === request) setMatches(results);
    } catch (error) {
      if (generation.current === request)
        setMessage(error instanceof Error ? error.message : 'Online search stopped.');
    } finally {
      if (generation.current === request) setBusy(false);
    }
  }

  return (
    <Sheet title="The catalogue" onClose={() => nav.close()} transitionName="add-surface">
      <div>
        <h1 style={{ ...label, fontWeight: 400, margin: '0 0 8px' }}>The catalogue</h1>
        <SearchField catalogue value={query} onChange={setQuery} />
      </div>
      <div aria-live="polite" aria-busy={busy}>
        {busy && <p className="exl-sr">Search in progress.</p>}
        {message && (
          <p role="status" style={{ ...caption, color: 'var(--text-secondary)' }}>
            {message}
          </p>
        )}
        {query.trim().length < 3 && (
          <p style={{ ...caption, color: 'var(--text-secondary)' }}>
            Type at least three characters to search.
          </p>
        )}
        {!busy && !message && query.trim().length >= 3 && matches.length === 0 && (
          <p style={caption}>No matches. Try another title, search online, or add by hand.</p>
        )}
        {matches.map((match) => {
          const existing = owned?.find(
            (work) =>
              work.corpusId === match.corpusId ||
              (match.mangadexId && work.externalIds.mangadex === match.mangadexId),
          );
          return (
            <div
              key={match.corpusId}
              data-candidate={match.corpusId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 0',
                borderBottom: 'var(--hairline-width) solid var(--hairline)',
              }}
            >
              <Cover width={36} height={54} color="var(--cover-fallback)" />
              <div style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                <div>{match.title}</div>
                <div style={{ ...caption, color: 'var(--text-secondary)' }}>
                  {match.authors.join(', ') || 'Author unknown'}
                </div>
                <div
                  style={{
                    ...caption,
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>{formatHintLabel(match)}</span>
                  {match.formatHint === 'manhwa' && (
                    <span
                      style={{
                        borderLeft: 'var(--hairline-width) solid var(--hairline-strong)',
                        paddingLeft: 6,
                      }}
                    >
                      Manhwa shelf
                    </span>
                  )}
                </div>
                {match.chapterCount !== undefined && (
                  <div style={label}>{match.chapterCount.toLocaleString()} chapters</div>
                )}
                {match.seriesName ? (
                  <div style={{ ...label, marginTop: 3 }}>
                    {match.seriesName}
                    {match.seriesPosition !== undefined ? ` · entry ${match.seriesPosition}` : ''}
                  </div>
                ) : null}
                {match.universeName ? (
                  <div style={{ ...caption, color: 'var(--text-secondary)' }}>
                    Inside {match.universeName}
                  </div>
                ) : null}
              </div>
              <button
                aria-label={existing ? `Open ${match.title}` : `Add ${match.title}`}
                disabled={!owned}
                onClick={() =>
                  existing
                    ? nav.closeAndPush({ screen: 'detail', id: existing.id })
                    : nav.swap({ kind: 'byHand', candidate: match })
                }
                style={{
                  ...resetButton,
                  ...caption,
                  flex: 'none',
                  minHeight: 44,
                  padding: '0 10px',
                  color: 'var(--text-primary)',
                  border: 'var(--hairline-width) solid var(--hairline-strong)',
                  borderRadius: 'var(--radius-pill)',
                }}
              >
                {existing ? (existing.status === 'wishlist' ? 'Wishlist' : 'In library') : 'Add'}
              </button>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          disabled={busy || query.trim().length < 3}
          onClick={() => void searchOnline()}
          style={quietButton}
        >
          Search online
        </button>
        <a
          href="https://mangadex.org"
          target="_blank"
          rel="noreferrer"
          style={{
            ...label,
            color: 'var(--text-secondary)',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          Online manga results from MangaDex.
        </a>
        {onlineResults && (
          <span style={label}>These are comics, not the novels they may adapt.</span>
        )}
        <button onClick={() => nav.closeAndPush({ screen: 'corpus' })} style={quietButton}>
          {settings?.corpusVersion ? 'Manage the downloaded index' : 'Download the index'}
        </button>
        <button
          onClick={() => nav.swap({ kind: 'byHand', initialTitle: query.trim() || undefined })}
          style={quietButton}
        >
          Add by hand
        </button>
      </div>
    </Sheet>
  );
}
