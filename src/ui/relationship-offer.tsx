import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import * as repo from '../db/repo';
import { openInstalledCatalogue } from '../catalogue/install';
import { catalogue } from '../catalogue/client';
import type { CorpusRelationshipEvidence } from '../catalogue/types';
import {
  resolveRelationships,
  type RelationshipResolution,
  type SeriesSuggestion,
  type UniverseSuggestion,
} from '../relationships/resolver';
import { nav } from '../router/router';
import { withInteractionFeedback } from './interaction-feedback';
import { caption, displayS, label, resetButton } from './styles';

export function RelationshipOffer({ workId }: { workId: string }) {
  const source = useLiveQuery(async () => {
    const [work, settings, librarySeries, libraryWorks] = await Promise.all([
      db.work.get(workId),
      db.settings.get('singleton'),
      db.series.toArray(),
      db.work.toArray(),
    ]);
    return work ? { work, settings, librarySeries, libraryWorks } : null;
  }, [workId]);
  const [evidence, setEvidence] = useState<CorpusRelationshipEvidence>();
  const [corpusLookupDone, setCorpusLookupDone] = useState(false);
  const [resolution, setResolution] = useState<RelationshipResolution>();
  const [dismissedSeries, setDismissedSeries] = useState(false);
  const [dismissedUniverse, setDismissedUniverse] = useState(false);
  const [confirmedSeriesId, setConfirmedSeriesId] = useState<string>();
  const [confirmedUniverseId, setConfirmedUniverseId] = useState<string>();
  const [busy, setBusy] = useState<'series' | 'universe' | 'bulk'>();
  const [error, setError] = useState('');
  const corpusId = source?.work.corpusId;
  const corpusVersion = source?.settings?.corpusVersion;

  useEffect(() => {
    if (!corpusId) return;
    let cancelled = false;
    setCorpusLookupDone(false);
    const find = async () => {
      if (corpusVersion) {
        await openInstalledCatalogue(corpusVersion);
        return catalogue.relationship(corpusId);
      }
      return undefined;
    };
    void withInteractionFeedback('Checking series and universe…', find)
      .then((result) => {
        if (!cancelled) {
          setEvidence(result);
          setCorpusLookupDone(true);
        }
      })
      .catch(() => {
        // A missing/offline index only removes corpus evidence. The conservative
        // title-pattern fallback can still offer a clearly-labelled suggestion.
        if (!cancelled) {
          setEvidence(undefined);
          setCorpusLookupDone(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [corpusId, corpusVersion]);

  const derived = useMemo(() => {
    if (!source) return undefined;
    if (source.work.corpusId && source.settings?.corpusVersion && !corpusLookupDone) {
      return undefined;
    }
    return resolveRelationships({
      work: source.work,
      corpus: evidence,
      librarySeries: source.librarySeries,
      libraryWorks: source.libraryWorks,
    });
  }, [corpusLookupDone, evidence, source]);

  useEffect(() => {
    if (derived) setResolution(derived);
  }, [derived]);

  if (!source || !resolution) return null;
  const series = !source.work.seriesId && !dismissedSeries ? resolution.series : undefined;
  const universe = !source.work.universeId && !dismissedUniverse ? resolution.universe : undefined;
  const shownSeries = series ?? (confirmedSeriesId ? resolution.series : undefined);
  const shownUniverse = universe ?? (confirmedUniverseId ? resolution.universe : undefined);
  if (!shownSeries && !shownUniverse) return null;

  const confirmSeries = async (suggestion: SeriesSuggestion) => {
    setBusy('series');
    setError('');
    try {
      const confirmed = await withInteractionFeedback('Grouping the series…', () =>
        repo.confirmSeriesSuggestion(workId, suggestion),
      );
      setConfirmedSeriesId(confirmed.series.id);
    } catch {
      setError('The series could not be saved. Nothing was changed; try again.');
    } finally {
      setBusy(undefined);
    }
  };

  const confirmUniverse = async (suggestion: UniverseSuggestion) => {
    setBusy('universe');
    setError('');
    try {
      const confirmed = await withInteractionFeedback('Linking the universe…', () =>
        repo.confirmUniverseSuggestion(workId, suggestion),
      );
      setConfirmedUniverseId(confirmed.universe.id);
    } catch {
      setError('The universe could not be saved. Nothing was changed; try again.');
    } finally {
      setBusy(undefined);
    }
  };

  const addMissing = async (suggestion: SeriesSuggestion) => {
    if (!confirmedSeriesId || suggestion.missingEntries.length === 0) return;
    setBusy('bulk');
    setError('');
    try {
      await withInteractionFeedback('Adding the missing entries to Wishlist…', () =>
        repo.addSeriesEntriesToWishlist(
          confirmedSeriesId,
          suggestion.missingEntries,
          confirmedUniverseId ?? source.work.universeId,
        ),
      );
      nav.push({ screen: 'series', id: confirmedSeriesId });
    } catch {
      setError('The missing entries could not be added. Nothing was partly saved; try again.');
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <section
      aria-label="Series and universe suggestions"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
    >
      {shownSeries ? (
        <SuggestionCard>
          <div style={label}>
            {shownSeries.confidence === 'low'
              ? 'This might be a series'
              : shownSeries.source === 'corpus'
                ? 'The catalogue places this in'
                : 'The title suggests a series'}
          </div>
          <div
            style={{
              ...displayS,
              fontSize: 'var(--size-display-s)',
              lineHeight: 'var(--lh-display-s)',
            }}
          >
            {shownSeries.name}
          </div>
          <p style={{ ...caption, color: 'var(--text-secondary)', margin: 0 }}>
            {shownSeries.position !== undefined
              ? `${source.work.title} is entry ${shownSeries.position}.`
              : 'The entry number is not stated.'}
            {shownSeries.missingEarlierEntries.length
              ? ` ${shownSeries.missingEarlierEntries.length} earlier ${shownSeries.missingEarlierEntries.length === 1 ? 'entry is' : 'entries are'} missing from your library.`
              : ''}
          </p>
          {shownSeries.missingEarlierEntries.length ? (
            <div
              role="note"
              style={{
                padding: 'var(--space-3)',
                border: 'var(--hairline-width) solid var(--hairline-strong)',
                borderRadius: 'var(--radius-button)',
                background: 'var(--surface-sunken)',
              }}
            >
              <div style={{ ...label, color: 'var(--text-primary)' }}>Start earlier</div>
              <p style={{ ...caption, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                {shownSeries.missingEarlierEntries.map((entry) => entry.title).join(', ')}{' '}
                {shownSeries.missingEarlierEntries.length === 1 ? 'comes' : 'come'} before this
                entry. Grouping records the relationship but does not add anything else.
              </p>
            </div>
          ) : null}
          {confirmedSeriesId ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <button
                onClick={() => nav.push({ screen: 'series', id: confirmedSeriesId })}
                style={secondaryButton}
              >
                View the series
              </button>
              {shownSeries.missingEntries.length &&
              shownSeries.missingEntries.every((entry) => !!entry.formatHint) ? (
                <>
                  <div
                    role="note"
                    aria-label="Wishlist additions"
                    style={{
                      borderTop: 'var(--hairline-width) solid var(--hairline)',
                      borderBottom: 'var(--hairline-width) solid var(--hairline)',
                      maxHeight: 156,
                      overflowY: 'auto',
                    }}
                  >
                    <div style={{ ...label, padding: 'var(--space-2) 0' }}>
                      Entries to be added to Wishlist
                    </div>
                    {shownSeries.missingEntries.map((entry) => (
                      <div
                        key={entry.corpusId}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 'var(--space-2)',
                          padding: 'var(--space-2) 0',
                          borderTop: 'var(--hairline-width) solid var(--hairline)',
                        }}
                      >
                        <span style={{ ...caption, color: 'var(--text-primary)' }}>
                          {entry.title}
                        </span>
                        {entry.seriesPosition !== undefined ? (
                          <span style={{ ...label, flexShrink: 0 }}>
                            Entry {entry.seriesPosition}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <button
                    disabled={!!busy}
                    onClick={() => void addMissing(shownSeries)}
                    style={primaryButton}
                  >
                    {busy === 'bulk'
                      ? 'Adding…'
                      : `Put ${shownSeries.missingEntries.length} missing ${shownSeries.missingEntries.length === 1 ? 'entry' : 'entries'} on Wishlist`}
                  </button>
                </>
              ) : null}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                disabled={!!busy}
                onClick={() => setDismissedSeries(true)}
                style={secondaryButton}
              >
                Not this series
              </button>
              <button
                disabled={!!busy}
                onClick={() => void confirmSeries(shownSeries)}
                style={primaryButton}
              >
                {busy === 'series' ? 'Grouping…' : 'Group it'}
              </button>
            </div>
          )}
        </SuggestionCard>
      ) : null}

      {shownUniverse ? (
        <SuggestionCard>
          <div style={label}>This continuity is also named</div>
          <div
            style={{
              ...displayS,
              fontSize: 'var(--size-display-s)',
              lineHeight: 'var(--lh-display-s)',
            }}
          >
            {shownUniverse.name}
          </div>
          {shownUniverse.description ? (
            <p style={{ ...caption, color: 'var(--text-secondary)', margin: 0 }}>
              {shownUniverse.description}
            </p>
          ) : null}
          {confirmedUniverseId ? (
            <button
              onClick={() => nav.push({ screen: 'universe', id: confirmedUniverseId })}
              style={secondaryButton}
            >
              View the universe
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                disabled={!!busy}
                onClick={() => setDismissedUniverse(true)}
                style={secondaryButton}
              >
                Not this universe
              </button>
              <button
                disabled={!!busy}
                onClick={() => void confirmUniverse(shownUniverse)}
                style={primaryButton}
              >
                {busy === 'universe' ? 'Linking…' : 'Link it'}
              </button>
            </div>
          )}
        </SuggestionCard>
      ) : null}
      {error ? (
        <p role="alert" style={{ ...caption, color: 'var(--danger-text)', margin: 0 }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}

function SuggestionCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        padding: 'var(--space-4)',
        border: 'var(--hairline-width) solid var(--hairline)',
        borderRadius: 'var(--radius-card)',
        background: 'var(--surface-raised)',
      }}
    >
      {children}
    </div>
  );
}

const secondaryButton: React.CSSProperties = {
  ...resetButton,
  flex: 1,
  minHeight: 44,
  padding: '0 12px',
  border: 'var(--hairline-width) solid var(--hairline-strong)',
  borderRadius: 'var(--radius-button)',
  color: 'var(--text-secondary)',
  textAlign: 'center',
};

const primaryButton: React.CSSProperties = {
  ...resetButton,
  flex: 1,
  minHeight: 44,
  padding: '0 12px',
  borderRadius: 'var(--radius-button)',
  background: 'var(--accent)',
  color: 'var(--on-accent)',
  textAlign: 'center',
};
