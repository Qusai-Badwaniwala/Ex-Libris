import {
  JsonlWriter,
  cachePath,
  fetchRetry,
  readCheckpoint,
  sleep,
  writeCheckpoint,
  n,
} from '../lib.ts';
import { mangadexStatus, normalizeTitle, stableId } from '../normalize.ts';
import type { CorpusWork, StageReport } from '../types.ts';

/**
 * MangaDex. Manhwa and manhua specifically, where AniList is thin.
 *
 * Free, no key, and it publishes its own rate limit (5 requests/second global).
 * The one thing it is better at than AniList is `lastChapter` on long-running
 * Korean series, which is the number the reader's progress bar is measured
 * against — so it is worth the second pass even where the two overlap.
 *
 * Deliberately NOT taken from here: chapter lists, page images, or anything
 * that would make this a reader. This pulls series metadata and nothing else.
 */

const ENDPOINT = 'https://api.mangadex.org/manga';

interface MdManga {
  id: string;
  attributes: {
    title: Record<string, string>;
    altTitles: Record<string, string>[];
    description: Record<string, string>;
    originalLanguage: string | null;
    lastChapter: string | null;
    lastVolume: string | null;
    status: string | null;
    year: number | null;
    tags: { attributes: { name: Record<string, string>; group: string } }[];
  };
  relationships: { type: string; attributes?: { name?: string; fileName?: string } }[];
}

/** Korean and Chinese first: that is where MangaDex adds something AniList
 *  does not already have. Japanese manga is well covered on both. */
const LANGUAGES = ['ko', 'zh', 'zh-hk'];

export async function runMangadex(maxPages: number): Promise<StageReport> {
  const started = Date.now();
  const stage = 'mangadex';
  const cp = readCheckpoint(stage);
  const notes: string[] = [];

  if (cp.done && (cp.counts?.pages ?? 0) >= maxPages) {
    return {
      stage,
      ok: true,
      counts: cp.counts ?? {},
      notes: ['already complete for this page budget; delete pipeline/.cache/mangadex to redo'],
      seconds: 0,
    };
  }

  const startPage = typeof cp.cursor === 'number' ? cp.cursor + 1 : 0;
  const append = startPage > 0;
  if (append) notes.push(`resumed at offset page ${startPage}`);

  const works = new JsonlWriter(cachePath(stage, 'works.jsonl'), append);
  const LIMIT = 100;
  let page = startPage;
  let withLastChapter = 0;

  try {
    for (; page < maxPages; page++) {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(page * LIMIT),
        'order[followedCount]': 'desc',
        includes: 'cover_art',
        includes2: 'author',
      });
      for (const l of LANGUAGES) params.append('originalLanguage[]', l);
      // `includes` repeats rather than taking a list.
      const url = `${ENDPOINT}?${params.toString().replace('includes2=author', 'includes[]=author')}&includes[]=cover_art`;

      const res = await fetchRetry(url, { headers: { accept: 'application/json' } });
      if (!res.ok) {
        notes.push(`stopped at page ${page}: HTTP ${res.status}`);
        break;
      }
      const json = (await res.json()) as { data?: MdManga[]; total?: number };
      const data = json.data ?? [];
      if (data.length === 0) {
        notes.push(`source exhausted at page ${page}`);
        break;
      }

      for (const m of data) {
        const row = toWork(m);
        if (!row) continue;
        works.write(row);
        if (row.chapter_count !== null) withLastChapter++;
      }

      writeCheckpoint(stage, {
        done: false,
        cursor: page,
        counts: { pages: page + 1, works: works.written },
      });
      // Their published ceiling is five a second; one every 300ms sits well
      // under it and there is nothing to gain by crowding it.
      await sleep(300);
    }
  } finally {
    await works.close();
  }

  const counts = { pages: page - startPage, works: works.written, withLastChapter };
  writeCheckpoint(stage, { done: true, cursor: page, counts });
  notes.push(`${n(withLastChapter)} of ${n(works.written)} carry a last-chapter number`);

  return { stage, ok: true, counts, notes, seconds: (Date.now() - started) / 1000 };
}

function toWork(m: MdManga): CorpusWork | null {
  const a = m.attributes;
  const title = a.title['en'] || a.title['ja-ro'] || Object.values(a.title)[0];
  if (!title) return null;

  const alts = a.altTitles
    .flatMap((t) => Object.values(t))
    .filter((s) => s && s !== title)
    .filter((s, i, arr) => arr.indexOf(s) === i)
    .slice(0, 12);

  const authors = m.relationships
    .filter((r) => r.type === 'author' || r.type === 'artist')
    .map((r) => r.attributes?.name)
    .filter((x): x is string => !!x)
    .filter((x, i, arr) => arr.indexOf(x) === i);

  const cover = m.relationships.find((r) => r.type === 'cover_art')?.attributes?.fileName ?? null;

  // lastChapter is a string and is sometimes a decimal ("142.5") or empty.
  // Number('') is 0, which would claim a zero-chapter series, so the emptiness
  // is checked before the parse rather than after it.
  const lastRaw = (a.lastChapter ?? '').trim();
  const last = lastRaw === '' ? null : Number(lastRaw);
  const chapters = last !== null && Number.isFinite(last) && last > 0 ? Math.floor(last) : null;

  const volRaw = (a.lastVolume ?? '').trim();
  const vol = volRaw === '' ? null : Number(volRaw);

  return {
    id: stableId('mangadex', m.id),
    title,
    title_normalized: normalizeTitle(title),
    synonyms: alts.join('\n'),
    authors: authors.join(', '),
    // Everything pulled here is a comic, by construction of the query.
    format_hint: 'manhwa',
    series_id: null,
    series_position: null,
    universe_id: null,
    cover_id: cover ? `${m.id}/${cover}` : null,
    cover_source: cover ? 'mangadex' : null,
    publication_status: mangadexStatus(a.status),
    chapter_count: chapters,
    volume_count: vol !== null && Number.isFinite(vol) && vol > 0 ? Math.floor(vol) : null,
    year: a.year ?? null,
    popularity: 0,
    external_ids: JSON.stringify({
      mangadex: m.id,
      ...(a.originalLanguage ? { country: a.originalLanguage } : {}),
    }),
    source: 'mangadex',
  };
}
