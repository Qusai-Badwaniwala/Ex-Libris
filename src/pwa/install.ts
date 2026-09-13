import { useSyncExternalStore } from 'react';

interface InstallChoice {
  outcome: 'accepted' | 'dismissed';
  platform: string;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<InstallChoice>;
}

export interface PwaInstallState {
  installed: boolean;
  available: boolean;
  busy: boolean;
  instructionsOpen: boolean;
  isIos: boolean;
  error: string;
}

let promptEvent: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function isStandalone() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    navigatorWithStandalone.standalone === true
  );
}

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

let state: PwaInstallState = {
  installed: isStandalone(),
  available: false,
  busy: false,
  instructionsOpen: false,
  isIos: isIosDevice(),
  error: '',
};

function publish(patch: Partial<PwaInstallState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function handleInstallPrompt(event: Event) {
  event.preventDefault();
  promptEvent = event as BeforeInstallPromptEvent;
  publish({ available: true, error: '' });
}

function handleInstalled() {
  promptEvent = null;
  publish({ installed: true, available: false, busy: false, instructionsOpen: false, error: '' });
}

window.addEventListener('beforeinstallprompt', handleInstallPrompt);
window.addEventListener('appinstalled', handleInstalled);

const standaloneQuery = window.matchMedia('(display-mode: standalone)');
standaloneQuery.addEventListener?.('change', () => {
  if (isStandalone()) handleInstalled();
});

export function usePwaInstall() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

export async function requestPwaInstall(): Promise<'installed' | 'dismissed' | 'manual'> {
  if (state.installed || isStandalone()) {
    handleInstalled();
    return 'installed';
  }

  if (!promptEvent) {
    publish({ instructionsOpen: true, error: '' });
    return 'manual';
  }

  const currentPrompt = promptEvent;
  promptEvent = null;
  publish({ available: false, busy: true, instructionsOpen: false, error: '' });
  try {
    await currentPrompt.prompt();
    const choice = await currentPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      handleInstalled();
      return 'installed';
    }
    publish({ busy: false });
    return 'dismissed';
  } catch {
    publish({
      busy: false,
      instructionsOpen: true,
      error: 'The browser could not open its installer. Use the steps below instead.',
    });
    return 'manual';
  }
}

export function closeInstallInstructions() {
  publish({ instructionsOpen: false, error: '' });
}
