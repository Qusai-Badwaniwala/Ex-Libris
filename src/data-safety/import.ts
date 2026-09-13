import type { CorpusMatch } from '../catalogue/types';
import type { Format, ReadingStatus } from '../db/schema';
import { createWorks, type NewWorkInput } from '../db/repo';

export interface ImportDraft {
  sourceIndex: number;
  title: string;
  author?: string;
  format: Format;
  status: ReadingStatus;
  progressCurrent?: number;
  progressTotal?: number;
  rating?: number;
  tags: string[];
  match?: CorpusMatch;
  include: boolean;
}

export type CsvField = 'title' | 'author' | 'status' | 'format' | 'progress' | 'rating' | 'tags';
export type CsvMapping = Partial<Record<CsvField, number>>;

export interface CsvTable {
  headers: string[];
  rows: string[][];
}

export function parseTitleList(text: string): ImportDraft[] {
  const seen = new Set<string>();
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      const key = line.normalize('NFKC').toLocaleLowerCase('en-US');
      if (!line || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((title, sourceIndex) => ({
      sourceIndex,
      title,
      format: 'novel',
      status: 'wishlist',
      tags: [],
      include: true,
    }));
}

/** RFC 4180 quoting, including commas and line breaks inside quoted fields. */
export function parseCsv(text: string): CsvTable {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field.trim());
      field = '';
    } else if (char === '\n') {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') field += char;
  }
  if (quoted) throw new Error('The CSV ends inside a quoted field.');
  if (field || row.length) {
    row.push(field.trim());
    rows.push(row);
  }
  const nonEmpty = rows.filter((cells) => cells.some(Boolean));
  const headers = nonEmpty.shift() ?? [];
  if (!headers.length) throw new Error('The CSV has no header row.');
  return { headers, rows: nonEmpty };
}

export function suggestCsvMapping(headers: string[]): CsvMapping {
  const mapping: CsvMapping = {};
  headers.forEach((header, index) => {
    const key = header
      .normalize('NFKC')
      .toLocaleLowerCase('en-US')
      .replace(/[^a-z]+/g, '');
    if (mapping.title === undefined && /^(title|booktitle|name)$/.test(key)) mapping.title = index;
    else if (mapping.author === undefined && /^(author|authors|creator|writer)$/.test(key))
      mapping.author = index;
    else if (mapping.status === undefined && /^(status|shelf|readingstatus)$/.test(key))
      mapping.status = index;
    else if (mapping.format === undefined && /^(format|type|medium)$/.test(key))
      mapping.format = index;
    else if (mapping.progress === undefined && /^(progress|pages|chapters|position)$/.test(key))
      mapping.progress = index;
    else if (mapping.rating === undefined && /^(rating|score)$/.test(key)) mapping.rating = index;
    else if (mapping.tags === undefined && /^(tags|tag|labels)$/.test(key)) mapping.tags = index;
  });
  return mapping;
}

const valueAt = (row: string[], index: number | undefined) =>
  index === undefined ? '' : (row[index] ?? '').trim();

function parseStatus(value: string): ReadingStatus {
  const key = value.toLocaleLowerCase('en-US').replace(/[\s-]+/g, '_');
  if (['wishlist', 'want_to_read', 'planned', 'plan_to_read'].includes(key)) return 'wishlist';
  if (['reading', 'current', 'currently_reading'].includes(key)) return 'reading';
  // A bare CSV status cannot establish the ongoing/hiatus publication state
  // required by Caught up. Keep it as Reading until a catalogue match proves
  // that invariant; the confirmation screen shows the result before saving.
  if (['caught_up', 'caughtup'].includes(key)) return 'reading';
  if (['finished', 'complete', 'completed', 'read'].includes(key)) return 'finished';
  if (['dropped', 'abandoned', 'did_not_finish'].includes(key)) return 'dropped';
  return 'wishlist';
}

function parseFormat(value: string): Format {
  const key = value.toLocaleLowerCase('en-US');
  if (key.includes('manhwa') || key.includes('manga') || key.includes('comic')) return 'manhwa';
  if (key.includes('novel') || key.includes('serial')) return 'novel';
  return 'book';
}

function parseProgress(value: string): { current?: number; total?: number } {
  if (!value.trim()) return {};
  const parts = value.split('/').map((part) => Number(part.trim()));
  const current = parts[0];
  const total = parts[1];
  return {
    ...(Number.isFinite(current) && current! >= 0 ? { current: Math.floor(current!) } : {}),
    ...(Number.isFinite(total) && total! > 0 ? { total: Math.floor(total!) } : {}),
  };
}

export function csvDrafts(table: CsvTable, mapping: CsvMapping): ImportDraft[] {
  if (mapping.title === undefined) throw new Error('Choose the column that contains titles.');
  return table.rows.map((row, sourceIndex) => {
    const title = valueAt(row, mapping.title);
    const progress = parseProgress(valueAt(row, mapping.progress));
    const ratingValue = Number(valueAt(row, mapping.rating));
    const tags = valueAt(row, mapping.tags)
      .split(/[,;|]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
    return {
      sourceIndex,
      title,
      author: valueAt(row, mapping.author) || undefined,
      format: parseFormat(valueAt(row, mapping.format)),
      status: parseStatus(valueAt(row, mapping.status)),
      progressCurrent: progress.current,
      progressTotal: progress.total,
      rating:
        Number.isFinite(ratingValue) && ratingValue >= 1 && ratingValue <= 5
          ? ratingValue
          : undefined,
      tags,
      include: !!title,
    };
  });
}

export function applyCatalogueMatch(
  draft: ImportDraft,
  match: CorpusMatch | undefined,
): ImportDraft {
  if (!match) return { ...draft, match: undefined };
  return {
    ...draft,
    title: match.title,
    author: match.authors[0] ?? draft.author,
    format: match.formatHint ?? draft.format,
    match,
  };
}

export async function commitImport(drafts: ImportDraft[]): Promise<number> {
  const selected = drafts.filter((draft) => draft.include && draft.title.trim());
  if (!selected.length) throw new Error('Choose at least one title to import.');
  const seen = new Set<string>();
  const inputs: NewWorkInput[] = [];
  for (const draft of selected) {
    const key = draft.match?.corpusId
      ? `corpus:${draft.match.corpusId}`
      : `manual:${draft.title.normalize('NFKC').toLocaleLowerCase('en-US')}:${draft.author?.normalize('NFKC').toLocaleLowerCase('en-US') ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    inputs.push({
      title: draft.title,
      authorName: draft.author,
      format: draft.format,
      status: draft.status,
      progressCurrent: draft.progressCurrent,
      progressTotal: draft.progressTotal,
      rating: draft.rating,
      tagNames: draft.tags,
      corpusId: draft.match?.corpusId,
      publicationStatus: draft.match?.publicationStatus,
      coverRemoteUrl: undefined,
    });
  }
  const works = await createWorks(inputs);
  return works.length;
}
