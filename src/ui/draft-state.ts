import { useSyncExternalStore } from 'react';

const active = new Set<symbol>();
const listeners = new Set<() => void>();
export const draftActivity = {
  getSnapshot: () => active.size > 0,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
export function protectDraft() {
  const id = Symbol();
  active.add(id);
  listeners.forEach((listener) => listener());
  return () => {
    active.delete(id);
    listeners.forEach((listener) => listener());
  };
}
export const useDraftActivity = () =>
  useSyncExternalStore(draftActivity.subscribe, draftActivity.getSnapshot);
