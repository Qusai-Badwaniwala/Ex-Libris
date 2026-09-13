import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, loadSettings, saveSettings } from '../../src/db/db';
import { buildBackup, backupFilename } from '../../src/db/backup';
import * as repo from '../../src/db/repo';

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map((t) => t.clear()));
});

afterEach(() => {
  db.close();
});

describe('the export', () => {
  it('carries every table the library needs to come back', async () => {
    await loadSettings('0.0.0');
    const w = await repo.createWork({
      title: 'The Verdigris Ledger',
      authorName: 'A. Marchetti',
      format: 'novel',
      status: 'reading',
      progressCurrent: 400,
      progressTotal: 1140,
    });
    await repo.logSession(w.id, 412);
    const tag = await repo.tagByName('Cultivation');
    await repo.setTags(w.id, [tag.id]);
    const series = await repo.seriesByName('The Verdigris Cycle');
    await repo.createReadingOrder(
      { contextType: 'series', contextId: series.id, name: 'Publication order' },
      [{ kind: 'work', workId: w.id, label: w.title }],
    );
    const note = await repo.createNote({
      title: 'Margin route',
      body: 'This belongs with the work.',
      pinned: true,
      tagNames: ['Memory'],
      workIds: [w.id],
    });

    const file = await buildBackup('0.0.0');

    expect(file.counts.works).toBe(1);
    expect(file.data.works[0]?.title).toBe('The Verdigris Ledger');
    expect(file.data.authors).toHaveLength(1);
    expect(file.data.tags).toHaveLength(2);
    expect(file.counts.notes).toBe(1);
    expect(file.data.notes[0]).toMatchObject({ id: note.id, pinned: true });
    expect(file.data.noteLinks).toEqual([
      expect.objectContaining({ noteId: note.id, workId: w.id }),
    ]);
    // Sessions are what "chapters read" is a sum over. An export without them
    // restores a library whose Stats have silently reset.
    expect(file.data.readingSessions).toHaveLength(1);
    expect(file.counts.readingOrders).toBe(1);
    expect(file.data.readingOrders).toHaveLength(1);
    expect(file.data.readingOrderEntries).toHaveLength(1);
    expect(file.data.settings?.ownerName).toBeUndefined();
  });

  it('NEVER writes the model API key into the file', async () => {
    // SCHEMA §11. A backup is a file the reader may put in a cloud drive or
    // send to themselves in a chat, and a credential inside it travels
    // wherever the file goes.
    await loadSettings('0.0.0');
    await saveSettings({ aiApiKey: 'secret-value-that-must-not-travel', aiEnabled: true });

    const file = await buildBackup('0.0.0');

    expect(file.data.settings).toBeTruthy();
    expect(file.data.settings).not.toHaveProperty('aiApiKey');
    // The control: everything else about the settings row DID come through, so
    // this is not passing because the whole row went missing.
    expect(file.data.settings?.aiEnabled).toBe(true);
    expect(JSON.stringify(file)).not.toContain('secret-value-that-must-not-travel');
  });

  it('carries the derived spine-width cache so restore does not shift a matching shelf', async () => {
    await loadSettings('0.0.0');
    const spineWidthProfile = {
      version: 1 as const,
      signature: '40-adaptive',
      thresholds: {
        chapter: [9, 17, 25, 33] as [number, number, number, number],
        page: [200, 400, 700, 1000] as [number, number, number, number],
      },
      adaptiveUnits: ['chapter' as const],
    };
    await saveSettings({ spineWidthProfile });

    const file = await buildBackup('0.0.0');

    expect(file.data.settings?.spineWidthProfile).toEqual(spineWidthProfile);
  });

  it('leaves the stored settings untouched', async () => {
    await loadSettings('0.0.0');
    await saveSettings({ aiApiKey: 'still-here' });
    await buildBackup('0.0.0');
    // Redacting a copy must not redact the original.
    expect((await db.settings.get('singleton'))?.aiApiKey).toBe('still-here');
  });

  it('names the file by the reader calendar day, not the UTC one', () => {
    const at = new Date(2026, 0, 1, 1, 30);
    expect(backupFilename(at)).toBe('ex-libris-2026-01-01.json');
  });
});
