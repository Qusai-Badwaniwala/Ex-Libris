import { useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, saveSettings } from '../../db/db';
import { catalogueInstallStore, installCatalogue } from '../../catalogue/install';
import { nav } from '../../router/router';
import {
  body,
  caption,
  displayM,
  primaryButton,
  quietButton,
  screenScroll,
  tabular,
} from '../styles';
import { Illustration } from '../illustration';

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function Corpus() {
  const state = useSyncExternalStore(
    catalogueInstallStore.subscribe,
    catalogueInstallStore.getSnapshot,
  );
  const settings = useLiveQuery(() => db.settings.get('singleton'), []);
  const downloading = state.phase === 'downloading';
  const busy = downloading || state.phase === 'checking';
  const error =
    state.phase === 'error' ? state.message : state.phase === 'unavailable' ? state.reason : '';
  const installed = state.phase === 'ready' || !!settings?.corpusVersion;
  return (
    <div
      className="exl-scroll"
      style={{ ...screenScroll, padding: 'calc(24px + var(--safe-top)) 16px 104px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 20px' }}>
        <Illustration name="library-pana" style={{ width: '100%', maxWidth: 330 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h1 style={{ ...displayM, margin: 0 }}>
          {busy
            ? 'Building the search index'
            : error
              ? 'The catalogue download stopped'
              : installed
                ? 'The downloaded index'
                : 'Download the search index'}
        </h1>
        <p style={{ ...body, margin: 0, color: 'var(--text-secondary)' }}>
          Nothing in your library changes. Only what search can find changes.
        </p>
        {state.phase === 'checking' && (
          <p role="status" style={caption}>
            Checking the index and this device…
          </p>
        )}
        {downloading && (
          <>
            <div
              role="progressbar"
              aria-label="Catalogue download"
              aria-valuemin={0}
              aria-valuemax={state.totalBytes}
              aria-valuenow={state.receivedBytes}
              style={{
                height: 4,
                borderRadius: 999,
                background: 'var(--hairline)',
                overflow: 'hidden',
                marginTop: 8,
              }}
            >
              <div
                style={{
                  width: `${(100 * state.receivedBytes) / state.totalBytes}%`,
                  height: '100%',
                  background: 'var(--accent)',
                }}
              />
            </div>
            <div role="status" style={{ ...caption, ...tabular, color: 'var(--text-secondary)' }}>
              {mb(state.receivedBytes)} of {mb(state.totalBytes)}
            </div>
            <p style={caption}>
              You can keep using the library. If the app closes, retrying resumes verified progress.
            </p>
          </>
        )}
        {error && (
          <p role="alert" style={{ ...caption, color: 'var(--danger-text)' }}>
            {error}
          </p>
        )}
        {state.phase === 'ready' && (
          <p
            role="status"
            style={{ ...caption, ...tabular, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <span>{state.works.toLocaleString()} works</span>
            <span
              aria-hidden="true"
              style={{
                height: 12,
                borderLeft: 'var(--hairline-width) solid var(--hairline-strong)',
              }}
            />
            <span>{mb(state.manifest.bytes)}</span>
          </p>
        )}
        {installed && (
          <p style={caption}>
            Installed:{' '}
            {settings?.corpusVersion ?? (state.phase === 'ready' ? state.manifest.version : '—')}
          </p>
        )}
        {!busy && (
          <button style={primaryButton} onClick={() => void installCatalogue()}>
            {error
              ? 'Retry the download'
              : installed
                ? 'Check for an updated index'
                : 'Download the index'}
          </button>
        )}
        {busy && (
          <button style={primaryButton} onClick={() => nav.reset({ screen: 'home' })}>
            Carry on in the background
          </button>
        )}
        {installed && !busy && (
          <button style={quietButton} onClick={() => nav.open({ kind: 'catalogue' })}>
            Search the catalogue
          </button>
        )}
        <button
          style={{
            ...quietButton,
            height: 'auto',
            lineHeight: '20px',
            minHeight: 44,
            padding: '10px 8px',
          }}
          onClick={() => {
            void saveSettings({ corpusSkippedAt: new Date().toISOString() }).then(() =>
              nav.reset({ screen: 'home' }),
            );
          }}
        >
          {busy || installed
            ? 'Back to the library'
            : 'Skip it — you can add by hand or search online.'}
        </button>
      </div>
    </div>
  );
}
