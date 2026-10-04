/** The platform registration lets each client protect its own draft when a
 * different window activates a release. The generated helper reloads every
 * controlling client unconditionally, which can destroy a screen draft. */
let registration: ServiceWorkerRegistration | undefined;
let waiting = false;
let activated = false;
let started = false;
let mayReload = () => false;
const listeners = new Set<() => void>();
const announce = () => listeners.forEach((listener) => listener());
export const pwaUpdate = {
  getSnapshot: () => waiting || activated,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  protect(canReload: () => boolean) {
    mayReload = canReload;
  },
  async apply() {
    if (!mayReload()) throw new Error('Finish your current task before updating.');
    if (activated) {
      location.reload();
      return;
    }
    if (!registration?.waiting)
      throw new Error('The update is no longer waiting. Reopen Ex Libris to check again.');
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  },
  start() {
    if (started || !import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    started = true;
    let controlled = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!controlled) {
        controlled = true;
        return;
      }
      activated = true;
      waiting = false;
      announce();
      if (mayReload()) location.reload();
    });
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .then((reg) => {
        registration = reg;
        const check = () => {
          waiting = !!reg.waiting && !!navigator.serviceWorker.controller;
          announce();
        };
        check();
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          worker?.addEventListener('statechange', check);
        });
      })
      .catch(() => {
        started = false;
      });
  },
};

/** A bounded, on-demand check. No heartbeat, telemetry or background polling. */
export function coordinateUpdates(isBlocked: () => boolean) {
  const channel =
    typeof BroadcastChannel === 'function' ? new BroadcastChannel('ex-libris-release') : undefined;
  let responses: boolean[] | undefined;
  let requestId = '';
  const receive = (event: MessageEvent<{ type: string; id: string; blocked?: boolean }>) => {
    if (event.data?.type === 'check')
      channel?.postMessage({ type: 'state', id: event.data.id, blocked: isBlocked() });
    if (event.data?.type === 'state' && event.data.id === requestId)
      responses?.push(!!event.data.blocked);
  };
  channel?.addEventListener('message', receive);
  return {
    async otherClientIsBusy() {
      if (!channel) return false;
      requestId = crypto.randomUUID();
      responses = [];
      channel.postMessage({ type: 'check', id: requestId });
      await new Promise((resolve) => setTimeout(resolve, 200));
      const busy = responses.some(Boolean);
      responses = undefined;
      return busy;
    },
    close() {
      channel?.close();
    },
  };
}
