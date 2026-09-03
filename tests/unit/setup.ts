import 'fake-indexeddb/auto';

// jsdom has no crypto.randomUUID. The app uses it as its only id source, so a
// missing one would fail every write path in a way that looks like a Dexie bug.
if (!globalThis.crypto?.randomUUID) {
  let n = 0;
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      ...globalThis.crypto,
      randomUUID: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    },
    configurable: true,
  });
}
