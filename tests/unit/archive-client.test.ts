import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: { preventDefault(): void }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    FakeWorker.instances.push(this);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  FakeWorker.instances = [];
});

describe('archive worker ownership', () => {
  it('moves input bytes to one lazy worker and resolves only the matching result', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const { decodeArchive, verifyArchive } = await import('../../src/data-safety/archive-client');
    const bytes = new ArrayBuffer(4);
    const reading = decodeArchive('library.zip', bytes);
    const worker = FakeWorker.instances[0]!;
    const [message, transfer] = worker.postMessage.mock.calls[0]!;
    expect(transfer).toEqual([bytes]);
    expect(message.request).toEqual({ type: 'read', filename: 'library.zip', buffer: bytes });
    const result = { filename: 'library.zip', coverBytes: new Map() };
    worker.onmessage!({ data: { id: message.id, result } } as MessageEvent);
    await expect(reading).resolves.toBe(result);
    const expected = new ArrayBuffer(4);
    const verifying = verifyArchive('copy.zip', bytes, expected);
    expect(FakeWorker.instances).toHaveLength(1);
    const [second, secondTransfer] = worker.postMessage.mock.calls[1]!;
    expect(secondTransfer).toEqual([bytes, expected]);
    worker.onmessage!({ data: { id: second.id, error: 'checksum failed' } } as MessageEvent);
    await expect(verifying).rejects.toThrow('checksum failed');
  });

  it('rejects all interrupted jobs and recreates a failed worker for an explicit retry', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const { decodeArchive } = await import('../../src/data-safety/archive-client');
    const first = decodeArchive('one.zip', new ArrayBuffer(4));
    const second = decodeArchive('two.zip', new ArrayBuffer(4));
    const failures = Promise.allSettled([first, second]);
    FakeWorker.instances[0]!.onerror!({ preventDefault() {} });
    const results = await failures;
    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(FakeWorker.instances[0]!.terminate).toHaveBeenCalledOnce();
    const retry = decodeArchive('one.zip', new ArrayBuffer(4));
    expect(FakeWorker.instances).toHaveLength(2);
    const worker = FakeWorker.instances[1]!;
    const [message] = worker.postMessage.mock.calls[0]!;
    worker.onmessage!({ data: { id: message.id, error: 'file invalid' } } as MessageEvent);
    await expect(retry).rejects.toThrow('file invalid');
  });

  it('reports unavailable workers without performing archive work on the UI thread', async () => {
    vi.stubGlobal('Worker', undefined);
    const { decodeArchive } = await import('../../src/data-safety/archive-client');
    await expect(decodeArchive('library.zip', new ArrayBuffer(4))).rejects.toThrow(
      'cannot process backup archives in a worker',
    );
  });

  it('keeps ZIP and full record parsing behind the worker boundary', () => {
    for (const name of ['backup.ts', 'restore.ts', 'archive-client.ts']) {
      const source = readFileSync(`src/data-safety/${name}`, 'utf8');
      expect(source).not.toMatch(
        /\b(?:createZip|readZip|assertBackupData|JSON\.parse|JSON\.stringify)\s*\(/,
      );
    }
  });
});
