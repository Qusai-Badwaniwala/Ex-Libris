import { catalogue } from '../catalogue/client';
import type { CorpusRelationshipEvidence } from '../catalogue/types';
import { db } from '../db/db';
import * as repo from '../db/repo';
import { nav } from '../router/router';

interface Phase5Fixture {
  seriesId: string;
  unknownSeriesId: string;
  universeId: string;
  workIds: string[];
}

export interface Phase5TestBridge {
  seed(): Promise<Phase5Fixture>;
  seedHighSuggestion(): Promise<string>;
  openSeries(id: string): void;
  openUniverse(id: string): void;
  failNextOrderWrite(): void;
}

declare global {
  interface Window {
    __EXL_PHASE5_TEST__?: Phase5TestBridge;
  }
}

window.__EXL_PHASE5_TEST__ = {
  async seed() {
    const series = await repo.seriesByName('The Verdigris Cycle');
    await repo.updateSeries(series.id, { totalEntriesKnown: 4 });
    const first = await repo.createWork({
      title: 'The Verdigris Ledger',
      authorName: 'A. Marchetti',
      format: 'book',
      status: 'finished',
      publicationStatus: 'complete',
    });
    const second = await repo.createWork({
      title: 'Nine Winters of Ash',
      authorName: 'A. Marchetti',
      format: 'book',
      status: 'wishlist',
      publicationStatus: 'complete',
    });
    const third = await repo.createWork({
      title: 'The Gravebright Compact and the Exceptionally Long Accounting of Broken Kingdoms',
      authorName: 'A. Marchetti',
      format: 'book',
      status: 'reading',
      publicationStatus: 'complete',
    });
    await repo.setSeries(first.id, { seriesId: series.id, seriesPosition: 1 });
    await repo.setSeries(second.id, { seriesId: series.id, seriesPosition: 2 });
    await repo.setSeries(third.id, { seriesId: series.id, seriesPosition: 3 });

    await repo.createReadingOrder(
      {
        contextType: 'series',
        contextId: series.id,
        name: 'Publication order',
        description: 'Catalogue-known sequence; one later entry remains outside the library.',
        source: 'corpus',
      },
      [
        { kind: 'work', workId: first.id, label: first.title },
        { kind: 'work', workId: second.id, label: second.title },
        { kind: 'work', workId: third.id, label: third.title },
        {
          kind: 'work',
          corpusId: 'openlibrary:OL-salt-accounts',
          label: 'The Salt Accounts',
        },
      ],
    );
    await repo.createReadingOrder(
      { contextType: 'series', contextId: series.id, name: 'Preferred order' },
      [
        { kind: 'work', workId: second.id, label: second.title },
        { kind: 'work', workId: first.id, label: first.title },
        { kind: 'work', workId: third.id, label: third.title },
      ],
    );

    const universe = await repo.universeByName('The Ledger Continuity');
    await repo.updateUniverse(universe.id, {
      description: 'Three series share one history across four centuries.',
      readingOrderNote:
        'Start with The Verdigris Cycle, not The Salt Accounts, even though it was published first.',
    });
    await repo.linkSeriesToUniverse(series.id, universe.id);

    const unknownSeries = await repo.seriesByName('The Salt Accounts');
    await repo.linkSeriesToUniverse(unknownSeries.id, universe.id);
    const salt = await repo.createWork({
      title: 'A Salt Account Written in Winter',
      authorName: 'A. Marchetti',
      format: 'book',
      status: 'reading',
      publicationStatus: 'unknown',
    });
    await repo.setSeries(salt.id, { seriesId: unknownSeries.id, seriesPosition: 1 });

    await repo.createReadingOrder(
      {
        contextType: 'universe',
        contextId: universe.id,
        name: 'Publication order',
        description: 'The order the series first appeared.',
      },
      [
        { kind: 'series', seriesId: unknownSeries.id, label: unknownSeries.name },
        { kind: 'series', seriesId: series.id, label: series.name },
      ],
    );
    await repo.createReadingOrder(
      {
        contextType: 'universe',
        contextId: universe.id,
        name: 'Recommended order',
        description: 'Keeps the central reveal intact.',
      },
      [
        { kind: 'series', seriesId: series.id, label: series.name },
        { kind: 'series', seriesId: unknownSeries.id, label: unknownSeries.name },
      ],
    );

    return {
      seriesId: series.id,
      unknownSeriesId: unknownSeries.id,
      universeId: universe.id,
      workIds: [first.id, second.id, third.id, salt.id],
    };
  },

  async seedHighSuggestion() {
    const work = await repo.createWork({
      title: 'Golden Son',
      authorName: 'Pierce Brown',
      format: 'book',
      status: 'reading',
      publicationStatus: 'complete',
      corpusId: 'openlibrary:OL-golden-son',
    });
    const evidence: CorpusRelationshipEvidence = {
      work: {
        corpusId: work.corpusId!,
        title: work.title,
        authors: ['Pierce Brown'],
        formatHint: 'book',
        seriesPosition: 2,
        publicationStatus: 'complete',
        source: 'openlibrary',
      },
      series: {
        corpusSeriesId: 'series:wikidata:Q-RR',
        name: 'Red Rising',
        totalEntriesKnown: 3,
        source: 'wikidata',
        entries: [
          {
            corpusId: 'openlibrary:OL-red-rising',
            title: 'Red Rising',
            authors: ['Pierce Brown'],
            formatHint: 'book',
            seriesPosition: 1,
            publicationStatus: 'complete',
            source: 'openlibrary',
          },
          {
            corpusId: work.corpusId!,
            title: work.title,
            authors: ['Pierce Brown'],
            formatHint: 'book',
            seriesPosition: 2,
            publicationStatus: 'complete',
            source: 'openlibrary',
          },
          {
            corpusId: 'openlibrary:OL-morning-star',
            title: 'Morning Star',
            authors: ['Pierce Brown'],
            formatHint: 'book',
            seriesPosition: 3,
            publicationStatus: 'complete',
            source: 'openlibrary',
          },
        ],
      },
    };
    catalogue.relationship = async () => evidence;
    nav.push({ screen: 'detail', id: work.id, suggestRelationships: true });
    return work.id;
  },

  openSeries(id) {
    nav.push({ screen: 'series', id });
  },

  openUniverse(id) {
    nav.push({ screen: 'universe', id });
  },

  failNextOrderWrite() {
    const fail = () => {
      db.readingOrder.hook('updating').unsubscribe(fail);
      throw new Error('Synthetic storage failure.');
    };
    db.readingOrder.hook('updating').subscribe(fail);
  },
};
