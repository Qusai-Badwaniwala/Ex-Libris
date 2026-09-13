import { useCallback, useEffect, useRef, useState } from 'react';
import { nav, useNav, type Screen } from '../router/router';
import {
  AboutIcon,
  BackupIcon,
  CatalogueIcon,
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
  DRAWER_ENTER_DURATION,
  DRAWER_EXIT_DURATION,
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
const NO_CHROME: Screen[] = ['bookplate', 'welcome', 'finish', 'corpus', 'tagpick', 'axis'];

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
const SETTINGS_SCREENS: Screen[] = ['settings', 'backup', 'trash', 'about', 'tags'];

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
      data-editorial-dock
      aria-label="Sections"
      style={{
        position: 'absolute',
        left: 'var(--nav-inset)',
        right: 'var(--nav-inset)',
        bottom: 'calc(var(--nav-lift) + var(--safe-bottom))',
        height: 64,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        background: 'var(--surface-overlay)',
        border: 'var(--hairline-width) solid var(--hairline-strong)',
        borderRadius:
          'var(--radius-sheet) var(--radius-sheet) var(--radius-card) var(--radius-card)',
        // The editorial dock is a registered object rather than the former
        // glass pill. Its soft offset shadow keeps it above a passing shelf.
        boxShadow: 'var(--glass-ring), var(--shadow-nav)',
        overflow: 'visible',
        zIndex: 'var(--z-nav)' as unknown as number,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 6,
          right: 10,
          left: 10,
          height: 'var(--hairline-width)',
          background: 'var(--hairline)',
          pointerEvents: 'none',
        }}
      />
      {tabs.map((t, index) => (
        <button
          key={t.key}
          aria-current={t.on ? 'page' : undefined}
          onClick={t.go}
          style={{
            ...resetButton,
            position: 'relative',
            display: 'grid',
            minWidth: 0,
            minHeight: 63,
            alignContent: 'center',
            justifyItems: 'center',
            gap: 'var(--space-1)',
            padding: '8px 2px 5px',
            borderRight:
              index === tabs.length - 1
                ? 'none'
                : 'var(--hairline-width) solid var(--hairline-strong)',
            borderRadius:
              index === 0
                ? 'var(--radius-sheet) 0 0 var(--radius-card)'
                : index === tabs.length - 1
                  ? '0 var(--radius-sheet) var(--radius-card) 0'
                  : 0,
            background: t.on
              ? 'color-mix(in oklab, var(--accent-deep) 58%, transparent)'
              : 'transparent',
            transition:
              'transform var(--dur-fast) var(--ease-snap), background-color var(--dur-fast) var(--ease-snap)',
          }}
        >
          {t.on ? (
            <span
              data-registration-stitch
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: -5,
                width: 22,
                height: 9,
                border:
                  'var(--hairline-width) solid color-mix(in oklab, var(--accent), var(--text-primary) 12%)',
                borderRadius: 'var(--radius-chip) var(--radius-chip) 2px 2px',
                background: 'var(--surface-raised)',
                boxShadow: 'inset 0 -3px 0 var(--accent)',
                animation: 'exl-rise var(--dur-slow) var(--ease-settle) both',
              }}
            />
          ) : null}
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
  const menuOpen = overlays.at(-1)?.kind === 'fabMenu';
  if (!FAB_SCREENS.includes(screen) || (overlays.length > 0 && !menuOpen)) return null;
  // Notes uses the same anchored control with the Claude pencil glyph; its
  // plain-text editor is real now, while Phase 7 adds linking and attachments.
  const isEditor = screen === 'notes';

  return (
    <button
      // data-no-press: the FAB owns its own transform because it morphs into a
      // sheet, and a competing press-scale fights the view transition (D-061).
      data-no-press
      data-tour="fab"
      data-exl-fab
      aria-label={menuOpen ? 'Close add menu' : isEditor ? 'Write a note' : 'Add to the library'}
      aria-controls={!isEditor && menuOpen ? 'add-menu' : undefined}
      aria-expanded={isEditor ? undefined : menuOpen}
      aria-haspopup="dialog"
      onClick={() => {
        if (menuOpen) nav.close();
        else {
          tick();
          if (isEditor) nav.open({ kind: 'noteEditor' });
          else onOpen();
        }
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
        viewTransitionName: 'add-surface',
      }}
    >
      <span
        style={{
          display: 'flex',
          transform: menuOpen ? 'rotate(45deg)' : 'none',
          transition: 'transform var(--dur-base) var(--ease-spring)',
        }}
      >
        {isEditor ? <Pencil size={20} color="var(--on-accent)" /> : <Plus />}
      </span>
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
  const menu = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => {
      menu.current?.querySelector<HTMLButtonElement>('[data-fab-door]')?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const doors = Array.from(
        menu.current?.querySelectorAll<HTMLButtonElement>('[data-fab-door]') ?? [],
      );
      if (doors.length === 0) return;
      const first = doors[0]!;
      const last = doors[doors.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      if (returnFocus.current?.isConnected) returnFocus.current.focus();
    };
  }, [onClose]);

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
        aria-label="Dismiss add menu"
        tabIndex={-1}
        data-dismiss-scrim
        data-no-press
        style={{
          ...resetButton,
          position: 'absolute',
          inset: 0,
          background: SCRIM_MENU,
          animation: 'exl-fade var(--dur-base) var(--ease-out) both',
        }}
      />
      <div
        id="add-menu"
        ref={menu}
        role="dialog"
        aria-modal="true"
        aria-label="Add to the library"
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
            data-fab-door
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

/** Its head keeps Claude's wordmark and the approved owner mark without
 *  turning the drawer into an account panel (D-041, D-091). */
export function Drawer({ onClose, ownerName }: { onClose: () => void; ownerName?: string }) {
  const panel = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<number | null>(null);
  const [closing, setClosing] = useState(false);

  const requestClose = useCallback(
    (after?: () => void) => {
      if (closing) return;
      if (prefersReducedMotion()) {
        onClose();
        after?.();
        return;
      }
      setClosing(true);
      if (panel.current) {
        panel.current.style.transition = `transform ${DRAWER_EXIT_DURATION} var(--ease-out)`;
        panel.current.style.transform = 'translateX(-100%)';
      }
      if (scrim.current) {
        scrim.current.style.transition = `opacity ${DRAWER_EXIT_DURATION} var(--ease-out)`;
        scrim.current.style.opacity = '0';
      }
      closeTimer.current = window.setTimeout(
        () => {
          onClose();
          after?.();
        },
        Number.parseInt(DRAWER_EXIT_DURATION, 10),
      );
    },
    [closing, onClose],
  );

  useEffect(() => {
    const el = panel.current;
    returnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (el && !prefersReducedMotion()) {
      el.style.transition = 'none';
      el.style.transform = 'translateX(-100%)';
      void el.offsetWidth;
      // Spatial consistency: this is the only surface crossing most of the
      // viewport, so the owner-approved 460ms applies nowhere else.
      el.style.transition = `transform ${DRAWER_ENTER_DURATION} var(--ease-fluid-out)`;
      el.style.transform = 'none';
    }
    const frame = requestAnimationFrame(() => {
      el?.querySelector<HTMLButtonElement>('[data-drawer-destination]')?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
      if (returnFocus.current?.isConnected) returnFocus.current.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const destinations = Array.from(
        panel.current?.querySelectorAll<HTMLButtonElement>('[data-drawer-destination]') ?? [],
      );
      if (destinations.length === 0) return;
      const first = destinations[0]!;
      const last = destinations[destinations.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [requestClose]);

  const rows = [
    {
      key: 'catalogue',
      name: 'Catalogue index',
      Icon: CatalogueIcon,
      go: () => nav.reset({ screen: 'corpus' }),
    },
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
        ref={scrim}
        onClick={() => requestClose()}
        aria-label="Close the menu"
        tabIndex={-1}
        data-dismiss-scrim
        data-no-press
        style={{
          ...resetButton,
          position: 'absolute',
          inset: 0,
          background: SCRIM,
          animation: prefersReducedMotion()
            ? undefined
            : `exl-fade ${DRAWER_ENTER_DURATION} var(--ease-out) both`,
        }}
      />
      <div
        ref={panel}
        data-drawer-panel
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
          pointerEvents: closing ? 'none' : 'auto',
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
            data-drawer-destination
            data-ripple
            data-hover="raised"
            onClick={() => {
              requestClose(r.go);
            }}
            style={{
              ...resetButton,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              height: 56,
              padding: '0 20px',
              animation: prefersReducedMotion()
                ? undefined
                : `exl-drawer-item var(--dur-slow) var(--ease-out) ${DRAWER_ROW_DELAYS[i]} both`,
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
