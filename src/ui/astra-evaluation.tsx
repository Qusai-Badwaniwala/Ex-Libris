import { useState } from 'react';
import { db, loadSettings, saveSettings } from '../db/db';
import * as repo from '../db/repo';
import { applyTheme } from './theme';

/** Only opened by the documented ?evaluate URL. Never runs implicitly. */
export function Evaluation({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sample = async () => {
    setBusy(true);
    setError('');
    try {
      await loadSettings('0.1.0');
      await db.transaction('rw', db.tables, async () => {
        if ((await db.work.count()) || (await db.note.count()))
          throw new Error(
            'This preview already has data. Open the existing library; the sample will not overwrite it.',
          );
        const inputs: repo.NewWorkInput[] = [
          {
            title: 'The Left Hand of Darkness',
            authorName: 'Ursula K. Le Guin',
            format: 'book',
            status: 'reading',
            publicationStatus: 'complete',
            progressUnit: 'page',
            progressCurrent: 146,
            progressTotal: 304,
            genres: [6, 11],
          },
          {
            title: 'A Wizard of Earthsea',
            authorName: 'Ursula K. Le Guin',
            format: 'book',
            status: 'finished',
            publicationStatus: 'complete',
            progressUnit: 'page',
            progressCurrent: 205,
            progressTotal: 205,
            genres: [4, 2],
          },
          {
            title: 'The Tombs of Atuan',
            authorName: 'Ursula K. Le Guin',
            format: 'book',
            status: 'reading',
            publicationStatus: 'complete',
            progressUnit: 'page',
            progressCurrent: 38,
            progressTotal: 180,
            genres: [4],
          },
          {
            title: 'The Farthest Shore',
            authorName: 'Ursula K. Le Guin',
            format: 'book',
            status: 'wishlist',
            publicationStatus: 'complete',
            progressUnit: 'page',
            genres: [4],
          },
          {
            title: 'The Wandering Inn',
            authorName: 'pirateaba',
            format: 'novel',
            status: 'reading',
            publicationStatus: 'ongoing',
            progressCurrent: 284,
            genres: [4, 3],
          },
          {
            title: 'Omniscient Reader',
            authorName: 'singNsong',
            format: 'manhwa',
            status: 'caught_up',
            publicationStatus: 'ongoing',
            progressCurrent: 220,
            progressTotal: 220,
            genres: [4, 2],
          },
          {
            title: 'Piranesi',
            authorName: 'Susanna Clarke',
            format: 'book',
            status: 'finished',
            publicationStatus: 'complete',
            progressUnit: 'page',
            progressCurrent: 245,
            progressTotal: 245,
            genres: [4, 5],
          },
          {
            title: 'The Dispossessed',
            authorName: 'Ursula K. Le Guin',
            format: 'book',
            status: 'wishlist',
            publicationStatus: 'complete',
            progressUnit: 'page',
            genres: [6, 11],
          },
          {
            title: 'A Psalm for the Wild-Built',
            authorName: 'Becky Chambers',
            format: 'book',
            status: 'wishlist',
            publicationStatus: 'complete',
            progressUnit: 'page',
            genres: [6, 3],
          },
          {
            title: 'Mother of Learning',
            authorName: 'Domagoj Kurmaic',
            format: 'novel',
            status: 'finished',
            publicationStatus: 'complete',
            progressCurrent: 108,
            progressTotal: 108,
            genres: [4, 1],
          },
          {
            title: 'Solo Leveling',
            authorName: 'Chugong',
            format: 'manhwa',
            status: 'finished',
            publicationStatus: 'complete',
            progressCurrent: 179,
            progressTotal: 179,
            genres: [2, 1],
          },
          {
            title: 'The Name of the Wind',
            authorName: 'Patrick Rothfuss',
            format: 'book',
            status: 'dropped',
            publicationStatus: 'complete',
            progressUnit: 'page',
            progressCurrent: 120,
            progressTotal: 662,
            genres: [4],
          },
          {
            title: 'A title whose publication is still unknown',
            format: 'novel',
            status: 'reading',
            progressCurrent: 17,
          },
        ];
        const works = await repo.createWorks(inputs);
        const first = works[0]!;
        const wizard = works[1]!;
        const tombs = works[2]!;
        const shore = works[3]!;
        const series = await repo.seriesByName('Earthsea');
        await repo.updateSeries(series.id, { totalEntriesKnown: 6 });
        const universe = await repo.universeByName('The world of Earthsea');
        await repo.updateUniverse(universe.id, {
          description: 'Islands, true names, and the balance between things.',
          readingOrderNote: 'Begin with A Wizard of Earthsea.',
        });
        await repo.linkSeriesToUniverse(series.id, universe.id);
        for (const [index, work] of [wizard, tombs, shore].entries()) {
          await repo.setSeries(work.id, { seriesId: series.id, seriesPosition: index + 1 });
          await repo.setUniverse(work.id, universe.id);
        }
        await repo.createReadingOrder(
          { contextType: 'series', contextId: series.id, name: 'Publication order' },
          [wizard, tombs, shore].map((work) => ({
            kind: 'work',
            label: work.title,
            workId: work.id,
          })),
        );
        await repo.createReadingOrder(
          { contextType: 'universe', contextId: universe.id, name: 'Through the archipelago' },
          [{ kind: 'series', label: series.name, seriesId: series.id }],
        );
        for (const work of [wizard, works[6]!, works[9]!])
          await repo.saveAxisRating(work.id, {
            world: 5,
            prose: 4,
            protagonist: 4,
            pacing: 3,
            ending: 4,
            translation: 3,
          });
        await repo.createNote({
          title: 'The distance between two people',
          body: 'The landscape keeps changing the way these characters understand each other. Return to the crossing after finishing the book.\n\nIs trust something they choose, or something the journey makes possible?',
          pinned: true,
          workIds: [first.id],
          tagNames: ['To revisit', 'Worldbuilding'],
        });
        await repo.createNote({
          title: 'Names, and what they ask of us',
          body: 'Earthsea makes knowing a name feel like a responsibility. Follow that idea from Ged’s first journey into the tombs.',
          pinned: false,
          workIds: [wizard.id, tombs.id],
          tagNames: ['Character study'],
        });
        await repo.createNote({
          title: 'A small reading list for a long train ride',
          body: 'Something quiet, with room to think. Piranesi again, perhaps, or the first Monk & Robot book.',
          pinned: false,
          workIds: [],
          tagNames: ['Reading plans'],
        });
        const removed = await repo.createWork({
          title: 'A recovered reading list entry',
          format: 'book',
          status: 'reading',
        });
        await repo.softDeleteWork(removed.id);
        const now = new Date().toISOString();
        await db.work.update(first.id, { updatedAt: now });
        await saveSettings({
          ownerName: 'A reader',
          theme: 'light',
          welcomeSeenAt: now,
          tourCompletedAt: now,
          firstTrackedAt: '2024-01-15T12:00:00.000Z',
        });
      });
      applyTheme('light');
      onDone();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'The sample library could not be created.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="room-evaluation">
      <span className="room-eyebrow">Astra · isolated frontend study</span>
      <h1>The Reading Room</h1>
      <p>
        Explore the complete Ex Libris experience with a sample library, or go through the real
        first-run flow.
      </p>
      <p>
        This preview has its own browser storage. Sample reading positions, notes and relationships
        are illustrative. No data from the deployed app is read or changed.
      </p>
      {error && <p role="alert">{error}</p>}
      <button className="room-primary" disabled={busy} onClick={() => void sample()}>
        {busy ? 'Preparing the sample library…' : 'Explore the sample library'}
      </button>
      <button className="room-text" disabled={busy} onClick={onDone}>
        Open existing library / start empty →
      </button>
    </main>
  );
}
