import { Fragment } from 'react';
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
  Search,
  Menu,
  Sun,
  Moon,
} from './icons';
import { Sheet } from './components';
import type { ThemeChoice } from '../db/schema';

const NO_CHROME: Screen[] = ['bookplate', 'welcome', 'finish', 'tagpick', 'axis'];
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

export function RoomToolbar({
  theme,
  onTheme,
}: {
  theme: 'light' | 'dark';
  onTheme: (theme: ThemeChoice) => void;
}) {
  return (
    <header className="room-toolbar">
      <button
        className="room-brand"
        onClick={() => nav.reset({ screen: 'home' })}
        aria-label="Ex Libris, library"
      >
        <span className="room-seal" aria-hidden="true">
          ex
        </span>
        <span>
          Ex Libris<small>A private reading room</small>
        </span>
      </button>
      <div className="room-tools">
        <button
          className="room-icon"
          data-tour="search"
          aria-label="Search your library"
          onClick={() => nav.push({ screen: 'search' })}
        >
          <Search />
        </button>
        <button
          className="room-icon"
          aria-label={theme === 'dark' ? 'Light theme' : 'Dark theme'}
          onClick={() => onTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </button>
        <button
          className="room-icon"
          data-tour="drawer"
          aria-label="Menu"
          onClick={() => nav.open({ kind: 'drawer' })}
        >
          <Menu />
        </button>
      </div>
    </header>
  );
}

export function NavBar({ screen }: { screen: Screen }) {
  if (NO_CHROME.includes(screen)) return null;
  const tabs = [
    {
      name: 'Library',
      screen: 'home' as const,
      on: LIBRARY_SCREENS.includes(screen),
      Icon: LibraryTab,
    },
    { name: 'Wishlist', screen: 'wishlist' as const, on: screen === 'wishlist', Icon: WishlistTab },
    { name: 'Notes', screen: 'notes' as const, on: screen === 'notes', Icon: NoteIcon },
    { name: 'Stats', screen: 'stats' as const, on: screen === 'stats', Icon: StatsTab },
  ];
  return (
    <nav className="room-nav" aria-label="Sections">
      {tabs.map((tab, i) => (
        <Fragment key={tab.name}>
          {i === 2 && <span className="room-nav-space" />}
          <button
            aria-current={tab.on ? 'page' : undefined}
            onClick={() => nav.reset({ screen: tab.screen })}
          >
            <tab.Icon color="currentColor" />
            <span>{tab.name}</span>
          </button>
        </Fragment>
      ))}
    </nav>
  );
}

export function Fab({ screen, onOpen }: { screen: Screen; onOpen: () => void }) {
  const { overlays } = useNav();
  if (NO_CHROME.includes(screen)) return null;
  const writing = screen === 'notes';
  return (
    <button
      className="room-add"
      style={{ visibility: overlays.length ? 'hidden' : undefined }}
      data-tour="fab"
      data-exl-fab
      aria-label={writing ? 'Write a note' : 'Add to the library'}
      aria-haspopup="dialog"
      onClick={() => (writing ? nav.open({ kind: 'noteEditor' }) : onOpen())}
    >
      {writing ? <Pencil size={20} /> : <Plus />}
      <span>{writing ? 'Write' : 'Add'}</span>
    </button>
  );
}

export function FabMenu({
  onCatalogue,
  onByHand,
  onClose,
}: {
  onCatalogue: () => void;
  onByHand: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="Add to your library" onClose={onClose}>
      <div className="room-sheet-title">
        <h2>Add a work</h2>
        <p>One place for everything you read.</p>
      </div>
      <button className="room-door" data-fab-door onClick={onCatalogue}>
        <Search />
        <span>
          <strong>Search the catalogue</strong>
          <small>Find a title and review its details</small>
        </span>
        <span aria-hidden="true">↗</span>
      </button>
      <button className="room-door" data-fab-door onClick={onByHand}>
        <Pencil />
        <span>
          <strong>Add by hand</strong>
          <small>Your own record, with or without a catalogue</small>
        </span>
        <span aria-hidden="true">↗</span>
      </button>
    </Sheet>
  );
}

export function Drawer({ onClose }: { onClose: () => void; ownerName?: string }) {
  const rows = [
    {
      screen: 'settings' as const,
      name: 'Settings',
      detail: 'Appearance, bookplate & preferences',
      Icon: SettingsTab,
    },
    {
      screen: 'corpus' as const,
      name: 'Catalogue index',
      detail: 'Manage your offline catalogue',
      Icon: CatalogueIcon,
    },
    {
      screen: 'backup' as const,
      name: 'Backup and restore',
      detail: 'Export, restore & import a reading list',
      Icon: BackupIcon,
    },
    {
      screen: 'trash' as const,
      name: 'Trash',
      detail: 'Recover removed works and notes',
      Icon: TrashIcon,
    },
    {
      screen: 'about' as const,
      name: 'About',
      detail: 'Your library belongs to you',
      Icon: AboutIcon,
    },
  ];
  return (
    <Sheet title="Menu" onClose={onClose}>
      <div className="room-sheet-title">
        <h2>Your reading room</h2>
        <p>Private. On your device. Yours.</p>
      </div>
      {rows.map(({ screen, name, detail, Icon }) => (
        <button
          key={screen}
          className="room-door"
          data-drawer-destination
          onClick={() => nav.closeAndPush({ screen })}
        >
          <Icon color="currentColor" />
          <span>
            <strong>{name}</strong>
            <small>{detail}</small>
          </span>
          <span aria-hidden="true">↗</span>
        </button>
      ))}
    </Sheet>
  );
}
