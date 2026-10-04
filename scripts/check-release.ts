import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { checksumFile } from '../pipeline/checksum.ts';
import { parseManifest } from '../src/catalogue/manifest.ts';

/** The approved release catalogue, never the output of a local fixture build. */
export function assertReleasedCatalogue(value: unknown) {
  const manifest = parseManifest(value);
  assert.equal(
    manifest.distribution,
    'production',
    'Only the approved production catalogue may ship.',
  );
  assert.equal(manifest.file, 'corpus.sqlite');
  assert.equal(manifest.version, '20260906');
  assert.equal(manifest.bytes, 273_784_832);
  assert.equal(manifest.sha256, '1d5c9eba8347481ab55db124378c15d1d6ac05264f7012160fc0954a0a7272c7');
  assert.equal(manifest.chunkSize, 4_194_304);
  assert.equal(manifest.chunks.length, 66);
  assert.deepEqual(manifest.sources, { openlibrary: 438_584 });
  assert.deepEqual(manifest.counts, {
    works: 438_584,
    series: 2_185,
    universes: 0,
    withSeries: 7_222,
    withCover: 438_584,
  });
  return manifest;
}

export function assertNoTestCode(path: string, code: string) {
  assert.doesNotMatch(
    path,
    /test-bridge|synthetic-fixture/i,
    `Test module present in public artifact: ${path}`,
  );
  assert.doesNotMatch(
    code,
    /__EXL_[A-Z0-9_]*TEST__/u,
    `Test bridge present in public artifact: ${path}`,
  );
}

function filesBelow(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory() ? filesBelow(child) : [child];
  });
}

export function checkRelease(root: string) {
  const output = join(root, 'dist');
  const manifest = assertReleasedCatalogue(
    JSON.parse(readFileSync(join(output, 'corpus', 'manifest.json'), 'utf8')),
  );
  const databasePath = join(output, 'corpus', manifest.file);
  assert.equal(statSync(databasePath).size, manifest.bytes);
  const checksum = checksumFile(databasePath);
  assert.equal(checksum.sha256, manifest.sha256, 'The shipped catalogue bytes changed.');
  assert.deepEqual(checksum.chunks, manifest.chunks, 'The shipped resumable checksum map changed.');
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    assert.equal(
      database.prepare('SELECT COUNT(*) AS count FROM corpus_work').get()?.count,
      manifest.counts.works,
    );
    assert.equal(database.prepare('PRAGMA quick_check(1)').get()?.quick_check, 'ok');
    assert.equal(
      database
        .prepare(
          `SELECT COUNT(*) AS count FROM corpus_work WHERE source NOT IN ('openlibrary', 'wikidata') OR lower(external_ids) LIKE '%"anilist"%' OR lower(external_ids) LIKE '%"mangadex"%'`,
        )
        .get()?.count,
      0,
    );
  } finally {
    database.close();
  }
  const scripts = filesBelow(output).filter((path) => path.endsWith('.js'));
  assert.ok(scripts.length > 0, 'The public artifact contains no scripts.');
  for (const path of scripts) assertNoTestCode(path, readFileSync(path, 'utf8'));
  const appManifest = JSON.parse(readFileSync(join(output, 'manifest.webmanifest'), 'utf8'));
  assert.equal(appManifest.start_url, '/Ex-Libris/');
  assert.equal(appManifest.scope, '/Ex-Libris/');
  const html = readFileSync(join(output, 'index.html'), 'utf8');
  assert.match(html, /src="\/Ex-Libris\/assets\/[^"/]+\.js"/u);
  assert.equal(readFileSync(join(output, '404.html'), 'utf8'), html);
  assert.ok(existsSync(join(output, '.nojekyll')));
  const worker = readFileSync(join(output, 'sw.js'), 'utf8');
  assert.doesNotMatch(
    worker,
    /["'](?:\/Ex-Libris\/)?corpus\/(?:manifest\.json|corpus\.sqlite)["']/u,
  );
  const originals = readdirSync(join(root, 'public', 'illustrations')).filter((name) =>
    name.endsWith('.svg'),
  );
  assert.equal(
    originals.length,
    13,
    'Review the illustration precache assertion when the asset set changes.',
  );
  for (const name of originals) {
    for (const theme of ['light', 'dark']) {
      const asset = `illustrations/${theme}/${name}`;
      assert.ok(existsSync(join(output, asset)), `Offline theme asset missing: ${asset}`);
      assert.ok(worker.includes(asset), `Offline theme asset not precached: ${asset}`);
    }
    assert.ok(
      !worker.includes(`illustrations/${name}`),
      `Unused original still precached: ${name}`,
    );
  }
  console.log(
    `Verified public artifact: ${scripts.length} scripts without test bridges; 438,584 licensed works with the approved checksum; both offline illustration themes.`,
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  checkRelease(fileURLToPath(new URL('..', import.meta.url)));
}
