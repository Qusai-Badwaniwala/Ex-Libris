import { useEffect, useRef } from 'react';
import { nav, useNav, type Screen } from '../router/router';
import {
  AboutIcon,
  BackupIcon,
  LibraryTab,
  NoteIcon,
  Pencil,
  Plus,
  SettingsTab,
  StatsTab,
  TrashIcon,
  WishlistTab,
  Search as SearchIcon,
} from './icons';
import { displayM, label, resetButton } from './styles';
import {
  DRAWER_ROW_DELAYS,
  FAB_DOOR_DELAYS,
  LEAF_GRADIENT,
  SCRIM,
  SCRIM_MENU,
} from './design-literals';
import { tick } from './haptics';
import { prefersReducedMotion } from './theme';

/* ── Bottom navigation ──────────────────────────────────────────────────── */

/** Screens that supply their own bottom furniture, so the bar would sit on top
 *  of their own confirm control (D-077, D-102). */
const NO_CHROME: Screen[] = ['bookplate', 'welcome', 'finish', 'corpus', 'tagpick'];

/** The Library tab stays lit across every screen you can reach from it. A
 *  screen you can reach with no tab lit is a screen the app has lost track of
 *  (D-075). */
const LIBRARY_SCREENS: Screen[] = [
  'home',
  'format',
  'detail',
  'series',
  'universe',
  'spine',
  'everything',
  'axis',
  'search',
];
const SETTINGS_SCREENS: Screen[] = ['settings', 'backup', 'trash', 'about'];

export function NavBar({ screen }: { screen: Screen }) {
  if (NO_CHROME.includes(screen)) return null;

  const ink = (on: boolean) => (on ? 'var(--accent-text)' : 'var(--text-secondary)');
  const tabs = [
    {
      key: 'library',
      name: 'Library',
      on: LIBRARY_SCREENS.includes(screen),
      Icon: LibraryTab,
      go: () => nav.reset({ screen: 'home' }),
    },
    {
      key: 'wishlist',
      name: 'Wishlist',
      on: screen === 'wishlist',
      Icon: WishlistTab,
      go: () => nav.replace({ screen: 'wishlist' }),
    },
    {
      key: 'stats',
      name: 'Stats',
      on: screen === 'stats',
      Icon: StatsTab,
      go: () => nav.replace({ screen: 'stats' }),
    },
    {
      key: 'settings',
      name: 'Settings',
      on: SETTINGS_SCREENS.includes(screen),
      Icon: SettingsTab,
      go: () => nav.replace({ screen: 'settings' }),
    },
  ];

  return (
    <nav
      aria-label="Sections"
      style={{
        position: 'absolute',
        left: 'var(--nav-inset)',
        right: 'var(--nav-inset)',
        bottom: 'calc(var(--nav-lift) + var(--safe-bottom))',
        height: 'var(--nav-height)',
        display: 'flex',
        alignItems: 'stretch',
        background: 'var(--glass-fill)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        border: 'var(--hairline-width) solid var(--hairline-strong)',
        borderRadius: 'var(--radius-pill)',
        // The ring is not decoration: it is the only thing that keeps the bar's
        // edge legible over a dense list (D-068). Never ship the fill and blur
        // without it.
        boxShadow: 'var(--glass-ring), var(--shadow-nav)',
        overflow: 'hidden',
        zIndex: 'var(--z-nav)' as unknown as number,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'var(--radius-pill)',
          background: 'var(--glass-sheen)',
          pointerEvents: 'none',
        }}
      />
      {tabs.map((t) => (
        <button
          key={t.key}
          data-ripple
          aria-current={t.on ? 'page' : undefined}
          onClick={t.go}
          style={{
            ...resetButton,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-1)',
          }}
        >
          <t.Icon color={ink(t.on)} />
          <span style={{ ...label, color: ink(t.on) }}>{t.name}</span>
        </button>
      ))}
    </nav>
  );
}

/* ── The FAB ────────────────────────────────────────────────────────────── */

/** The FAB expands, it never navigates. Its glyph changes with context and
 *  nothing else does (D-052). */
const FAB_SCREENS: Screen[] = ['home', 'format', 'wishlist', 'notes', 'everything', 'spine'];

export function Fab({ screen, onOpen }: { screen: Screen; onOpen: () => void }) {
  const { overlays } = useNav();
  if (!FAB_SCREENS.includes(screen) || overlays.length > 0) return null;
  const isEditor = screen === 'notes';

  return (
    <button
      // data-no-press: the FAB owns its own transform because it morphs into a
      // sheet, and a competing press-scale fights the view transition (D-061).
      data-no-press
      aria-label={isEditor ? 'Write a note' : 'Add to the library'}
      onClick={() => {
        tick();
        onOpen();
      }}
      style={{
        ...resetButton,
        position: 'absolute',
        right: 'var(--space-4)',
        // 82px, not 72px: the nav bar floats now and the FAB has to clear it
        // (D-049).
        bottom: 'calc(82px + var(--safe-bottom))',
        zIndex: 'var(--z-fab)' as unknown as number,
        width: 'var(--fab-size)',
        height: 'var(--fab-size)',
        // Not a circle. The 16px corner radius is what lets it morph into the
        // sheet (COMPONENTS, FAB).
        borderRadius: 'var(--radius-sheet)',
        background: 'var(--accent)',
        boxShadow: 'var(--shadow-fab)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform var(--dur-fast) var(--ease-snap)',
      }}
    >
      {isEditor ? <Pencil size={20} color="var(--on-accent)" /> : <Plus />}
    </button>
  );
}

/* ── The FAB's two named doors ──────────────────────────────────────────── */

/** Rather than guessing which kind of add you meant, it blooms into two named
 *  doors (D-055, D-056). The menu sits BELOW the FAB in z-order so the scrim
 *  darkens the app but not the control you just pressed (D-062). */
export function FabMenu({
  onCatalogue,
  onByHand,
  onClose,
}: {
  onCatalogue: () => void;
  onByHand: () => void;
  onClose: () => void;
}) {
  const doors = [
    {
      key: 'catalogue',
      text: 'Search the catalogue',
      icon: <SearchIcon size={22} color="var(--text-primary)" />,
      go: onCatalogue,
      delay: FAB_DOOR_DELAYS[0],
    },
    {
      key: 'byhand',
      text: 'Add by hand',
      icon: <Pencil />,
      go: onByHand,
      delay: FAB_DOOR_DELAYS[1],
    },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 45 }}>
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          ...resetButton,
          position: 'absolute',
          inset: 0,
          background: SCRIM_MENU,
          animation: 'exl-fade var(--dur-base) var(--ease-out) both',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 'var(--space-4)',
          bottom: 'calc(154px + var(--safe-bottom))',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 14,
          transformOrigin: '100% 100%',
        }}
      >
        {doors.map((d) => (
          <button
            key={d.key}
            onClick={d.go}
            style={{
              ...resetButton,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              animation: `exl-drawer-item var(--duration-medium) var(--ease-spring-back) ${d.delay} both`,
            }}
          >
            {/* Labels are on the rows, not left to icons (D-056). */}
            <span
              style={{
                padding: '9px 14px',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--surface-overlay)',
                border: 'var(--hairline-width) solid var(--hairline-strong)',
                boxShadow: 'var(--shadow-fab)',
                fontSize: 'var(--size-body)',
                lineHeight: '20px',
                whiteSpace: 'nowrap',
              }}
            >
              {d.text}
            </span>
            {/* The same size as the button they came out of, which is what makes
                them read as it opening rather than as a popup arriving. */}
            <span
              data-ripple
              style={{
                width: 'var(--fab-size)',
                height: 'var(--fab-size)',
                flex: 'none',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--surface-overlay)',
                border: 'var(--hairline-width) solid var(--hairline-strong)',
                boxShadow: 'var(--shadow-fab)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {d.icon}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── The left drawer ────────────────────────────────────────────────────── */

/** Its head is the wordmark alone — the owner's name lives on About only, so
 *  the drawer never reads as an account panel (D-041). */
export function Drawer({ onClose, ownerName }: { onClose: () => void; ownerName?: string }) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = panel.current;
    if (!el || prefersReducedMotion()) return;
    el.style.transition = 'none';
    el.style.transform = 'translateX(-100%)';
    void el.offsetWidth;
    // 380ms: it is the only surface that crosses the whole screen, so it is the
    // only one that earns longer than --duration-fluid (D-065).
    el.style.transition = 'transform var(--duration-drawer) var(--ease-fluid-out)';
    el.style.transform = 'none';
  }, []);

  const rows = [
    { key: 'notes', name: 'Notes', Icon: NoteIcon, go: () => nav.reset({ screen: 'notes' }) },
    { key: 'trash', name: 'Trash', Icon: TrashIcon, go: () => nav.reset({ screen: 'trash' }) },
    {
      key: 'backup',
      name: 'Backup and restore',
      Icon: BackupIcon,
      go: () => nav.reset({ screen: 'backup' }),
    },
    { key: 'about', name: 'About', Icon: AboutIcon, go: () => nav.reset({ screen: 'about' }) },
  ];

  return (
    <div
      style={{ position: 'absolute', inset: 0, zIndex: 70 }}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
    >
      <button
        onClick={onClose}
        aria-label="Close the menu"
        style={{
          ...resetButton,
          position: 'absolute',
          inset: 0,
          background: SCRIM,
          animation: 'exl-fade var(--dur-slow) var(--ease-out) both',
        }}
      />
      <div
        ref={panel}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 276,
          background: 'var(--surface-overlay)',
          borderRight: 'var(--hairline-width) solid var(--hairline)',
          display: 'flex',
          flexDirection: 'column',
          willChange: 'transform',
          paddingTop: 'var(--safe-top)',
        }}
      >
        <div
          style={{
            padding: '28px 20px 20px',
            borderBottom: 'var(--hairline-width) solid var(--hairline)',
          }}
        >
          <div style={displayM}>Ex Libris</div>
          {ownerName ? (
            <div
              style={{
                ...label,
                letterSpacing: '0.06em',
                marginTop: 3,
                // Gold leaf rather than a yellow label: the gradient is clipped
                // to the text (D-091). Drawer only — on all five wordmarks it
                // turned a credit into a watermark.
                background: LEAF_GRADIENT,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              By {ownerName}
            </div>
          ) : null}
        </div>
        {rows.map((r, i) => (
          <button
            key={r.key}
            data-ripple
            data-hover="raised"
            onClick={() => {
              onClose();
              r.go();
            }}
            style={{
              ...resetButton,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              height: 56,
              padding: '0 20px',
              animation: `exl-drawer-item var(--duration-drawer) var(--ease-fluid-out) ${DRAWER_ROW_DELAYS[i]} both`,
            }}
          >
            <r.Icon />
            <span style={{ fontSize: 'var(--size-body)' }}>{r.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
