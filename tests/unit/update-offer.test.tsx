import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  ready: true,
  overlays: [] as { kind: string }[],
  screen: 'home',
  pending: false,
  automatic: { active: false },
  install: { phase: 'idle' },
  update: vi.fn(async () => {}),
}));
vi.mock('../../src/data-safety/backup', () => ({
  automaticBackupStore: { subscribe: () => () => {}, getSnapshot: () => state.automatic },
}));
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({ needRefresh: [state.ready], updateServiceWorker: state.update }),
}));
vi.mock('../../src/router/router', () => ({
  useNav: () => ({ screens: [{ screen: state.screen }], overlays: state.overlays }),
}));
vi.mock('../../src/ui/interaction-feedback', () => ({
  usePendingInteraction: () => state.pending,
}));
vi.mock('../../src/catalogue/install', () => ({
  catalogueInstallStore: { subscribe: () => () => {}, getSnapshot: () => state.install },
}));
import { UpdateOffer } from '../../src/pwa/update';

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const render = () => act(() => root.render(<UpdateOffer />));
const updateButton = () =>
  [...host.querySelectorAll('button')].find((button) => button.textContent === 'Update')!;
beforeEach(() => {
  Object.assign(state, {
    ready: true,
    overlays: [],
    screen: 'home',
    pending: false,
    automatic: { active: false },
    install: { phase: 'idle' },
  });
  state.update.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

it('defers updates during drafts, writes, restore and catalogue installation', () => {
  state.overlays = [{ kind: 'noteEditor' }];
  render();
  expect(updateButton().disabled).toBe(true);
  state.overlays = [];
  state.pending = true;
  render();
  expect(updateButton().disabled).toBe(true);
  state.pending = false;
  state.screen = 'backup';
  render();
  expect(updateButton().disabled).toBe(true);
  state.screen = 'home';
  state.install = { phase: 'downloading' };
  render();
  expect(updateButton().disabled).toBe(true);
  state.install = { phase: 'idle' };
  render();
  expect(updateButton().disabled).toBe(false);
  state.automatic = { active: true };
  render();
  expect(updateButton().disabled).toBe(true);
  expect(state.update).not.toHaveBeenCalled();
});

it('requires a click to activate a ready worker, and supports deferral', async () => {
  render();
  expect(state.update).not.toHaveBeenCalled();
  await act(async () => updateButton().click());
  expect(state.update).toHaveBeenCalledWith(true);
});

it('keeps the current app when Later is chosen', () => {
  render();
  act(() =>
    [...host.querySelectorAll('button')].find((button) => button.textContent === 'Later')!.click(),
  );
  expect(host.querySelector('aside')).toBeNull();
  expect(state.update).not.toHaveBeenCalled();
});
