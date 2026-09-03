/**
 * Storage persistence. Without it the browser is free to evict IndexedDB and
 * OPFS under pressure, which for this app means losing the only copy of the
 * library — there is no server to restore from.
 *
 * Chrome on Android grants this silently once the app is installed to the home
 * screen, and usually refuses before that. So a refusal is not an error and is
 * never surfaced as one: it is a fact the Settings screen reports, and the
 * reason installing is worth doing.
 */

export type PersistState = 'granted' | 'refused' | 'unsupported';

export async function requestPersistence(): Promise<PersistState> {
  try {
    if (!navigator.storage?.persist || !navigator.storage?.persisted) return 'unsupported';
    if (await navigator.storage.persisted()) return 'granted';
    return (await navigator.storage.persist()) ? 'granted' : 'refused';
  } catch {
    return 'unsupported';
  }
}
