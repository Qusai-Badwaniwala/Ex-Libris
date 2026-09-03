import { useEffect, useState, type ReactNode } from 'react';
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
import { Bookplate, Welcome } from './screens/Onboarding';
import { ByHandSheet, EditWork, GenreEditor, SessionSheet, StatusPicker } from './sheets';
import { Splash } from './splash';
import { displayS, label, resetButton } from './styles';
import type { Format as FormatKey, ThemeChoice } from '../db/schema';

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
  const { settings, update } = useSettings();
  const { screens, overlays } = useNav();
  const route = screens[screens.length - 1]!;
  const overlay = overlays[overlays.length - 1] ?? null;
  const [booted, setBooted] = useState(false);

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

  const theme: 'light' | 'dark' =
    settings?.theme === 'light'
      ? 'light'
      : settings?.theme === 'dark'
        ? 'dark'
        : document.documentElement.getAttribute('data-theme') === 'light'
          ? 'light'
          : 'dark';

  const setTheme = (t: ThemeChoice) => {
    applyTheme(t);
    void update({ theme: t });
  };

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
      {renderScreen(route.screen, route, theme, setTheme)}

      <NavBar screen={route.screen} />
      <Fab screen={route.screen} onOpen={() => nav.open({ kind: 'fabMenu' })} />

      {overlay?.kind === 'drawer' ? (
        <Drawer onClose={() => nav.close()} ownerName={settings.ownerName} />
      ) : null}
      {overlay?.kind === 'fabMenu' ? (
        <FabMenu
          onClose={() => nav.close()}
          onCatalogue={() => nav.close()}
          // One layer, one history entry: the menu and the sheet it becomes
          // are the same step. Closing then opening is a race that loses.
          onByHand={() => nav.swap({ kind: 'byHand' })}
        />
      ) : null}
      {overlay?.kind === 'byHand' ? (
        <ByHandSheet
          onClose={() => nav.close()}
          onAdded={(id) => nav.closeAndPush({ screen: 'detail', id })}
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
        <StatusPicker id={overlay.id} onClose={() => nav.close()} />
      ) : null}
      {overlay?.kind === 'session' && overlay.id ? (
        <SessionSheet id={overlay.id} onClose={() => nav.close()} />
      ) : null}
      {overlay?.kind === 'genreEditor' && overlay.id ? (
        <GenreEditor id={overlay.id} onClose={() => nav.close()} />
      ) : null}
    </Frame>
  );
}

function renderScreen(
  screen: Screen,
  route: { id?: string; format?: FormatKey },
  theme: 'light' | 'dark',
  setTheme: (t: ThemeChoice) => void,
) {
  switch (screen) {
    case 'home':
      return <Home theme={theme} onTheme={setTheme} />;
    case 'format':
      return <Format format={route.format ?? 'novel'} />;
    case 'detail':
      return route.id ? <Detail id={route.id} /> : <NotBuilt screen="Detail" phase="1" />;
    case 'trash':
      return <Trash />;
    case 'wishlist':
      return <Wishlist />;
    case 'search':
      return <NotBuilt screen="Search" phase="3" />;
    case 'everything':
      return <NotBuilt screen="Everything" phase="1" />;
    case 'spine':
      return <NotBuilt screen="Spine view" phase="9" />;
    case 'stats':
      return <NotBuilt screen="Stats" phase="9" />;
    case 'notes':
      return <NotBuilt screen="Notes" phase="7" />;
    case 'settings':
      return <Settings />;
    case 'backup':
      return <NotBuilt screen="Backup and restore" phase="8" />;
    case 'about':
      return <About />;
    default:
      return <NotBuilt screen={screen} phase="1" />;
  }
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
