import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { defaultSettings } from '../../src/db/db';
import { useSettings } from '../../src/ui/store';

const storage = vi.hoisted(() => ({ save: vi.fn(), read: vi.fn() }));
vi.mock('../../src/db/db', async (original) => ({
  ...(await original<typeof import('../../src/db/db')>()),
  loadSettings: () => storage.read(),
  saveSettings: (patch: unknown) => storage.save(patch),
}));
vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => undefined }));

afterEach(() => vi.resetAllMocks());
it('keeps onboarding incomplete until its write commits, and does not present failed writes as saved', async () => {
  storage.read.mockResolvedValue(defaultSettings('test'));
  let finish!: () => void;
  storage.save.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  let observed!: ReturnType<typeof useSettings>;
  function Probe() {
    observed = useSettings();
    return <span>{observed.settings?.tourCompletedAt ?? 'incomplete'}</span>;
  }
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<Probe />));
    let write!: Promise<boolean>;
    act(() => {
      write = observed.update({ tourCompletedAt: '2026-09-20T00:00:00Z' });
    });
    expect(host.textContent).toBe('incomplete');
    await act(async () => {
      finish();
      await write;
    });
    expect(host.textContent).toBe('2026-09-20T00:00:00Z');
    storage.save.mockRejectedValueOnce(new Error('Quota exceeded'));
    await act(async () => {
      expect(await observed.update({ tourCompletedAt: 'overwrite' })).toBe(false);
    });
    expect(host.textContent).toBe('2026-09-20T00:00:00Z');
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
