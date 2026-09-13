import { dumpPath, isFictionSubject } from './sources/openlibrary.ts';
import { n, readGzipLines } from './lib.ts';

/**
 * Read-only sizing probe for the Open Library works dump.
 *
 * The works records do not carry edition counts and the 2026-08-31 dump has no
 * useful work-level language field. Before choosing a replacement predicate,
 * measure the remaining signals against the complete source rather than tuning
 * a phone catalogue from a small sample.
 */

interface WorkRecord {
  title?: string;
  authors?: { author?: { key?: string } }[];
  covers?: number[];
  languages?: { key?: string }[];
  subjects?: string[];
  revision?: number;
}

const counts: Record<string, number> = {
  seen: 0,
  candidates: 0,
  withLanguageField: 0,
  withSubjects: 0,
  fictionTagged: 0,
};

const revisionThresholds = [2, 3, 5, 10, 20];
const subjectThresholds = [2, 4, 8, 12];
for (const threshold of revisionThresholds) {
  counts[`revisionAtLeast${threshold}`] = 0;
  counts[`fictionRevisionAtLeast${threshold}`] = 0;
}
for (const threshold of subjectThresholds) {
  counts[`fictionSubjectsAtLeast${threshold}`] = 0;
}

for await (const line of readGzipLines(dumpPath('works'))) {
  counts['seen']!++;
  const tab = line.lastIndexOf('\t');
  if (tab < 0) continue;
  let record: WorkRecord;
  try {
    record = JSON.parse(line.slice(tab + 1)) as WorkRecord;
  } catch {
    continue;
  }

  const hasTitle = Boolean(record.title?.trim());
  const hasAuthor = Boolean(record.authors?.some((author) => Boolean(author.author?.key?.trim())));
  const hasCover = Boolean(record.covers?.some((cover) => Number.isInteger(cover) && cover > 0));
  if (!hasTitle || !hasAuthor || !hasCover) continue;

  counts['candidates']!++;
  if (record.languages?.length) counts['withLanguageField']!++;
  const subjects = record.subjects ?? [];
  if (subjects.length) counts['withSubjects']!++;
  const fiction = subjects.some(isFictionSubject);
  if (fiction) counts['fictionTagged']!++;

  const revision = record.revision ?? 0;
  for (const threshold of revisionThresholds) {
    if (revision >= threshold) counts[`revisionAtLeast${threshold}`]!++;
    if (fiction && revision >= threshold) counts[`fictionRevisionAtLeast${threshold}`]!++;
  }
  for (const threshold of subjectThresholds) {
    if (fiction && subjects.length >= threshold) counts[`fictionSubjectsAtLeast${threshold}`]!++;
  }

  if (counts['seen']! % 5_000_000 === 0) {
    process.stdout.write(`\r${n(counts['seen']!)} source rows scanned`);
  }
}

process.stdout.write('\n');
for (const [name, count] of Object.entries(counts)) {
  console.log(`${name.padEnd(30)} ${n(count)}`);
}
