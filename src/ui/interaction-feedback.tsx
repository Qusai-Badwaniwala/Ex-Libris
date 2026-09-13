import { useEffect, useState, useSyncExternalStore } from 'react';
import { PENDING_REVEAL_MS } from './design-literals';

interface PendingEntry {
  id: number;
  label: string;
}

let nextId = 0;
let entries: PendingEntry[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => entries.at(-1) ?? null;

/**
 * Marks only work whose completion is genuinely asynchronous. The visual mark
 * waits briefly, so ordinary IndexedDB writes finish under the reader's finger
 * without flashing a loader. The promise and its errors remain owned by the
 * calling control; this helper never turns failure into success.
 */
export async function withInteractionFeedback<T>(
  label: string,
  action: () => Promise<T>,
): Promise<T> {
  const entry = { id: ++nextId, label };
  entries = [...entries, entry];
  emit();
  try {
    return await action();
  } finally {
    entries = entries.filter(({ id }) => id !== entry.id);
    emit();
  }
}

/**
 * A registering-book mark rather than a spinner or pretend progress bar. It
 * says only that the named operation is still active. Reduced motion leaves
 * the same open-book mark still, while the live text remains available.
 */
export function InteractionFeedback() {
  const pending = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [visibleId, setVisibleId] = useState<number | null>(null);

  useEffect(() => {
    setVisibleId(null);
    if (!pending) return;
    const timer = window.setTimeout(() => setVisibleId(pending.id), PENDING_REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [pending]);

  if (!pending || visibleId !== pending.id) return null;

  return (
    <div className="exl-pending" role="status" aria-live="polite" aria-atomic="true">
      <svg className="exl-pending__mark" viewBox="0 0 26 18" aria-hidden="true">
        <path d="M13 16V4.5C10.4 2.8 7.5 2 4.5 2v11.5c3.1 0 5.9.8 8.5 2.5Z" />
        <path d="M13 16V4.5C15.6 2.8 18.5 2 21.5 2v11.5c-3.1 0-5.9.8-8.5 2.5Z" />
        <path className="exl-pending__register" d="M16 5.4c1.2-.5 2.4-.8 3.7-.9" />
      </svg>
      <span>{pending.label}</span>
    </div>
  );
}

/** Test seam. */
export function __resetInteractionFeedback() {
  entries = [];
  emit();
}
