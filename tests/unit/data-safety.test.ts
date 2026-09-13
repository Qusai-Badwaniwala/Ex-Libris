import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, loadSettings, saveSettings } from '../../src/db/db';
import * as repo from '../../src/db/repo';

interface StoredFile {
  bytes: Uint8Array;
  type: string;
}

const opfs = vi.hoisted(() => ({ available: true, files: new Map<string, StoredFile>() }));

vi.mock('../../src/storage/opfs', () => ({
  opfsAvailable: vi.fn(async () => opfs.available),
  writeFile: vi.fn(async (path: string, data: Blob | ArrayBuffer | string) => {
    if (data instanceof Blob) throw new Error('The data-safety path writes bytes, not blobs.');
    const bytes =
      typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data).slice();
    opfs.files.set(path, { bytes, type: '' });
  }),
  readFile: vi.fn(async (path: string) => {
    const stored = opfs.files.get(path);
    if (!stored) return null;
    return {
      name: path.split('/').at(-1) ?? 'file',
      type: stored.type,
      arrayBuffer: async () =>
        stored.bytes.buffer.slice(
          stored.bytes.byteOffset,
          stored.bytes.byteOffset + stored.bytes.byteLength,
        ),
    } as File;
  }),
  deleteFile: vi.fn(async (path: string) => opfs.files.delete(path)),
  listDir: vi.fn(async (path: string) => {
    const prefix = `${path.replace(/\/$/, '')}/`;
    return [...opfs.files.keys()]
      .filter((name) => name.startsWith(prefix) && !name.slice(prefix.length).includes('/'))
      .map((name) => name.slice(prefix.length))
      .sort();
  }),
}));

import {
  buildBackupArchive,
  inspectAutomaticBackups,
  maybeCreateAutomaticBackup,
} from '../../src/data-safety/backup';
import {
  commitImport,
  csvDrafts,
  parseCsv,
  parseTitleList,
  suggestCsvMapping,
} from '../../src/data-safety/import';
import { readBackupFile, restoreBackup } from '../../src/data-safety/restore';
import { createZip, readZip } from '../../src/data-safety/zip';

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map((table) => table.clear()));
  opfs.available = true;
  opfs.files.clear();
  await loadSettings('0.0.0');
});

afterEach(() => db.close());

function inMemoryFile(name: string, bytes: Uint8Array | ArrayBuffer, type: string): File {
  const buffer =
    bytes instanceof Uint8Array
      ? (bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
      : bytes;
  return { name, type, arrayBuffer: async () => buffer } as File;
}

describe('the Ex Libris ZIP', () => {
  it('round-trips stored entries and rejects changed bytes', () => {
    const zip = createZip([
      { name: 'data.json', data: new TextEncoder().encode('{"ok":true}') },
      { name: 'covers/one.webp', data: Uint8Array.from([1, 2, 3, 4]) },
    ]);
    expect(new TextDecoder().decode(readZip(zip.buffer as ArrayBuffer).get('data.json'))).toBe(
      '{"ok":true}',
    );
    const broken = zip.slice();
    const payload = broken.indexOf(1);
    broken[payload] = 9;
    expect(() => readZip(broken.buffer as ArrayBuffer)).toThrow(/checksum/);
  });
});

describe('complete backups', () => {
  it('includes user covers, excludes replaceable API bytes, and restores the user cover', async () => {
    const user = await repo.createWork({
      title: 'The Irreplaceable Cover',
      format: 'book',
      status: 'reading',
    });
    const api = await repo.createWork({
      title: 'Fetched Again',
      format: 'novel',
      status: 'wishlist',
    });
    await db.work.update(user.id, {
      coverSource: 'user',
      coverPath: `covers/user/${user.id}/own.webp`,
    });
    await db.work.update(api.id, {
      coverSource: 'api',
      coverPath: `covers/api/${api.id}/remote.webp`,
    });
    opfs.files.set(`covers/user/${user.id}/own.webp`, {
      bytes: new TextEncoder().encode('cover'),
      type: 'image/webp',
    });

    const archive = await buildBackupArchive('0.0.0');
    expect(archive.manifest.covers).toHaveLength(1);
    expect(archive.data.data.works.find((work) => work.id === api.id)).toMatchObject({
      coverSource: 'none',
    });
    expect(archive.data.data.works.find((work) => work.id === api.id)).not.toHaveProperty(
      'coverPath',
    );

    const archiveBuffer = archive.bytes.buffer.slice(
      archive.bytes.byteOffset,
      archive.bytes.byteOffset + archive.bytes.byteLength,
    ) as ArrayBuffer;
    const file = inMemoryFile(archive.filename, archiveBuffer, 'application/zip');
    const prepared = await readBackupFile(file);
    await Promise.all(db.tables.map((table) => table.clear()));
    await restoreBackup(prepared, 'replace', '0.0.0');
    const restored = await db.work.get(user.id);
    expect(restored?.coverSource).toBe('user');
    expect(restored?.coverPath).toMatch(/^covers\/user\/.+\/restore-/);
    expect(opfs.files.get(restored!.coverPath!)).toBeTruthy();
  });

  it('never exports the local API key and rotates automatic snapshots to ten', async () => {
    await saveSettings({ aiApiKey: 'must-stay-local' });
    for (let index = 0; index < 10; index++) {
      opfs.files.set(
        `backups/ex-libris-auto-2025-01-${String(index + 1).padStart(2, '0')}T00-00-00.zip`,
        { bytes: new Uint8Array(), type: 'application/zip' },
      );
    }
    expect(await maybeCreateAutomaticBackup('0.0.0', undefined, true)).toBe(true);
    const snapshots = [...opfs.files.keys()].filter((path) => path.startsWith('backups/'));
    expect(snapshots).toHaveLength(10);
    const newest = snapshots.sort().at(-1)!;
    const bytes = opfs.files.get(newest)!.bytes;
    expect(
      new TextDecoder().decode(readZip(bytes.buffer as ArrayBuffer).get('data.json')),
    ).not.toContain('must-stay-local');
  });

  it('reports unavailable and corrupted automatic history instead of calling it empty', async () => {
    opfs.available = false;
    await expect(inspectAutomaticBackups()).resolves.toEqual({
      items: [],
      unreadable: 0,
      available: false,
    });
    opfs.available = true;
    opfs.files.set('backups/ex-libris-auto-corrupt.zip', {
      bytes: Uint8Array.from([1, 2, 3]),
      type: 'application/zip',
    });
    await expect(inspectAutomaticBackups()).resolves.toMatchObject({
      items: [],
      unreadable: 1,
      available: true,
    });
  });

  it('rejects inconsistent data before restore and upgrades an older JSON shape', async () => {
    await repo.createWork({ title: 'Still here', format: 'book', status: 'wishlist' });
    const backup = await buildBackupArchive('0.0.0');
    const inconsistent = structuredClone(backup.data);
    inconsistent.counts.works = 99;
    const badFile = inMemoryFile(
      'inconsistent.json',
      new TextEncoder().encode(JSON.stringify(inconsistent)),
      'application/json',
    );
    await expect(readBackupFile(badFile)).rejects.toThrow(/count does not match/);
    expect(await db.work.count()).toBe(1);

    const older = structuredClone(backup.data) as unknown as {
      schemaVersion: number;
      counts: { readingOrders?: number };
      data: { readingOrders?: unknown[]; readingOrderEntries?: unknown[] };
      userCovers: unknown[];
    };
    older.schemaVersion = 1;
    delete older.counts.readingOrders;
    delete older.data.readingOrders;
    delete older.data.readingOrderEntries;
    const oldFile = inMemoryFile(
      'older.json',
      new TextEncoder().encode(JSON.stringify(older)),
      'application/json',
    );
    const prepared = await readBackupFile(oldFile);
    expect(prepared.data.data.readingOrders).toEqual([]);
    expect(prepared.data.data.readingOrderEntries).toEqual([]);
  });

  it('rolls back a replace transaction when a database write fails', async () => {
    const archived = await repo.createWork({
      title: 'Archived copy',
      format: 'book',
      status: 'wishlist',
    });
    const archive = await buildBackupArchive('0.0.0');
    const prepared = await readBackupFile(
      inMemoryFile(archive.filename, archive.bytes, 'application/zip'),
    );
    await db.work.delete(archived.id);
    const current = await repo.createWork({
      title: 'Current copy',
      format: 'novel',
      status: 'reading',
    });
    const fail = () => {
      db.work.hook('creating').unsubscribe(fail);
      throw new Error('Synthetic restore failure.');
    };
    db.work.hook('creating').subscribe(fail);

    await expect(restoreBackup(prepared, 'replace', '0.0.0')).rejects.toThrow(
      /Synthetic restore failure/,
    );
    expect(await db.work.get(current.id)).toMatchObject({ title: 'Current copy' });
    expect(await db.work.get(archived.id)).toBeUndefined();
  });
});

describe('previewed imports', () => {
  it('parses quoted CSV, maps columns generically, and commits the selected rows together', async () => {
    const table = parseCsv(
      'Book title,Writer,Reading Status,Progress,Tags\n"A, B",Qusai,Reading,12/40,"Memory;War"',
    );
    const mapping = suggestCsvMapping(table.headers);
    const drafts = csvDrafts(table, mapping);
    expect(drafts[0]).toMatchObject({
      title: 'A, B',
      author: 'Qusai',
      status: 'reading',
      progressCurrent: 12,
      progressTotal: 40,
      tags: ['Memory', 'War'],
    });
    expect(await commitImport(drafts)).toBe(1);
    expect(await db.work.count()).toBe(1);
    expect((await db.tag.toArray()).map((tag) => tag.name).sort()).toEqual(['Memory', 'War']);
    expect(
      csvDrafts(parseCsv('Title\nPiranesi'), { title: 0 })[0]?.progressCurrent,
    ).toBeUndefined();
  });

  it('deduplicates pasted lines and rejects a malformed batch before any write', async () => {
    expect(parseTitleList('Piranesi\n\npiranesi\nThe Dispossessed')).toHaveLength(2);
    await expect(
      repo.createWorks([
        { title: 'Piranesi', format: 'book', status: 'wishlist' },
        { title: '   ', format: 'book', status: 'wishlist' },
      ]),
    ).rejects.toThrow(/needs a title/);
    expect(await db.work.count()).toBe(0);
  });
});
