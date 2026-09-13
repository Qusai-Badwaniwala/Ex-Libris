/** Read-only source audit. No ingestion decision is hidden inside this probe. */
import { createReadStream, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';

const path = process.argv[2];
if (!path) throw new Error('Pass the downloaded Inventaire NDJSON gzip path.');
const hash = createHash('sha256');
for await (const chunk of createReadStream(path)) hash.update(chunk);
const types = new Map<string, number>();
const labels = new Map<string, string>();
const works: { id: string; english: boolean; authors: string[] }[] = [];
const samples: unknown[] = [];
const targets: unknown[] = [];
let count = 0;
for await (const line of createInterface({
  input: createReadStream(path).pipe(createGunzip()),
  crlfDelay: Infinity,
})) {
  const entity = JSON.parse(line) as {
    _id: string;
    labels?: Record<string, string>;
    claims?: Record<string, unknown[]>;
  };
  count++;
  const claims = entity.claims ?? {};
  const entityTypes = claims['wdt:P31'] ?? [];
  for (const type of entityTypes)
    if (typeof type === 'string') types.set(type, (types.get(type) ?? 0) + 1);
  const name = entity.labels?.['en'] ?? Object.values(entity.labels ?? {})[0];
  if (name) labels.set(`inv:${entity._id}`, name);
  if (entityTypes.includes('wd:Q47461344')) {
    works.push({
      id: entity._id,
      english: !!entity.labels?.['en'],
      authors: (claims['wdt:P50'] ?? []).filter((v): v is string => typeof v === 'string'),
    });
    if (samples.length < 3) samples.push(entity);
  }
  const title = `${Object.values(entity.labels ?? {}).join(' ')} ${(claims['wdt:P1476'] ?? []).join(' ')}`;
  if (
    /reverend insanity|lord of the mysteries|shadow slave|kill the sun|solo leveling|omniscient reader/i.test(
      title,
    )
  )
    targets.push(entity);
}
if (!count) throw new Error('The source contains zero entities.');
console.log(
  JSON.stringify(
    {
      path,
      bytes: statSync(path).size,
      sha256: hash.digest('hex'),
      entities: count,
      types: Object.fromEntries([...types].sort((a, b) => b[1] - a[1])),
      works: works.length,
      englishLabelWorks: works.filter((work) => work.english).length,
      worksWithAuthors: works.filter((work) => work.authors.length).length,
      worksWithFullyLocalAuthors: works.filter(
        (work) => work.authors.length && work.authors.every((id) => labels.has(id)),
      ).length,
      englishWorksWithFullyLocalAuthors: works.filter(
        (work) => work.english && work.authors.length && work.authors.every((id) => labels.has(id)),
      ).length,
      samples,
      targetMatches: targets,
    },
    null,
    2,
  ),
);
