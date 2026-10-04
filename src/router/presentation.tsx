import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

const entries = new WeakMap<object, Map<string, unknown>>();
const routeIds = new WeakMap<object, number>();
let nextId = 0;
export function presentationKey(entry: object): number {
  let id = routeIds.get(entry);
  if (id === undefined) {
    id = ++nextId;
    routeIds.set(entry, id);
  }
  return id;
}
const Context = createContext<object | null>(null);
export function PresentationScope({ entry, children }: { entry: object; children: ReactNode }) {
  return <Context.Provider value={entry}>{children}</Context.Provider>;
}
/** Ephemeral history-entry state, never reader data or a database migration. */
export function usePresentationState<T>(key: string, initial: T) {
  const context = useContext(Context);
  const entry = useRef(context ?? {});
  const initialValue = useRef(initial);
  let values = entries.get(entry.current);
  if (!values) {
    values = new Map();
    entries.set(entry.current, values);
  }
  const cache = values;
  const [value, setValue] = useState<T>(() => (cache.has(key) ? (cache.get(key) as T) : initial));
  const set = useCallback(
    (next: T | ((previous: T) => T)) => {
      const previous = cache.has(key) ? (cache.get(key) as T) : initialValue.current;
      const result = typeof next === 'function' ? (next as (previous: T) => T)(previous) : next;
      // A step may navigate in this same event. Its next mount must see the draft
      // before React schedules this component's state update.
      cache.set(key, result);
      setValue(result);
    },
    [cache, key],
  );
  return [value, set] as const;
}
export interface ScrollMemory {
  tops: number[];
  focus?: string;
}
export const scrollMemory = new WeakMap<object, ScrollMemory>();
