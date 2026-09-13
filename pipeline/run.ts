import { runAnilist } from './sources/anilist.ts';
import { runMangadex } from './sources/mangadex.ts';
import {
  runOpenLibrary,
  runOpenLibraryAuthors,
  acquireOpenLibrary,
} from './sources/openlibrary.ts';
import { runWikidata } from './sources/wikidata.ts';
import { runMerge } from './merge.ts';
import type { StageReport } from './types.ts';

/**
 * The pipeline runner.
 *
 *   node pipeline/run.ts <stage...> [--pages N]
 *   node pipeline/run.ts anilist mangadex fixture-merge fixture-build
 *   node pipeline/run.ts all
 *
 * Every stage is resumable and idempotent: rerunning a finished one is a no-op,
 * rerunning an interrupted one picks up from its checkpoint. Nothing here is
 * part of the app bundle — it writes public/corpus/ and stops.
 *
 * `--pages` bounds the API stages. A bounded Wikidata run stays incomplete and
 * a production merge refuses it; a local API fixture can still be rebuilt with
 * explicit AniList/MangaDex stage names.
 */

type Stage = (opts: Options) => Promise<StageReport>;

interface Options {
  pages: number;
  force: boolean;
}

const STAGES: Record<string, Stage> = {
  // 1 — downloads 4.84 GB by default. Never runs as part of `all`; the owner
  // must explicitly approve and request it. `--force` adds unused editions.
  acquire: (o) => acquireOpenLibrary(o.force),
  // 2 — series ids are part of the compact-core predicate, so Wikidata must
  // complete before the works dump is filtered and its author keys resolved.
  wikidata: (o) => runWikidata(o.pages),
  openlibrary: () => runOpenLibrary(),
  'openlibrary-authors': () => runOpenLibraryAuthors(),
  // 4, 5 — local engineering fixtures only; never default production input.
  anilist: (o) => runAnilist(o.pages),
  mangadex: (o) => runMangadex(Math.max(1, Math.floor(o.pages / 2))),
  // 6, 7 — production merge ignores restricted caches mechanically. The
  // fixture variant must be named explicitly and the build marks its output.
  merge: () => runMerge(),
  'fixture-merge': () => runMerge({ includeRestricted: true, requireCompleteWikidata: false }),
  // 8, 9 — SQLite, manifest, checksum. Imported lazily because node:sqlite
  // prints an experimental warning the moment it is loaded, and a stage that
  // is not running should not be talking.
  build: async () => (await import('./build.ts')).runBuild(),
  'fixture-build': async () => (await import('./build.ts')).runFixtureBuild(),
};

/** `all` deliberately excludes acquisition and every restricted API source. */
const ALL = ['wikidata', 'openlibrary', 'openlibrary-authors', 'merge', 'build'];

async function main() {
  const argv = process.argv.slice(2);
  const pagesArg = argv.indexOf('--pages');
  const pages = pagesArg >= 0 ? Number(argv[pagesArg + 1]) : 20;
  const force = argv.includes('--force');
  const named = argv.filter((a) => !a.startsWith('--') && a !== String(pages));

  const wanted = named.length === 0 || named[0] === 'all' ? ALL : named;
  const unknown = wanted.filter((s) => !(s in STAGES));
  if (unknown.length) {
    console.error(`unknown stage(s): ${unknown.join(', ')}`);
    console.error(`available: ${Object.keys(STAGES).join(', ')}, all`);
    process.exit(1);
  }

  console.log(`\nEx Libris corpus pipeline — ${wanted.join(' → ')}\n`);
  const reports: StageReport[] = [];

  for (const name of wanted) {
    process.stdout.write(`  ${name} … `);
    try {
      const report = await STAGES[name]!({ pages, force });
      reports.push(report);
      console.log(report.ok ? `${report.seconds.toFixed(1)}s` : 'SKIPPED');
      for (const [k, v] of Object.entries(report.counts)) {
        console.log(`      ${k.padEnd(18)} ${v.toLocaleString('en-US')}`);
      }
      for (const note of report.notes) console.log(`      · ${note}`);
      // A stage that could not do its job stops the chain. Carrying on would
      // build a corpus from whatever happened to be on disk and report a size
      // for it, which is worse than stopping.
      if (!report.ok) {
        console.error(`\n  ${name} did not complete. Stopping.\n`);
        process.exit(1);
      }
    } catch (e) {
      console.log('FAILED');
      console.error(`      ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
    console.log('');
  }

  console.log('Done. Paste the counts above into docs/PIPELINE-NOTES.md.\n');
}

await main();
