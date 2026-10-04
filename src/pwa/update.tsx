import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { coordinateUpdates, pwaUpdate } from './client';
import { useNav } from '../router/router';
import { usePendingInteraction } from '../ui/interaction-feedback';
import { catalogueInstallStore } from '../catalogue/install';
import { automaticBackupStore } from '../data-safety/backup';
import { useDraftActivity } from '../ui/draft-state';

export function UpdateOffer() {
  const ready = useSyncExternalStore(pwaUpdate.subscribe, pwaUpdate.getSnapshot);
  const draft = useDraftActivity();
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
    draft ||
    !!pending ||
    automatic.active ||
    overlays.length > 0 ||
    screen === 'backup' ||
    install.phase === 'checking' ||
    install.phase === 'downloading';
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  const coordination = useRef<ReturnType<typeof coordinateUpdates> | null>(null);
  useEffect(() => {
    pwaUpdate.protect(() => !blockedRef.current);
    pwaUpdate.start();
    coordination.current = coordinateUpdates(() => blockedRef.current);
    return () => {
      coordination.current?.close();
      coordination.current = null;
    };
  }, []);
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
          void (async () => {
            if (await coordination.current?.otherClientIsBusy())
              throw new Error(
                'Finish your current task in the other Ex Libris window before updating.',
              );
            await pwaUpdate.apply();
          })().catch((cause: unknown) => {
            setError(
              cause instanceof Error ? cause.message : 'The update could not start. Try again.',
            );
            setApplying(false);
          });
        }}
      >
        {applying ? 'Updating…' : 'Update'}
      </button>
    </aside>
  );
}
