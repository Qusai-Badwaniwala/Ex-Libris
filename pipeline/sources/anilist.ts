import {
  JsonlWriter,
  cachePath,
  fetchRetry,
  readCheckpoint,
  sleep,
  writeCheckpoint,
  n,
} from '../lib.ts';
import { anilistFormat, anilistStatus, normalizeTitle, stableId } from '../normalize.ts';
import type { CorpusWork, StageReport } from '../types.ts';

/**
 * AniList. The best free source for manhwa, manhua and light novels, and the
 * one that matters most for this library.
 *
 * It is also the source most likely to mislead, and the pipeline has to be
 * careful about it in exactly one way. `type: MANGA` covers comics AND light
 * novels, and for Chinese and Korean WEB NOVELS it very often holds only the
 * comic adaptation — under the novel's name, with the comic's chapter count and
 * publication status. Verified live on 2026-09-03:
 *
 *   Reverend Insanity     -> MANGA/CN, 96 chapters, CANCELLED  (novel: 2,334)
 *   Lord of the Mysteries -> MANGA/CN, 65 chapters, FINISHED   (novel: 1,432)
 *   Shadow Slave          -> no match at all
 *
 * So `format_hint` records what the row ACTUALLY is, and the add flow shows it.
 * A 96-chapter manhua offered silently as "Reverend Insanity" would give the
 * reader a chapter count wrong by a factor of twenty-four.
 *
 * No API key. Rate limited; the limit is announced in the response headers and
 * this respects it rather than guessing.
 */

const ENDPOINT = 'https://graphql.anilist.co';

const QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage currentPage }
    media(type: MANGA, sort: POPULARITY_DESC) {
      id
      title { romaji english native }
      synonyms
      format
      countryOfOrigin
      status
      chapters
      volumes
      genres
      popularity
      startDate { year }
      coverImage { large }
      staff(perPage: 4, sort: RELEVANCE) {
        edges { role node { name { full } } }
      }
      relations {
        edges { relationType node { id type format title { romaji } } }
      }
    }
  }
}`;

interface AniMedia {
  id: number;
  title: { romaji: string | null; english: string | null; native: string | null };
  synonyms: string[];
  format: string | null;
  countryOfOrigin: string | null;
  status: string | null;
  chapters: number | null;
  volumes: number | null;
  genres: string[];
  popularity: number | null;
  startDate: { year: number | null } | null;
  coverImage: { large: string | null } | null;
  staff: { edges: { role: string | null; node: { name: { full: string | null } } }[] } | null;
  relations: {
    edges: {
      relationType: string;
      node: { id: number; type: string; format: string | null; title: { romaji: string | null } };
    }[];
  } | null;
}

/** A relation worth keeping: these are the ones that imply a series or a
 *  universe. ADAPTATION deliberately is not — a manhua of a novel is a
 *  different work, not the next entry in a set. */
const SERIES_RELATIONS = new Set(['PREQUEL', 'SEQUEL', 'PARENT', 'SIDE_STORY', 'ALTERNATIVE']);

export interface AniRelation {
  from: number;
  to: number;
  type: string;
}

export async function runAnilist(maxPages: number): Promise<StageReport> {
  const started = Date.now();
  const stage = 'anilist';
  const cp = readCheckpoint(stage);
  const notes: string[] = [];

  const worksPath = cachePath(stage, 'works.jsonl');
  const relsPath = cachePath(stage, 'relations.jsonl');

  if (cp.done && (cp.counts?.pages ?? 0) >= maxPages) {
    return {
      stage,
      ok: true,
      counts: cp.counts ?? {},
      notes: ['already complete for this page budget; delete pipeline/.cache/anilist to redo'],
      seconds: 0,
    };
  }

  const startPage = typeof cp.cursor === 'number' ? cp.cursor + 1 : 1;
  const append = startPage > 1;
  if (append) notes.push(`resumed at page ${startPage}`);

  const works = new JsonlWriter(worksPath, append);
  const rels = new JsonlWriter(relsPath, append);

  let page = startPage;
  let novels = 0;
  let comics = 0;
  let withChapters = 0;

  try {
    for (; page <= maxPages; page++) {
      const res = await fetchRetry(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ query: QUERY, variables: { page, perPage: 50 } }),
      });

      if (!res.ok) {
        notes.push(`stopped at page ${page}: HTTP ${res.status}`);
        break;
      }
      const json = (await res.json()) as {
        data?: { Page?: { pageInfo: { hasNextPage: boolean }; media: AniMedia[] } };
        errors?: { message: string }[];
      };
      if (json.errors?.length) {
        notes.push(`stopped at page ${page}: ${json.errors[0]?.message ?? 'graphql error'}`);
        break;
      }
      const pageData = json.data?.Page;
      if (!pageData) break;

      for (const m of pageData.media) {
        const row = toWork(m);
        if (!row) continue;
        works.write(row);
        if (row.format_hint === 'novel') novels++;
        else comics++;
        if (row.chapter_count !== null) withChapters++;

        for (const e of m.relations?.edges ?? []) {
          if (!SERIES_RELATIONS.has(e.relationType)) continue;
          if (e.node.type !== 'MANGA') continue;
          rels.write({ from: m.id, to: e.node.id, type: e.relationType } satisfies AniRelation);
        }
      }

      writeCheckpoint(stage, {
        done: false,
        cursor: page,
        counts: { pages: page, works: works.written, relations: rels.written },
      });

      if (!pageData.pageInfo.hasNextPage) {
        notes.push(`source exhausted at page ${page}`);
        break;
      }

      // AniList publishes its limit in the response headers. Waiting the
      // announced amount is the difference between a polite client and one
      // that gets blocked.
      const remaining = Number(res.headers.get('x-ratelimit-remaining'));
      await sleep(Number.isFinite(remaining) && remaining < 5 ? 60_000 : 700);
    }
  } finally {
    await works.close();
    await rels.close();
  }

  const counts = {
    pages: Math.min(page, maxPages),
    works: works.written,
    relations: rels.written,
    novels,
    comics,
    withChapterCount: withChapters,
  };
  writeCheckpoint(stage, { done: true, cursor: Math.min(page, maxPages), counts });

  notes.push(
    `${n(comics)} comics and ${n(novels)} light novels; ${n(withChapters)} carry a chapter count`,
  );
  notes.push(
    'AniList holds the COMIC for most Chinese and Korean web novels, not the novel — format_hint records which, and the add flow must show it',
  );

  return { stage, ok: true, counts, notes, seconds: (Date.now() - started) / 1000 };
}

function toWork(m: AniMedia): CorpusWork | null {
  const title = m.title.english || m.title.romaji || m.title.native;
  if (!title) return null;

  // Story credits only. An artist on a manhua is real, but for matching a title
  // the author is what a reader types.
  const authors = (m.staff?.edges ?? [])
    .filter((e) => /story/i.test(e.role ?? ''))
    .map((e) => e.node.name.full)
    .filter((x): x is string => !!x);

  const synonyms = [m.title.romaji, m.title.english, m.title.native, ...(m.synonyms ?? [])]
    .filter((s): s is string => !!s && s !== title)
    .filter((s, i, a) => a.indexOf(s) === i);

  return {
    id: stableId('anilist', String(m.id)),
    title,
    title_normalized: normalizeTitle(title),
    synonyms: synonyms.join('\n'),
    authors: authors.join(', '),
    format_hint: anilistFormat(m.format, m.countryOfOrigin),
    series_id: null,
    series_position: null,
    universe_id: null,
    cover_id: m.coverImage?.large ?? null,
    cover_source: m.coverImage?.large ? 'anilist' : null,
    publication_status: anilistStatus(m.status),
    chapter_count: m.chapters ?? null,
    volume_count: m.volumes ?? null,
    year: m.startDate?.year ?? null,
    // AniList popularity is an unbounded member count. Compressed with a log so
    // one runaway hit does not flatten the rest of the ranking to zero.
    popularity: m.popularity ? Math.min(100, Math.round(Math.log10(m.popularity + 1) * 20)) : 0,
    external_ids: JSON.stringify({
      anilist: m.id,
      ...(m.countryOfOrigin ? { country: m.countryOfOrigin } : {}),
      ...(m.genres?.length ? { genres: m.genres } : {}),
    }),
    source: 'anilist',
  };
}
