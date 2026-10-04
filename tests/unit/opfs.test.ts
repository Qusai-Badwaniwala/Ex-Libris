import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

it('shares an unfinished OPFS probe across simultaneous covers and snapshots', async () => {
  vi.resetModules();
  let resolve!: (value: FileSystemDirectoryHandle) => void;
  const getDirectory = vi.fn(
    () =>
      new Promise<FileSystemDirectoryHandle>((done) => {
        resolve = done;
      }),
  );
  vi.stubGlobal('navigator', { storage: { getDirectory } });
  const { opfsAvailable } = await import('../../src/storage/opfs');
  const first = opfsAvailable();
  const second = opfsAvailable();
  resolve({} as FileSystemDirectoryHandle);
  expect(await Promise.all([first, second])).toEqual([true, true]);
  expect(getDirectory).toHaveBeenCalledTimes(1);
});

it('aborts a failed write without committing truncated cover bytes', async () => {
  vi.resetModules();
  const writable = {
    write: vi.fn().mockRejectedValue(new Error('Quota exceeded')),
    close: vi.fn(),
    abort: vi.fn().mockResolvedValue(undefined),
  };
  vi.stubGlobal('navigator', {
    storage: {
      getDirectory: async () => ({
        getFileHandle: async () => ({ createWritable: async () => writable }),
      }),
    },
  });
  const { writeFile } = await import('../../src/storage/opfs');
  await expect(writeFile('cover.webp', new ArrayBuffer(10))).rejects.toThrow('Quota exceeded');
  expect(writable.abort).toHaveBeenCalledOnce();
  expect(writable.close).not.toHaveBeenCalled();
});
