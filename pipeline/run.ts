import { runAnilist } from './sources/anilist.ts';
import { runMangadex } from './sources/mangadex.ts';
import { runOpenLibrary, acquireOpenLibrary } from './sources/openlibrary.ts';
import { runWikidata } from './sources/wikidata.ts';
import { runMerge } from './merge.ts';
import type { StageReport } from './types.ts';

/**
 * The pipeline runner.
 *
 *   node pipeline/run.ts <stage...> [--pages N]
 *   node pipeline/run.ts anilist mangadex merge build
 *   node pipeline/run.ts all
 *
 * Every stage is resumable and idempotent: rerunning a finished one is a no-op,
 * rerunning an interrupted one picks up from its checkpoint. Nothing here is
 * part of the app bundle — it writes public/corpus/ and stops.
 *
 * `--pages` bounds the API stages, because the difference between proving the
 * pipeline works and pulling the whole of AniList is hours, and only one of
 * those is worth doing before the owner has seen the numbers.
 */

type Stage = (opts: Options) => Promise<StageReport>;

interface Options {
  pages: number;
  force: boolean;
}

const STAGES: Record<string, Stage> = {
  // 1 — downloads 16.2 GB. Never runs as part of `all`; it has to be asked for.
  acquire: (o) => acquireOpenLibrary(o.force),
  // 2 — streams the dumps and cuts them to a shippable core.
  openlibrary: () => runOpenLibrary(),
  // 3 — series membership (P179) and ordinal (P1545).
  wikidata: () => runWikidata(),
  // 4, 5 — the free APIs. These run today.
  anilist: (o) => runAnilist(o.pages),
  mangadex: (o) => runMangadex(Math.max(1, Math.floor(o.pages / 2))),
  // 6, 7 — normalise, merge, derive.
  merge: () => runMerge(),
  // 8, 9 — SQLite, manifest, checksum. Imported lazily because node:sqlite
  // prints an experimental warning the moment it is loaded, and a stage that
  // is not running should not be talking.
  build: async () => (await import('./build.ts')).runBuild(),
};

/** `all` deliberately excludes `acquire`: a 16 GB download is not something a
 *  command called "all" should start without being asked. */
const ALL = ['openlibrary', 'wikidata', 'anilist', 'mangadex', 'merge', 'build'];

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
