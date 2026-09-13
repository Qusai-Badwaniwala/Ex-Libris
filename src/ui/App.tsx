import { useEffect, useRef, useState, type ReactNode } from 'react';
import { nav, useNav, type Screen } from '../router/router';
import { purgeExpired } from '../db/repo';
import { requestPersistence } from '../storage/persist';
import { applyTheme, watchSystemTheme } from './theme';
import { APP_VERSION, useSettings } from './store';
import { Drawer, Fab, FabMenu, NavBar } from './chrome';
import { Home } from './screens/Home';
import { Format } from './screens/Format';
import { Detail } from './screens/Detail';
import { Trash } from './screens/Trash';
import { Wishlist } from './screens/Wishlist';
import { Settings } from './screens/Settings';
import { About } from './screens/About';
import { Tags } from './screens/Tags';
import { Bookplate, SpotlightTour, Welcome } from './screens/Onboarding';
import { Everything } from './screens/Everything';
import { SearchScreen } from './screens/Search';
import { Corpus } from './screens/Corpus';
import { Spine } from './screens/Spine';
import { SeriesScreen } from './screens/Series';
import { UniverseScreen } from './screens/Universe';
import { AxisScreen } from './screens/Axis';
import { Finish } from './screens/Finish';
import { Notes } from './screens/Notes';
import { Backup } from './screens/Backup';
import { Stats } from './screens/Stats';
import { NoteEditor } from './note-editor';
import { CatalogueSheet } from './catalogue-sheet';
import { ConnectionStatus } from './connection-status';
import { InteractionFeedback } from './interaction-feedback';
import { RelationshipEditor } from './relationship-editor';
import { ReadingOrderEditor } from './reading-order-editor';
import { CoverPicker } from './cover-picker';
import { ByHandSheet, EditWork, GenreEditor, SessionSheet, StatusPicker } from './sheets';
import { Splash } from './splash';
import { displayS, label, resetButton } from './styles';
import type { Format as FormatKey, Settings as SettingsRow, ThemeChoice } from '../db/schema';
import { maybeCreateAutomaticBackup } from '../data-safety/backup';

/**
 * The shell.
 *
 * One screen plus a stack of modal sheets, which is exactly the model the
 * design package uses — see design/HANDOFF.md. The difference is that here each
 * layer owns a history entry, so the Android back gesture closes the topmost
 * sheet before it touches the screen underneath. Nothing about the design
 * changes; the hardware gesture just has something correct to do.
 */
export function App() {
  const { settings, update, loadError } = useSettings();
  const { screens, overlays } = useNav();
  const route = screens[screens.length - 1]!;
  const underRoute = route.screen === 'axis' ? screens.at(-2) : undefined;
  const overlay = overlays[overlays.length - 1] ?? null;
  const noteEditorOverlay = [...overlays].reverse().find((layer) => layer.kind === 'noteEditor');
  const [booted, setBooted] = useState(false);
  const shareHandled = useRef(false);
  const basePath = import.meta.env.BASE_URL;
  const sharePath = `${basePath.replace(/\/$/, '')}/share`;

  useEffect(() => {
    if (!settings) return;
    applyTheme(settings.theme);
    return watchSystemTheme(settings.theme, () => {});
  }, [settings]);

  useEffect(() => {
    // Persistence is asked for once, at first open. A refusal is not an error —
    // Chrome grants it silently once the app is installed to the home screen
    // and usually refuses before that.
    void requestPersistence();
    // Thirty-day retention can only be enforced when the app is opened; there
    // is no server and no background job. See OPEN-QUESTIONS Q-021.
    void purgeExpired();
  }, []);

  useEffect(() => {
    if (!settings?.ownerName) return;
    // Automatic snapshots are silent and local. Failure leaves the previous
    // snapshot and timestamp untouched; the Backup screen remains the honest
    // recovery path.
    void maybeCreateAutomaticBackup(APP_VERSION, settings.lastAutoBackupAt).catch(() => {});
  }, [settings]);

  useEffect(() => {
    if (
      !booted ||
      !settings?.ownerName ||
      shareHandled.current ||
      location.pathname !== sharePath
    ) {
      return;
    }
    shareHandled.current = true;
    const params = new URLSearchParams(location.search);
    const query =
      params.get('title')?.trim() || params.get('text')?.trim() || params.get('url')?.trim();
    history.replaceState(history.state, '', basePath);
    if (!query) return;
    // Wishlist is the documented share-target default. The catalogue overlay
    // keeps the shared words visible and pre-searches when the local index is
    // installed; Add by hand remains alongside it when it is not.
    nav.reset({ screen: 'wishlist' });
    nav.open({ kind: 'catalogue', query });
  }, [basePath, booted, settings?.ownerName, sharePath]);

  const theme: 'light' | 'dark' =
    settings?.theme === 'light'
      ? 'light'
      : settings?.theme === 'dark'
        ? 'dark'
        : document.documentElement.getAttribute('data-theme') === 'light'
          ? 'light'
          : 'dark';

  const setTheme = (t: ThemeChoice) => {
    const previous = settings?.theme ?? 'system';
    applyTheme(t);
    void update({ theme: t }).then((saved) => {
      if (!saved) applyTheme(previous);
    });
  };

  if (loadError) return <SettingsLoadError message={loadError} />;
  if (!booted || !settings) {
    return <Splash onDone={() => setBooted(true)} />;
  }

  // First run, in order: welcome, then the bookplate. Both supply their own
  // furniture, so neither gets the nav bar or the FAB (D-077).
  if (!settings.welcomeSeenAt) {
    return (
      <Frame>
        <Welcome onNext={() => void update({ welcomeSeenAt: new Date().toISOString() })} />
      </Frame>
    );
  }
  if (!settings.ownerName) {
    return (
      <Frame>
        <Bookplate onDone={(name) => void update({ ownerName: name })} />
      </Frame>
    );
  }

  return (
    <Frame>
      {underRoute ? (
        <>
          <div aria-hidden="true" inert style={{ position: 'absolute', inset: 0 }}>
            {renderScreen(underRoute.screen, underRoute, theme, setTheme, settings, update)}
          </div>
          {renderScreen(route.screen, route, theme, setTheme, settings, update)}
        </>
      ) : (
        renderScreen(route.screen, route, theme, setTheme, settings, update)
      )}

      <NavBar screen={route.screen} />
      <Fab screen={route.screen} onOpen={() => nav.open({ kind: 'fabMenu' })} />

      {!settings.tourCompletedAt && (route.screen === 'home' || route.screen === 'settings') ? (
        <SpotlightTour
          onDone={() => void update({ tourCompletedAt: new Date().toISOString() })}
          onShowSettings={() => nav.reset({ screen: 'settings' })}
        />
      ) : null}

      {overlay?.kind === 'drawer' ? (
        <Drawer onClose={() => nav.close()} ownerName={settings.ownerName} />
      ) : null}
      {overlay?.kind === 'fabMenu' ? (
        <FabMenu
          onClose={() => nav.close()}
          onCatalogue={() => nav.swap({ kind: 'catalogue' })}
          // One layer, one history entry: the menu and the sheet it becomes
          // are the same step. Closing then opening is a race that loses.
          onByHand={() => nav.swap({ kind: 'byHand' })}
        />
      ) : null}
      {overlay?.kind === 'catalogue' ? <CatalogueSheet initialQuery={overlay.query} /> : null}
      {overlay?.kind === 'byHand' ? (
        <ByHandSheet
          candidate={overlay.candidate}
          initialTitle={overlay.initialTitle}
          onClose={() => nav.close()}
          onAdded={(id) => nav.closeAndPush({ screen: 'detail', id, suggestRelationships: true })}
          // The screen you were on says what you meant. Adding from the
          // Wishlist means adding to the wishlist; adding from the Manhwa shelf
          // means adding a manhwa.
          defaultStatus={route.screen === 'wishlist' ? 'wishlist' : 'reading'}
          defaultFormat={route.screen === 'format' && route.format ? route.format : 'novel'}
        />
      ) : null}
      {overlay?.kind === 'editWork' && overlay.id ? (
        <EditWork id={overlay.id} onClose={() => nav.close()} />
      ) : null}
      {overlay?.kind === 'statusPicker' && overlay.id ? (
        <StatusPicker
          id={overlay.id}
          onClose={() => nav.close()}
          onFinished={() => nav.closeAndPush({ screen: 'finish', id: overlay.id })}
        />
      ) : null}
      {overlay?.kind === 'seriesPicker' && overlay.id ? (
        <RelationshipEditor id={overlay.id} onClose={() => nav.close()} />
      ) : null}
      {overlay?.kind === 'readingOrderEditor' && overlay.id && overlay.contextType ? (
        <ReadingOrderEditor
          id={overlay.id}
          contextType={overlay.contextType}
          onClose={() => nav.close()}
        />
      ) : null}
      {overlay?.kind === 'session' && overlay.id ? (
        <SessionSheet
          id={overlay.id}
          onClose={() => nav.close()}
          onFinished={() => nav.closeAndPush({ screen: 'finish', id: overlay.id })}
        />
      ) : null}
      {overlay?.kind === 'genreEditor' && overlay.id ? (
        <GenreEditor id={overlay.id} onClose={() => nav.close()} />
      ) : null}
      {overlay?.kind === 'coverPicker' && overlay.id ? <CoverPicker id={overlay.id} /> : null}
      {noteEditorOverlay ? (
        <NoteEditor id={noteEditorOverlay.id} tagPickerOpen={overlay?.kind === 'noteTags'} />
      ) : null}
    </Frame>
  );
}

function renderScreen(
  screen: Screen,
  route: {
    id?: string;
    format?: FormatKey;
    genre?: import('../db/schema').GenreIndex;
    suggestRelationships?: boolean;
    axis?: import('../axes/axes').AxisKey;
  },
  theme: 'light' | 'dark',
  setTheme: (t: ThemeChoice) => void,
  settings: SettingsRow,
  updateSettings: (patch: Partial<SettingsRow>) => Promise<boolean>,
) {
  switch (screen) {
    case 'home':
      return <Home theme={theme} onTheme={setTheme} />;
    case 'format':
      return <Format format={route.format ?? 'novel'} />;
    case 'detail':
      return route.id ? (
        <Detail id={route.id} suggestRelationships={route.suggestRelationships} />
      ) : (
        <NotBuilt screen="Detail" phase="1" />
      );
    case 'series':
      return route.id ? <SeriesScreen id={route.id} /> : <NotBuilt screen="Series" phase="5" />;
    case 'universe':
      return route.id ? <UniverseScreen id={route.id} /> : <NotBuilt screen="Universe" phase="5" />;
    case 'axis':
      return route.id ? (
        <AxisScreen id={route.id} initialKey={route.axis} />
      ) : (
        <NotBuilt screen="Axes" phase="6" />
      );
    case 'finish':
      return route.id ? <Finish id={route.id} /> : <NotBuilt screen="Finished" phase="6" />;
    case 'trash':
      return <Trash />;
    case 'wishlist':
      return <Wishlist />;
    case 'search':
      return <SearchScreen />;
    case 'corpus':
      return <Corpus />;
    case 'everything':
      return <Everything initialGenre={route.genre} />;
    case 'spine':
      return <Spine format={route.format ?? 'novel'} />;
    case 'stats':
      return <Stats />;
    case 'notes':
      return <Notes />;
    case 'settings':
      return <Settings settings={settings} update={updateSettings} />;
    case 'backup':
      return <Backup />;
    case 'about':
      return <About settings={settings} />;
    case 'tags':
      return <Tags />;
    default:
      return <NotBuilt screen={screen} phase="1" />;
  }
}

function SettingsLoadError({ message }: { message: string }) {
  return (
    <Frame>
      <main
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 'var(--page-gutter)',
        }}
      >
        <h1 style={{ ...displayS, margin: 0 }}>The library could not open</h1>
        <p role="alert" style={{ ...label, marginTop: 'var(--space-3)' }}>
          {message} Close Ex Libris and try again. Your stored library was not changed.
        </p>
      </main>
    </Frame>
  );
}

/**
 * The full-bleed positioning context every screen sits inside, matching the
 * prototype's phone frame. Fluid rather than 390×720: that size was a prototype
 * constraint (design START-HERE §7 — taller and the host scaled the page down),
 * not a design decision, and the app has to fit whatever phone it is opened on.
 */
function Frame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--surface-base)',
        color: 'var(--text-primary)',
        overflow: 'hidden',
      }}
    >
      {children}
      <ConnectionStatus />
      <InteractionFeedback />
    </div>
  );
}

/**
 * A screen that has a route but no implementation yet.
 *
 * Written in the mono developer voice the design package uses for its own
 * scaffolding, and it names the phase. The alternative — a plausible-looking
 * empty state — would be indistinguishable from a screen whose data failed to
 * load, and the app would be quietly lying about what it can do.
 */
function NotBuilt({ screen, phase }: { screen: string; phase: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-6)',
        textAlign: 'center',
      }}
    >
      <div style={displayS}>{screen}</div>
      <div style={{ ...label, fontFamily: 'var(--font-mono)' }}>
        not built yet · phase {phase} · v{APP_VERSION}
      </div>
      <button
        onClick={() => nav.reset({ screen: 'home' })}
        style={{
          ...resetButton,
          marginTop: 'var(--space-3)',
          fontSize: 'var(--size-caption)',
          color: 'var(--accent-text)',
        }}
      >
        Back to the library
      </button>
    </div>
  );
}
