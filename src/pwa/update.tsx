/// <reference types="vite-plugin-pwa/client" />
import { useState, useSyncExternalStore } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useNav } from '../router/router';
import { usePendingInteraction } from '../ui/interaction-feedback';
import { catalogueInstallStore } from '../catalogue/install';
import { automaticBackupStore } from '../data-safety/backup';

export function UpdateOffer() {
  const {
    needRefresh: [ready],
    updateServiceWorker,
  } = useRegisterSW();
  const { screens, overlays } = useNav();
  const pending = usePendingInteraction();
  const automatic = useSyncExternalStore(
    automaticBackupStore.subscribe,
    automaticBackupStore.getSnapshot,
  );
  const install = useSyncExternalStore(
    catalogueInstallStore.subscribe,
    catalogueInstallStore.getSnapshot,
  );
  const [later, setLater] = useState(false);
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);
  const screen = screens.at(-1)?.screen;
  // Sheets may contain unsaved form state even when no write has started.
  const blocked =
    !!pending ||
    automatic.active ||
    overlays.length > 0 ||
    screen === 'backup' ||
    install.phase === 'checking' ||
    install.phase === 'downloading';
  if (!ready || later) return null;
  return (
    <aside className="room-update" aria-label="App update">
      <div>
        <strong>An Ex Libris update is ready</strong>
        <p>
          {blocked
            ? 'Finish your current task before updating.'
            : 'Your saved library stays on this device.'}
        </p>
        {error && <p role="alert">{error}</p>}
      </div>
      <button className="room-text" onClick={() => setLater(true)} disabled={applying}>
        Later
      </button>
      <button
        className="room-primary"
        disabled={blocked || applying}
        onClick={() => {
          setApplying(true);
          setError('');
          void updateServiceWorker(true).catch(() => {
            setError('The update could not start. Try again.');
            setApplying(false);
          });
        }}
      >
        {applying ? 'Updating…' : 'Update'}
      </button>
    </aside>
  );
}
