import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useState } from 'react';
import { db, loadSettings, saveSettings } from '../db/db';
import * as repo from '../db/repo';
import type { Author, Format, Settings, Work } from '../db/schema';

export const APP_VERSION = '0.1.0';

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

export function useTrash(): WorkWithAuthor[] | undefined {
  return useLiveQuery(async () => attach(await repo.listTrash(), await db.author.toArray()), []);
}

export function useShelfCounts(): Record<Format, number> | undefined {
  return useLiveQuery(() => repo.countsByFormat(), []);
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

  useEffect(() => {
    let cancelled = false;
    void loadSettings(APP_VERSION).then((s) => {
      if (!cancelled) setSettings(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(async (patch: Partial<Settings>) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
    await saveSettings(patch);
  }, []);

  return { settings, update };
}
