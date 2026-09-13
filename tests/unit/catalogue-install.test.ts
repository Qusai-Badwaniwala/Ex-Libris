import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, defaultSettings } from '../../src/db/db';
import type { CorpusManifest } from '../../src/catalogue/types';

const opfs = vi.hoisted(() => ({
  available: true,
  files: new Map<string, Uint8Array>(),
}));

const worker = vi.hoisted(() => ({
  verify: vi.fn<(path: string) => Promise<number>>(),
  open: vi.fn<(path: string) => Promise<number>>(),
}));

const copyBuffer = (bytes: Uint8Array): ArrayBuffer => Uint8Array.from(bytes).buffer;

function fileView(bytes: Uint8Array): File {
  return {
    size: bytes.byteLength,
    text: async () => new TextDecoder().decode(bytes),
    slice: (start?: number, end?: number) => {
      const part = bytes.slice(start ?? 0, end ?? bytes.byteLength);
      return { arrayBuffer: async () => copyBuffer(part) } as Blob;
    },
  } as File;
}

vi.mock('../../src/storage/opfs', () => ({
  opfsAvailable: vi.fn(async () => opfs.available),
  readFile: vi.fn(async (path: string) => {
    const bytes = opfs.files.get(path);
    return bytes ? fileView(bytes) : null;
  }),
  fileSize: vi.fn(async (path: string) => opfs.files.get(path)?.byteLength ?? 0),
  writeFile: vi.fn(async (path: string, data: string | ArrayBuffer | Blob) => {
    const bytes =
      typeof data === 'string'
        ? new TextEncoder().encode(data)
        : data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : new Uint8Array(await data.arrayBuffer());
    opfs.files.set(path, Uint8Array.from(bytes));
  }),
  writeFileAt: vi.fn(async (path: string, position: number, data: ArrayBuffer) => {
    const previous = opfs.files.get(path) ?? new Uint8Array();
    const incoming = new Uint8Array(data);
    const next = new Uint8Array(Math.max(previous.byteLength, position + incoming.byteLength));
    next.set(previous);
    next.set(incoming, position);
    opfs.files.set(path, next);
  }),
  truncateFile: vi.fn(async (path: string, size: number) => {
    const previous = opfs.files.get(path) ?? new Uint8Array();
    const next = new Uint8Array(size);
    next.set(previous.subarray(0, size));
    opfs.files.set(path, next);
  }),
  deleteFile: vi.fn(async (path: string) => opfs.files.delete(path)),
}));

vi.mock('../../src/catalogue/client', () => ({
  verifyCatalogueFile: worker.verify,
  catalogue: {
    verify: worker.verify,
    open: worker.open,
  },
}));

import { installCatalogue } from '../../src/catalogue/install';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

function fixture(bytes = new TextEncoder().encode('abcdefgh')): {
  bytes: Uint8Array;
  manifest: CorpusManifest;
} {
  const first = bytes.slice(0, 4);
  const second = bytes.slice(4);
  return {
    bytes,
    manifest: {
      schema: 1,
      version: '20260905-test',
      builtAt: '2026-09-05T00:00:00.000Z',
      file: 'corpus.sqlite',
      bytes: bytes.byteLength,
      sha256: hash(bytes),
      chunkSize: 4,
      chunks: [
        { offset: 0, bytes: first.byteLength, sha256: hash(first) },
        { offset: 4, bytes: second.byteLength, sha256: hash(second) },
      ],
      distribution: 'production',
      sources: { openlibrary: 1 },
      counts: { works: 1, series: 0, universes: 0, withSeries: 0, withCover: 0 },
    },
  };
}

function response(status: number, body: unknown) {
  const bytes = ArrayBuffer.isView(body)
    ? new Uint8Array(body.buffer, body.byteOffset, body.byteLength)
    : null;
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    arrayBuffer: async () => (bytes ? copyBuffer(bytes) : copyBuffer(new TextEncoder().encode(''))),
  } as Response;
}

function serve(
  source: ReturnType<typeof fixture>,
  onRange?: (range: string, bytes: Uint8Array) => Promise<Response> | Response,
) {
  const ranges: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      if (String(input).endsWith('/manifest.json')) return response(200, source.manifest);
      const range = (init?.headers as Record<string, string> | undefined)?.Range ?? '';
      ranges.push(range);
      const match = /^bytes=(\d+)-(\d+)$/.exec(range);
      if (!match) return response(416, {});
      const start = Number(match[1]);
      const end = Number(match[2]);
      const part = source.bytes.slice(start, end + 1);
      return onRange ? onRange(range, part) : response(206, part);
    }),
  );
  return ranges;
}

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map((table) => table.clear()));
  await db.settings.put(defaultSettings('test'));
  opfs.available = true;
  opfs.files.clear();
  worker.verify.mockReset().mockResolvedValue(1);
  worker.open.mockReset().mockResolvedValue(1);
});

afterEach(() => {
  vi.unstubAllGlobals();
  db.close();
});

describe('catalogue installation', () => {
  it('downloads verified ranges, promotes once complete, and cleans its marker', async () => {
    const source = fixture();
    const ranges = serve(source);

    const installed = await installCatalogue('/corpus/manifest.json');

    expect(installed, JSON.stringify(installed)).toMatchObject({ phase: 'ready', works: 1 });
    expect(ranges).toEqual(['bytes=0-3', 'bytes=4-7']);
    expect(Array.from(opfs.files.get('catalogue/corpus-20260905-test.sqlite') ?? [])).toEqual(
      Array.from(source.bytes),
    );
    expect(opfs.files.has('catalogue/install-20260905-test.json')).toBe(false);
    expect(worker.verify).toHaveBeenCalledWith('catalogue/corpus-20260905-test.sqlite');
    expect(await db.settings.get('singleton')).toMatchObject({
      corpusVersion: '20260905-test',
    });
  });

  it('resumes after interruption without downloading an already committed chunk again', async () => {
    const source = fixture();
    let failSecond = true;
    const ranges = serve(source, async (range, part) => {
      if (range === 'bytes=4-7' && failSecond) {
        failSecond = false;
        throw new TypeError('connection lost');
      }
      return response(206, part);
    });

    expect(await installCatalogue('/corpus/manifest.json')).toMatchObject({ phase: 'error' });
    expect(Array.from(opfs.files.get('catalogue/corpus-20260905-test.sqlite') ?? [])).toEqual(
      Array.from(source.bytes.slice(0, 4)),
    );

    expect(await installCatalogue('/corpus/manifest.json')).toMatchObject({ phase: 'ready' });
    expect(ranges).toEqual(['bytes=0-3', 'bytes=4-7', 'bytes=4-7']);
  });

  it('does not advance the installed pointer when a chunk fails its checksum', async () => {
    const source = fixture();
    serve(source, (range, part) => {
      if (range !== 'bytes=4-7') return response(206, part);
      return response(206, new TextEncoder().encode('xxxx'));
    });

    const result = await installCatalogue('/corpus/manifest.json');

    expect(result).toMatchObject({ phase: 'error', message: expect.stringMatching(/checksum/i) });
    expect((await db.settings.get('singleton'))?.corpusVersion).toBeUndefined();
    expect(worker.verify).not.toHaveBeenCalled();
  });

  it('rechecks stored bytes even when the resume marker says they are complete', async () => {
    const source = fixture();
    opfs.files.set('catalogue/corpus-20260905-test.sqlite', new TextEncoder().encode('xxxx'));
    opfs.files.set(
      'catalogue/install-20260905-test.json',
      new TextEncoder().encode(
        JSON.stringify({
          manifestSha256: source.manifest.sha256,
          completedChunks: 1,
        }),
      ),
    );
    const ranges = serve(source);
    expect(await installCatalogue('/corpus/manifest.json')).toMatchObject({ phase: 'ready' });
    expect(ranges).toEqual(['bytes=0-3', 'bytes=4-7']);
    expect(Array.from(opfs.files.get('catalogue/corpus-20260905-test.sqlite') ?? [])).toEqual(
      Array.from(source.bytes),
    );
  });

  it('reports unsupported storage without attempting a network request', async () => {
    opfs.available = false;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    expect(await installCatalogue('/corpus/manifest.json')).toEqual({
      phase: 'unavailable',
      reason: 'This browser cannot keep the catalogue index on this device.',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
