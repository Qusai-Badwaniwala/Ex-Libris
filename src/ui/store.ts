import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useState } from 'react';
import { db, loadSettings, saveSettings } from '../db/db';
import * as repo from '../db/repo';
import type { NoteContext } from '../db/repo';
import { GENRES, isWarningOnly } from '../data/taxonomy';
import type { Author, Format, GenreIndex, Note, Settings, Tag, Work } from '../db/schema';
import { createSpineWidthProfile, type SpineWidthProfile } from '../spine/layout';

export const APP_VERSION = '0.1.0';
const PRIMARY_SEARCH_LIMIT = 20;
const SECONDARY_SEARCH_LIMIT = 10;

/**
 * Live reads.
 *
 * Everything a screen shows comes from `useLiveQuery`, which re-runs on any
 * write to the tables it touched. That is not a convenience — it is the fix for
 * the defect the design session hit twice (D-083): a delete that only navigated
 * away, so the work was still on the shelf when you got back, and a Continue
 * card that kept showing a work the shelf had correctly dropped. With one live
 * source there is no second copy to go stale.
 */

/** A work plus the author name a screen needs. Resolved here so no component
 *  has to know that authors are a separate table. */
export interface WorkWithAuthor {
  work: Work;
  authorName: string | undefined;
}

export interface LibrarySearchResults {
  works: WorkWithAuthor[];
  wishlist: WorkWithAuthor[];
  notes: NoteContext[];
  genres: { index: GenreIndex; name: string; count: number }[];
  tags: Tag[];
}

function attach(works: Work[], authors: Author[]): WorkWithAuthor[] {
  const byId = new Map(authors.map((a) => [a.id, a.name]));
  return works.map((work) => ({
    work,
    authorName:
      work.authorIds
        .map((id) => byId.get(id))
        .filter(Boolean)
        .join(', ') || undefined,
  }));
}

export function useLibrary(): WorkWithAuthor[] | undefined {
  return useLiveQuery(async () => attach(await repo.listLibrary(), await db.author.toArray()), []);
}

export function useShelf(format: Format): WorkWithAuthor[] | undefined {
  return useLiveQuery(
    async () => attach(await repo.listByFormat(format), await db.author.toArray()),
    [format],
  );
}

export function useContinuing(): WorkWithAuthor[] | undefined {
  return useLiveQuery(
    async () => attach(await repo.listContinuing(), await db.author.toArray()),
    [],
  );
}

export function useWork(id: string | undefined): WorkWithAuthor | undefined | null {
  return useLiveQuery(async () => {
    if (!id) return null;
    const work = await db.work.get(id);
    if (!work) return null;
    return attach([work], await db.author.toArray())[0] ?? null;
  }, [id]);
}

export function useWishlist(): WorkWithAuthor[] | undefined {
  return useLiveQuery(async () => attach(await repo.listWishlist(), await db.author.toArray()), []);
}

export function useTrash(): WorkWithAuthor[] | undefined {
  return useLiveQuery(async () => attach(await repo.listTrash(), await db.author.toArray()), []);
}

export function useNotes(): NoteContext[] | undefined {
  return useLiveQuery(() => repo.listNoteContexts(), []);
}

export function useNote(id: string | undefined): NoteContext | undefined | null {
  return useLiveQuery(async () => (id ? ((await repo.getNoteContext(id)) ?? null) : null), [id]);
}

export function useNotesForWork(workId: string): NoteContext[] | undefined {
  return useLiveQuery(() => repo.listNotesForWork(workId), [workId]);
}

export function useDeletedNotes(): Note[] | undefined {
  return useLiveQuery(() => repo.listDeletedNotes(), []);
}

export function useAvailableTags(): Tag[] | undefined {
  return useLiveQuery(() => db.tag.orderBy('usageCount').reverse().toArray(), []);
}

const foldSearch = (value: string) => value.normalize('NFKC').toLocaleLowerCase('en-US');

/**
 * Search is deliberately local-library-only (D-055). It includes tag and
 * genre names attached to a work, because “search my tags” should find the
 * books carrying that tag rather than only repeat the tag's name back.
 */
export function useLibrarySearch(query: string): LibrarySearchResults | undefined {
  return useLiveQuery(async () => {
    const needle = foldSearch(query.trim());
    if (!needle) return { works: [], wishlist: [], notes: [], genres: [], tags: [] };

    const [allWorks, authors, allTags, noteContexts, searchSettings] = await Promise.all([
      db.work.filter((work) => !work.deletedAt).toArray(),
      db.author.toArray(),
      db.tag.toArray(),
      repo.listNoteContexts(),
      db.settings.get('singleton'),
    ]);
    const tags = allTags.filter(
      (tag) => searchSettings?.contentWarningsOn || !isWarningOnly(tag.name),
    );
    const authorById = new Map(authors.map((author) => [author.id, author.name]));
    const tagById = new Map(tags.map((tag) => [tag.id, tag.name]));

    const scored = allWorks
      .map((work) => {
        const title = foldSearch(work.title);
        const author = work.authorIds.map((id) => authorById.get(id) ?? '').join(' ');
        const workTags = work.tagIds.map((id) => tagById.get(id) ?? '').join(' ');
        const genreNames = work.genres.map((index) => GENRES[index]?.name ?? '').join(' ');
        const searchable = foldSearch(`${author} ${workTags} ${genreNames}`);
        const score = title.startsWith(needle)
          ? 0
          : title.includes(needle)
            ? 1
            : searchable.includes(needle)
              ? 2
              : -1;
        return { work, score };
      })
      .filter((row) => row.score >= 0)
      .sort(
        (a, b) =>
          a.score - b.score ||
          a.work.sortTitle.localeCompare(b.work.sortTitle, undefined, { numeric: true }),
      );
    const attached = attach(
      scored.map((row) => row.work),
      authors,
    );

    const matchingNotes = noteContexts
      .filter(({ note, tags: noteTags, works: linkedWorks }) => {
        const tagNames = noteTags
          .filter((tag) => tagById.has(tag.id))
          .map((tag) => tag.name)
          .join(' ');
        const workTitles = linkedWorks.map((work) => work.title).join(' ');
        return foldSearch(`${note.title ?? ''} ${note.body} ${tagNames} ${workTitles}`).includes(
          needle,
        );
      })
      .sort(
        (a, b) =>
          Number(b.note.pinned) - Number(a.note.pinned) ||
          b.note.updatedAt.localeCompare(a.note.updatedAt),
      )
      .slice(0, SECONDARY_SEARCH_LIMIT)
      .map((context) => ({
        ...context,
        tags: context.tags.filter((tag) => tagById.has(tag.id)),
      }));
    const matchingTags = tags
      .filter((tag) => foldSearch(tag.name).includes(needle))
      .sort((a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name))
      .slice(0, PRIMARY_SEARCH_LIMIT);
    const matchingGenres = GENRES.filter((genre) => foldSearch(genre.name).includes(needle)).map(
      (genre) => ({
        index: genre.colorIndex,
        name: genre.name,
        count: allWorks.filter(
          (work) => work.status !== 'wishlist' && work.genres.includes(genre.colorIndex),
        ).length,
      }),
    );

    return {
      works: attached
        .filter((row) => row.work.status !== 'wishlist')
        .slice(0, PRIMARY_SEARCH_LIMIT),
      wishlist: attached
        .filter((row) => row.work.status === 'wishlist')
        .slice(0, SECONDARY_SEARCH_LIMIT),
      notes: matchingNotes,
      genres: matchingGenres,
      tags: matchingTags,
    };
  }, [query]);
}

export function useShelfCounts(): Record<Format, number> | undefined {
  return useLiveQuery(() => repo.countsByFormat(), []);
}

export function useSpineWidthProfile(): SpineWidthProfile | undefined {
  const state = useLiveQuery(
    () =>
      db.transaction('r', db.work, db.settings, async () => {
        const [works, settings] = await Promise.all([
          repo.listLibrary(),
          db.settings.get('singleton'),
        ]);
        const cached = settings?.spineWidthProfile;
        const profile = createSpineWidthProfile(works, cached);
        return { profile, needsSave: profile !== cached };
      }),
    [],
  );

  useEffect(() => {
    if (!state?.needsSave) return;
    // This is a derived cache, not a user write. If persistence is unavailable
    // the in-memory profile remains truthful for this render and will simply be
    // derived again on the next open.
    void saveSettings({ spineWidthProfile: state.profile }).catch(() => {});
  }, [state]);

  return state?.profile;
}

export function useLibraryStats(): repo.LibraryStats | undefined {
  return useLiveQuery(() => repo.libraryStats(), []);
}

export function useTagNames(ids: string[]): string[] | undefined {
  return useLiveQuery(async () => {
    if (ids.length === 0) return [];
    const rows = await db.tag.bulkGet(ids);
    return rows.filter((t) => !!t).map((t) => t!.name);
  }, [ids.join(',')]);
}

/**
 * Home's three figures. They are the only counts on that screen and they must
 * be honest: the library total EXCLUDES the wishlist (SCHEMA §9.4 — never
 * inflate by counting things you do not own), and the year is the local
 * calendar year, not the UTC one.
 */
export function useHomeFigures():
  { finishedThisYear: number; readingNow: number; libraryTotal: number } | undefined {
  return useLiveQuery(async () => {
    const { localYear } = await import('../db/dates');
    const rows = await repo.listLibrary();
    const thisYear = new Date().getFullYear();
    return {
      finishedThisYear: rows.filter((w) => w.dateFinished && localYear(w.dateFinished) === thisYear)
        .length,
      readingNow: rows.filter((w) => w.status === 'reading' || w.status === 'caught_up').length,
      libraryTotal: rows.length,
    };
  }, []);
}

/* ── settings ───────────────────────────────────────────────────────────── */

/**
 * Settings are read once and then kept in React state rather than through a
 * live query, because the theme is applied to the document element and a live
 * query would fight a local optimistic update on every toggle.
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void loadSettings(APP_VERSION)
      .then((s) => {
        if (!cancelled) setSettings(s);
      })
      .catch(() => {
        if (!cancelled) setLoadError('Settings could not be opened on this device.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(
    async (patch: Partial<Settings>) => {
      if (!settings) return false;
      const before = settings;
      setSettings({ ...settings, ...patch });
      try {
        await saveSettings(patch);
        return true;
      } catch {
        setSettings(before);
        return false;
      }
    },
    [settings],
  );

  return { settings, update, loadError };
}
