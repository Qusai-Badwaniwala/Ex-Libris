import { useCallback, useEffect, useState } from 'react';
import { db, loadSettings, saveSettings, DB_VERSION } from '../db/db';
import type { Settings, ThemeChoice } from '../db/schema';
import { SCHEMA_VERSION } from '../db/schema';
import { GENRES, ALL_TAGS } from '../data/taxonomy';
import { localDay } from '../db/dates';
import { opfsAvailable, writeFile, readFile, deleteFile, storageUsage } from '../storage/opfs';
import { requestPersistence, type PersistState } from '../storage/persist';
import { applyTheme, watchSystemTheme } from './theme';
import { nav, useNav } from '../router/router';

const APP_VERSION = '0.1.0';

/**
 * PHASE 0 · FOUNDATIONS
 *
 * This is not an app screen and is not styled like one. It is written in the
 * mono developer voice the design package uses for its own scaffolding (the
 * jump bar, the state pills), so it can never be mistaken for shipped UI. It
 * exists to make Phase 0 provable by hand rather than by assertion: open it and
 * every foundation reports its real state.
 *
 * The whole of it is deleted in Phase 1, when the real Home screen lands.
 */

interface Diagnostics {
  dbOpen: boolean;
  dbVersion: number;
  opfs: boolean;
  opfsRoundTrip: 'pass' | 'fail' | 'unavailable';
  persist: PersistState;
  usedBytes: number;
  quotaBytes: number;
  persisted: boolean;
  error?: string;
}

const mono: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--size-label)',
  lineHeight: 'var(--lh-label)',
  color: 'var(--text-secondary)',
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 'var(--space-3)',
        padding: 'var(--space-2) 0',
        borderTop: 'var(--hairline-width) solid var(--hairline)',
      }}
    >
      <span style={{ ...mono, flex: 1 }}>{label}</span>
      <span
        style={{
          ...mono,
          color: 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
          textAlign: 'right',
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const navState = useNav();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const result: Diagnostics = {
        dbOpen: false,
        dbVersion: DB_VERSION,
        opfs: false,
        opfsRoundTrip: 'unavailable',
        persist: 'unsupported',
        usedBytes: 0,
        quotaBytes: 0,
        persisted: false,
      };

      try {
        await db.open();
        result.dbOpen = true;
        const s = await loadSettings(APP_VERSION);
        if (!cancelled) setSettings(s);

        result.opfs = await opfsAvailable();
        if (result.opfs) {
          // A real round trip, not a capability sniff. "OPFS is available" and
          // "OPFS can hold a file" are different claims and only the second one
          // matters to covers and backups.
          const probe = 'diagnostics/phase-0.txt';
          await writeFile(probe, 'ex libris');
          const back = await readFile(probe);
          result.opfsRoundTrip = (await back?.text()) === 'ex libris' ? 'pass' : 'fail';
          await deleteFile(probe);
        }

        result.persist = await requestPersistence();
        const usage = await storageUsage();
        result.usedBytes = usage.usedBytes;
        result.quotaBytes = usage.quotaBytes;
        result.persisted = usage.persisted;
      } catch (e) {
        result.error = e instanceof Error ? e.message : String(e);
      }

      if (!cancelled) setDiag(result);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!settings) return;
    applyTheme(settings.theme);
    return watchSystemTheme(settings.theme, () => {});
  }, [settings]);

  const setTheme = useCallback(async (theme: ThemeChoice) => {
    applyTheme(theme);
    await saveSettings({ theme });
    setSettings((prev) => (prev ? { ...prev, theme } : prev));
  }, []);

  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

  return (
    <div
      className="exl-scroll"
      style={{
        minHeight: '100dvh',
        background: 'var(--surface-base)',
        color: 'var(--text-primary)',
        padding: `calc(var(--safe-top) + var(--space-6)) var(--page-gutter) calc(var(--safe-bottom) + var(--space-8))`,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-5)',
        maxWidth: '520px',
        margin: '0 auto',
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 'var(--display-vf)',
            fontSize: 'var(--size-display-l)',
            lineHeight: 'var(--lh-display-l)',
            letterSpacing: 'var(--tracking-display)',
          }}
        >
          Ex Libris
        </div>
        <div style={mono}>phase 0 · foundations · not an app screen</div>
      </header>

      <section>
        <div style={{ ...mono, paddingBottom: 'var(--space-2)' }}>store</div>
        <Row label="indexeddb open" value={diag ? (diag.dbOpen ? 'yes' : 'no') : '…'} />
        <Row label="db version" value={String(DB_VERSION)} />
        <Row label="schema version" value={String(SCHEMA_VERSION)} />
        <Row label="opfs available" value={diag ? (diag.opfs ? 'yes' : 'no') : '…'} />
        <Row label="opfs round trip" value={diag ? diag.opfsRoundTrip : '…'} />
        <Row label="storage persisted" value={diag ? diag.persist : '…'} />
        <Row label="used" value={diag ? mb(diag.usedBytes) : '…'} />
        <Row label="quota" value={diag ? mb(diag.quotaBytes) : '…'} />
        {diag?.error ? <Row label="error" value={diag.error} /> : null}
      </section>

      <section>
        <div style={{ ...mono, paddingBottom: 'var(--space-2)' }}>contract</div>
        <Row label="genres" value={String(GENRES.length)} />
        <Row label="seeded tags" value={String(ALL_TAGS.length)} />
        <Row label="owner name" value={settings?.ownerName ?? 'not set'} />
        <Row
          label="first tracked"
          value={settings?.firstTrackedAt ? localDay(settings.firstTrackedAt) : '—'}
        />
        <Row
          label="content warnings"
          value={settings ? (settings.contentWarningsOn ? 'on' : 'off') : '…'}
        />
      </section>

      <section>
        <div style={{ ...mono, paddingBottom: 'var(--space-2)' }}>
          theme · every value below comes from tokens.css
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', paddingBottom: 'var(--space-3)' }}>
          {(['dark', 'light', 'system'] as const).map((t) => (
            <button
              key={t}
              onClick={() => void setTheme(t)}
              style={{
                all: 'unset',
                boxSizing: 'border-box',
                cursor: 'pointer',
                ...mono,
                padding: 'var(--space-1) var(--space-2)',
                borderRadius: 'var(--radius-chip)',
                border: `var(--hairline-width) solid ${
                  settings?.theme === t ? 'var(--accent)' : 'var(--hairline)'
                }`,
                color: settings?.theme === t ? 'var(--accent-text)' : 'var(--text-secondary)',
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
          {GENRES.map((g) => (
            <span
              key={g.colorIndex}
              title={`${g.colorIndex} · ${g.name}`}
              style={{
                width: 'var(--space-5)',
                height: 'var(--space-5)',
                borderRadius: 'var(--radius-chip)',
                background: `var(--genre-${g.colorIndex})`,
              }}
            />
          ))}
        </div>
      </section>

      <section>
        <div style={{ ...mono, paddingBottom: 'var(--space-2)' }}>
          navigation · the android back gesture should undo each push
        </div>
        <Row label="screen stack" value={navState.screens.map((s) => s.screen).join(' › ')} />
        <Row
          label="overlay stack"
          value={
            navState.overlays.length ? navState.overlays.map((o) => o.kind).join(' › ') : 'none'
          }
        />
        <div style={{ display: 'flex', gap: 'var(--space-2)', paddingTop: 'var(--space-3)' }}>
          <button
            onClick={() => nav.push({ screen: 'detail', id: 'probe' })}
            style={{
              all: 'unset',
              boxSizing: 'border-box',
              cursor: 'pointer',
              ...mono,
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: 'var(--radius-chip)',
              border: 'var(--hairline-width) solid var(--hairline)',
              color: 'var(--text-secondary)',
            }}
          >
            push screen
          </button>
          <button
            onClick={() => nav.open({ kind: 'drawer' })}
            style={{
              all: 'unset',
              boxSizing: 'border-box',
              cursor: 'pointer',
              ...mono,
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: 'var(--radius-chip)',
              border: 'var(--hairline-width) solid var(--hairline)',
              color: 'var(--text-secondary)',
            }}
          >
            open sheet
          </button>
          <button
            onClick={() => nav.back()}
            style={{
              all: 'unset',
              boxSizing: 'border-box',
              cursor: 'pointer',
              ...mono,
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: 'var(--radius-chip)',
              border: 'var(--hairline-width) solid var(--accent)',
              color: 'var(--accent-text)',
            }}
          >
            back
          </button>
        </div>
      </section>

      <footer style={{ ...mono, paddingTop: 'var(--space-4)' }}>
        Nothing here ships. Phase 1 replaces this with the real Home screen, ported from
        design/Ex&nbsp;Libris.dc.html.
      </footer>
    </div>
  );
}
