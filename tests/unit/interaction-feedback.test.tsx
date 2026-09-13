import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetInteractionFeedback,
  InteractionFeedback,
  withInteractionFeedback,
} from '../../src/ui/interaction-feedback';
import { PENDING_REVEAL_MS } from '../../src/ui/design-literals';

describe('interaction feedback', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.useFakeTimers();
    __resetInteractionFeedback();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    act(() => root.render(<InteractionFeedback />));
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    __resetInteractionFeedback();
    vi.useRealTimers();
  });

  it('does not flash for an operation that finishes before the reveal delay', async () => {
    await act(async () => {
      await withInteractionFeedback('Saving the note…', () => Promise.resolve());
      await vi.advanceTimersByTimeAsync(PENDING_REVEAL_MS);
    });

    expect(host.querySelector('[role="status"]')).toBeNull();
  });

  it('names a continuing operation after the delay and clears it when settled', async () => {
    let finish!: () => void;
    const operation = new Promise<void>((resolve) => {
      finish = resolve;
    });

    let tracked!: Promise<void>;
    act(() => {
      tracked = withInteractionFeedback('Registering the cover…', () => operation);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PENDING_REVEAL_MS - 1);
    });
    expect(host.querySelector('[role="status"]')).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Registering the cover…');
    expect(host.querySelector('.exl-pending__mark')).not.toBeNull();

    await act(async () => {
      finish();
      await tracked;
    });
    expect(host.querySelector('[role="status"]')).toBeNull();
  });
});
