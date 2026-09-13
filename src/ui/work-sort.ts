import type { Work } from '../db/schema';
import type { WorkWithAuthor } from './store';

export type SortKey = 'recent' | 'title' | 'progress' | 'added';

export const SORTS: { value: SortKey; label: string; note: string }[] = [
  { value: 'recent', label: 'Last read', note: 'What you touched most recently, first.' },
  { value: 'added', label: 'Date added', note: 'Newest addition first.' },
  { value: 'title', label: 'Title', note: 'Alphabetical, ignoring a leading The or A.' },
  { value: 'progress', label: 'Progress', note: 'Furthest through, first.' },
];

export function sortWorks(rows: WorkWithAuthor[], by: SortKey): WorkWithAuthor[] {
  const out = [...rows];
  switch (by) {
    case 'title':
      return out.sort((a, b) => a.work.sortTitle.localeCompare(b.work.sortTitle));
    case 'added':
      return out.sort((a, b) => b.work.dateAdded.localeCompare(a.work.dateAdded));
    case 'progress':
      // Works with no total have no fraction to compare, so they sort by raw
      // position among themselves and below anything measurable. Inventing a
      // denominator to rank them would be the same lie as inventing a bar.
      return out.sort((a, b) => fraction(b.work) - fraction(a.work));
    case 'recent':
    default:
      return out.sort((a, b) => b.work.updatedAt.localeCompare(a.work.updatedAt));
  }
}

function fraction(work: Work): number {
  if (!work.progressTotal) return -1;
  return Math.min(1, work.progressCurrent / work.progressTotal);
}
