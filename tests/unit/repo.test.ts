import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../src/db/db';
import * as repo from '../../src/db/repo';
import { displayWork, sessionCeiling } from '../../src/db/derive';
import type { Work } from '../../src/db/schema';

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map((t) => t.clear()));
});

afterEach(() => {
  db.close();
});

const novel = (over: Partial<repo.NewWorkInput> = {}) =>
  repo.createWork({
    title: 'The Verdigris Ledger',
    authorName: 'A. Marchetti',
    format: 'novel',
    status: 'reading',
    publicationStatus: 'ongoing',
    progressCurrent: 412,
    progressTotal: 1140,
    ...over,
  });

describe('creating a work', () => {
  it('derives the sort key and the default unit from the format', async () => {
    const w = await novel({ title: 'The Quiet Machinery', format: 'book' });
    expect(w.sortTitle).toBe('quiet machinery');
    expect(w.progressUnit).toBe('page');
  });

  it('reuses an author rather than creating a second one', async () => {
    await novel();
    await novel({ title: 'Nine Winters of Ash' });
    expect(await db.author.count()).toBe(1);
  });

  it('accepts a work with no author at all — manhwa often credits nobody', async () => {
    const w = await repo.createWork({ title: 'Untitled draft', format: 'book', status: 'reading' });
    expect(w.authorIds).toEqual([]);
    expect(w.isManualEntry).toBe(true);
  });

  it('stamps dateStarted when something is added straight to Reading', async () => {
    const w = await novel({ status: 'reading' });
    expect(w.dateStarted).toBeTruthy();
    const wish = await novel({ title: 'Later', status: 'wishlist' });
    expect(wish.dateStarted).toBeUndefined();
  });

  it('refuses to store a third genre', async () => {
    const w = await novel({ genres: [1, 4, 8] });
    expect(w.genres).toEqual([1, 4]);
  });
});

// ── A1 ────────────────────────────────────────────────────────────────────

describe('changing the status', () => {
  it('stamps dateFinished on the way in', async () => {
    const w = await novel();
    const done = await repo.setStatus(w.id, 'finished');
    expect(done.dateFinished).toBeTruthy();
  });

  it('CLEARS dateFinished when a mistaken finish is corrected', async () => {
    // The reason this rule exists: a work marked finished by mistake goes on
    // counting toward "finished in 2026" forever, and the reader has no way to
    // see why the number is wrong or to fix it.
    const w = await novel();
    await repo.setStatus(w.id, 'finished');
    const back = await repo.setStatus(w.id, 'reading');
    expect(back.dateFinished).toBeUndefined();
    expect(back.status).toBe('reading');
  });

  it('records where a drop happened, and forgets it if the drop is undone', async () => {
    const w = await novel();
    const dropped = await repo.setStatus(w.id, 'dropped');
    expect(dropped.dropAtProgress).toBe(412);
    expect(dropped.dateDropped).toBeTruthy();

    const resumed = await repo.setStatus(w.id, 'reading');
    expect(resumed.dropAtProgress).toBeUndefined();
    expect(resumed.dateDropped).toBeUndefined();
  });

  it('keeps the original dateStarted when a work is finished', async () => {
    const w = await novel();
    const started = w.dateStarted;
    const done = await repo.setStatus(w.id, 'finished');
    expect(done.dateStarted).toBe(started);
  });

  it('offers caught up only for a work that is still being published', () => {
    expect(repo.statusesFor('ongoing')).toContain('caught_up');
    expect(repo.statusesFor('hiatus')).toContain('caught_up');
    // The control. A finished book cannot be "caught up" — there is nothing to
    // be caught up WITH.
    expect(repo.statusesFor('complete')).not.toContain('caught_up');
    expect(repo.statusesFor('abandoned')).not.toContain('caught_up');
    expect(repo.statusesFor('unknown')).not.toContain('caught_up');
  });

  it('refuses caught up on a complete work rather than storing it', async () => {
    const w = await novel({ publicationStatus: 'complete' });
    await expect(repo.setStatus(w.id, 'caught_up')).rejects.toThrow(/not offered/);
  });
});

// ── A2, A3, A4 ────────────────────────────────────────────────────────────

describe('editing the fields the design had no control for', () => {
  it('retitles and rebuilds the sort key together', async () => {
    const w = await novel({ title: 'Untitled draft' });
    const renamed = await repo.setTitle(w.id, 'The Gravebright Compact');
    expect(renamed.title).toBe('The Gravebright Compact');
    expect(renamed.sortTitle).toBe('gravebright compact');
  });

  it('changes the shelf WITHOUT silently changing the unit', async () => {
    // SCHEMA §1 says format is never auto-corrected. Turning a page count into
    // a chapter count would change what the number on screen means without
    // changing the number, which is the worst kind of quiet edit.
    const w = await novel({ format: 'book' });
    expect(w.progressUnit).toBe('page');
    const moved = await repo.setFormat(w.id, 'novel');
    expect(moved.format).toBe('novel');
    expect(moved.progressUnit).toBe('page');
  });

  it('sets and clears the progress total', async () => {
    const w = await novel({ progressTotal: undefined });
    expect(w.progressTotal).toBeUndefined();
    const withTotal = await repo.setProgressTotal(w.id, 388);
    expect(withTotal.progressTotal).toBe(388);
    const cleared = await repo.setProgressTotal(w.id, undefined);
    expect(cleared.progressTotal).toBeUndefined();
  });

  it('treats a total of zero as no total, not as a zero denominator', async () => {
    const w = await novel();
    expect((await repo.setProgressTotal(w.id, 0)).progressTotal).toBeUndefined();
  });

  it('lets the position be corrected downward without recording a session', async () => {
    const w = await novel();
    await repo.logSession(w.id, 500);
    expect(await db.readingSession.count()).toBe(1);

    const fixed = await repo.setProgressCurrent(w.id, 300);
    expect(fixed.progressCurrent).toBe(300);
    // A correction is not reading. If it recorded a session, Stats would count
    // the same chapters twice and could never be brought back into line.
    expect(await db.readingSession.count()).toBe(1);
  });

  it('clears the position when a series is removed', async () => {
    const w = await novel();
    const series = await repo.seriesByName('The Verdigris Cycle');
    const joined = await repo.setSeries(w.id, { seriesId: series.id, seriesPosition: 1 });
    expect(joined.seriesPosition).toBe(1);

    const detached = await repo.setSeries(w.id, {});
    expect(detached.seriesId).toBeUndefined();
    // A position with no series renders as "#1" of nothing.
    expect(detached.seriesPosition).toBeUndefined();
  });
});

// ── sessions ──────────────────────────────────────────────────────────────

describe('logging a session', () => {
  it('moves the work and records what was read', async () => {
    const w = await novel();
    const { work } = await repo.logSession(w.id, 500);
    expect(work.progressCurrent).toBe(500);
    expect(await repo.chaptersRead()).toBe(88);
  });

  it('records nothing when the position did not move forward', async () => {
    const w = await novel();
    await repo.logSession(w.id, 412);
    await repo.logSession(w.id, 100);
    expect(await db.readingSession.count()).toBe(0);
    expect(await repo.chaptersRead()).toBe(0);
  });

  it('finishes a work when a session reaches the end of a COMPLETE work', async () => {
    const w = await novel({ publicationStatus: 'complete', progressTotal: 642 });
    const { work, finished } = await repo.logSession(w.id, 642);
    expect(finished).toBe(true);
    expect(work.status).toBe('finished');
    expect(work.dateFinished).toBeTruthy();
  });

  it('offers caught up when an ongoing serial reaches its published count', async () => {
    // Q-022. The progress row starts saying "published" at this moment while
    // the status pill still says Reading. The app asks rather than deriving:
    // status describes the reader and is never computed from the work.
    const w = await novel({ publicationStatus: 'ongoing', progressTotal: 1140 });
    const { atPublishedEdge, work } = await repo.logSession(w.id, 1140);
    expect(atPublishedEdge).toBe(true);
    // Offered, not applied.
    expect(work.status).toBe('reading');
  });

  it('does not offer caught up short of the published count', async () => {
    const w = await novel({ publicationStatus: 'ongoing', progressTotal: 1140 });
    expect((await repo.logSession(w.id, 1139)).atPublishedEdge).toBe(false);
  });

  it('does not offer caught up for a work that has finished publishing', async () => {
    // There is nothing to be caught up WITH. That path finishes instead.
    const w = await novel({ publicationStatus: 'complete', progressTotal: 642 });
    const r = await repo.logSession(w.id, 642);
    expect(r.atPublishedEdge).toBe(false);
    expect(r.finished).toBe(true);
  });

  it('does not offer caught up to a reader who already is', async () => {
    const w = await novel({ publicationStatus: 'ongoing', progressTotal: 1140 });
    await repo.setStatus(w.id, 'caught_up');
    expect((await repo.logSession(w.id, 1140)).atPublishedEdge).toBe(false);
  });

  it('does NOT finish an ongoing serial that reaches its published count', async () => {
    // D-105: for an ongoing work the total is what has been released. Marking
    // it finished would be the app asserting an ending the author has not
    // written.
    const w = await novel({ publicationStatus: 'ongoing', progressTotal: 1140 });
    const { work, finished } = await repo.logSession(w.id, 1140);
    expect(finished).toBe(false);
    expect(work.status).toBe('reading');
  });

  it('lets an ongoing serial be logged past its published count', async () => {
    const w = await novel({ publicationStatus: 'ongoing', progressTotal: 1140 });
    await repo.logSession(w.id, 1180);
    expect((await repo.getWork(w.id))?.progressCurrent).toBe(1180);
    expect(sessionCeiling(await novel({ publicationStatus: 'ongoing' }))).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it('sums chapters read across works and survives a correction', async () => {
    const a = await novel();
    const b = await novel({ title: 'Field Notes on Ruin', progressCurrent: 0 });
    await repo.logSession(a.id, 512); // 100
    await repo.logSession(b.id, 40); // 40
    expect(await repo.chaptersRead()).toBe(140);

    // Correcting a position downward must NOT reduce what was genuinely read.
    // This is the whole reason sessions exist rather than a sum over progress.
    await repo.setProgressCurrent(a.id, 200);
    expect(await repo.chaptersRead()).toBe(140);
  });
});

// ── A6 / trash ────────────────────────────────────────────────────────────

describe('the trash', () => {
  it('hides a soft-deleted work from the library but keeps it restorable', async () => {
    const w = await novel();
    await repo.softDeleteWork(w.id);
    expect(await repo.listLibrary()).toHaveLength(0);
    expect(await repo.listTrash()).toHaveLength(1);

    await repo.restoreWork(w.id);
    expect(await repo.listLibrary()).toHaveLength(1);
  });

  it('keeps notes linked through a soft delete, so a restore is whole', async () => {
    const w = await novel();
    await db.noteLink.put({ noteId: 'n1', workId: w.id, createdAt: new Date().toISOString() });
    await repo.softDeleteWork(w.id);
    expect(await db.noteLink.count()).toBe(1);
  });

  it('unlinks notes on a permanent delete rather than deleting them', async () => {
    // SCHEMA §6. The note is the reader's writing; the work is a record. Losing
    // the second must never lose the first.
    const w = await novel();
    await db.note.put({
      id: 'n1',
      body: 'Marchetti puts a ledger in every book.',
      tagIds: [],
      pinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await db.noteLink.put({ noteId: 'n1', workId: w.id, createdAt: new Date().toISOString() });
    await db.readingSession.add({
      id: 's1',
      workId: w.id,
      from: 0,
      to: 10,
      delta: 10,
      unit: 'chapter',
      at: new Date().toISOString(),
    });

    await repo.purgeWork(w.id);

    expect(await db.work.count()).toBe(0);
    expect(await db.noteLink.count()).toBe(0);
    expect(await db.note.count()).toBe(1);
    expect(await db.readingSession.count()).toBe(0);
  });

  it('purges only what is past thirty days', async () => {
    const keep = await novel({ title: 'Recent' });
    const old = await novel({ title: 'Ancient' });
    await repo.softDeleteWork(keep.id);
    await repo.softDeleteWork(old.id);
    await db.work.update(old.id, {
      deletedAt: new Date(Date.now() - 31 * 86400000).toISOString(),
    });

    expect(await repo.purgeExpired()).toBe(1);
    const left = await repo.listTrash();
    expect(left.map((w) => w.title)).toEqual(['Recent']);
  });

  it('counts days left down to zero and never below', () => {
    const iso = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
    expect(repo.daysLeftInTrash(iso(0))).toBe(30);
    expect(repo.daysLeftInTrash(iso(29))).toBe(1);
    expect(repo.daysLeftInTrash(iso(60))).toBe(0);
  });
});

// ── B9 / tags ─────────────────────────────────────────────────────────────

describe('tags', () => {
  it('returns the same tag for two spellings that normalise alike', async () => {
    const a = await repo.tagByName('LitRPG');
    const b = await repo.tagByName('litrpg');
    expect(b.id).toBe(a.id);
    expect(await db.tag.count()).toBe(1);
  });

  it('carries the group membership the seed vocabulary defines', async () => {
    const t = await repo.tagByName('Body Horror');
    expect(t.groups).toEqual(['Subgenre', 'Content warnings']);
    const invented = await repo.tagByName('Something I made up');
    expect(invented.groups).toEqual([]);
  });

  it('keeps usage counts honest as works come and go', async () => {
    const tag = await repo.tagByName('Cultivation');
    const w = await novel({ tagIds: [tag.id] });
    expect((await db.tag.get(tag.id))?.usageCount).toBe(1);

    await repo.purgeWork(w.id);
    expect((await db.tag.get(tag.id))?.usageCount).toBe(0);
  });
});

// ── display ───────────────────────────────────────────────────────────────

describe('what a screen paints', () => {
  const base = (over: Partial<Work>): Work =>
    ({
      id: 'w',
      title: 't',
      sortTitle: 't',
      format: 'novel',
      authorIds: [],
      status: 'reading',
      publicationStatus: 'ongoing',
      progressUnit: 'chapter',
      progressCurrent: 412,
      coverSource: 'none',
      tagIds: [],
      genres: [],
      isTranslated: false,
      dateAdded: '',
      externalIds: {},
      isManualEntry: false,
      updatedAt: '',
      ...over,
    }) as Work;

  it('shows no bar and no percentage when there is no total', () => {
    // The common case for a web novel. It has to look deliberate.
    const d = displayWork(base({ progressTotal: undefined }));
    expect(d.showBar).toBe(false);
    expect(d.percentLabel).toBe('');
    expect(d.progressLabel).toBe('Chapter 412');
  });

  it('shows a percentage only when there is a real end to measure against', () => {
    const complete = displayWork(base({ publicationStatus: 'complete', progressTotal: 1140 }));
    expect(complete.percentLabel).toBe('36%');

    // An ongoing work's total is what has been released, not a ceiling — so a
    // percentage would be a percentage of nothing.
    const ongoing = displayWork(base({ publicationStatus: 'ongoing', progressTotal: 1140 }));
    expect(ongoing.percentLabel).toBe('36%');
    const edge = displayWork(
      base({ publicationStatus: 'ongoing', progressTotal: 1140, progressCurrent: 1140 }),
    );
    expect(edge.shortProgress).toBe('Caught up');
    expect(edge.percentLabel).toBe('');
  });

  it('never paints a fill wider than its own track', () => {
    // Reachable now that the total is editable: correct a total downward and
    // the position is legitimately past it.
    const d = displayWork(
      base({ publicationStatus: 'complete', progressTotal: 100, progressCurrent: 400 }),
    );
    expect(d.barWidth).toBe('100%');
  });

  it('segments the track for a caught-up work and not for a reading one', () => {
    const caught = displayWork(base({ status: 'caught_up' }));
    const reading = displayWork(base({ status: 'reading', progressTotal: 1140 }));
    expect(caught.fillBackground).toContain('repeating-linear-gradient');
    expect(reading.fillBackground).toBe('var(--status-reading)');
  });

  it('names the session control for what it means on a caught-up serial', () => {
    expect(displayWork(base({ status: 'caught_up' })).sessionCta).toBe('New chapters');
    expect(displayWork(base({ status: 'reading' })).sessionCta).toBe('Log a session');
    expect(displayWork(base({ status: 'finished' })).canLogSession).toBe(false);
  });

  it('says Author unknown rather than leaving a gap', () => {
    expect(displayWork(base({}), '  ').authorLine).toBe('Author unknown');
    expect(displayWork(base({}), 'H. Sørensen').hasAuthor).toBe(true);
  });
});
