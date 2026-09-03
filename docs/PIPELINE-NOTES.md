# PIPELINE-NOTES.md

The corpus pipeline is re-run roughly monthly by someone who will not remember
how it works. That someone is the reason this file exists.

```
npm run pipeline                    # everything except the 16 GB download
npm run pipeline -- anilist --pages 40
npm run pipeline -- acquire         # asks for the Open Library dumps by name
npm run pipeline -- merge build
```

Every stage is **resumable and idempotent**. Rerunning a finished stage is a
no-op; rerunning an interrupted one picks up from `pipeline/.cache/<stage>/checkpoint.json`.
To force a stage to redo its work, delete its cache directory.

`acquire` is deliberately **not** part of `all`. A 16 GB download is not
something a command called "all" should start without being asked.

---

## What each stage does, and what it costs

| #   | stage         | source             | cost                     | run on 2026-09-03                 |
| --- | ------------- | ------------------ | ------------------------ | --------------------------------- |
| 1   | `acquire`     | Open Library dumps | 16.2 GB, hours           | **not run** — sizes verified only |
| 2   | `openlibrary` | works dump         | streams 3.78 GB          | **not run** — needs stage 1       |
| 3   | `wikidata`    | SPARQL, paged      | ~1 s/page, tens of pages | **not run** — see below           |
| 4   | `anilist`     | GraphQL, paged     | 700 ms/page              | 40 pages, 128 s                   |
| 5   | `mangadex`    | REST, paged        | 300 ms/page              | 20 pages, 32 s                    |
| 6·7 | `merge`       | local              | seconds                  | yes                               |
| 8·9 | `build`       | local              | seconds                  | yes                               |

---

## Measured, 2026-09-03

Everything below is a number this machine produced, not an estimate.

### Source sizes, checked against the live servers

```
ol_dump_works_latest.txt.gz       3.78 GB
ol_dump_editions_latest.txt.gz   11.72 GB
ol_dump_authors_latest.txt.gz     0.73 GB
```

### A real end-to-end run (bounded sample)

```
anilist     40 pages   2,000 works   1,286 relations   53 novels   1,947 comics
mangadex    20 pages   2,000 works   1,043 with a last-chapter number
merge       4,000 read → 3,722 out   (38 on title+author, 240 on title across sources)
            16 same-title groups left alone as genuinely different works
            72 series covering 177 works
build       3,722 works → corpus.sqlite 4.6 MB
```

### The two numbers that decide the shape of the thing

**Size: 1,275 bytes per work.** At 500,000 works that projects to about
**608 MB** — three to six times the brief's 100–200 MB guess. The sample is all
comics, which carry up to twelve alternate titles each; Open Library rows will
be leaner, so treat this as an upper bound until stage 2 has run. Either way the
ceiling needs re-deciding against a measurement rather than a guess.

**Typeahead: 0.15–0.55 ms** for a three-character prefix query against the built
file, measured with `node:sqlite`. The budget is 50 ms. FTS5 prefix indexes
scale close to logarithmically, so headroom at 500k is large — but the app runs
this through wa-sqlite over OPFS in a worker, which is a different engine on a
different storage layer, and Phase 3 has to measure it there before the budget
can be called met.

### Wikidata join rate — not yet measured

The brief calls this the single best predictor of whether series detection feels
good, and it is still unknown, because the stage needs the Open Library ids to
join against and stage 2 has not run. The stage is written and reports the rate;
it just has nothing to join to yet.

---

## What is known to be wrong or missing

**AniList holds the comic, not the novel, for Chinese and Korean web fiction.**
The most consequential finding in the phase. Verified live:

| searched              | what AniList returns         | what it actually is           |
| --------------------- | ---------------------------- | ----------------------------- |
| Reverend Insanity     | MANGA / CN, 96 ch, CANCELLED | the manhua. Novel is 2,334 ch |
| Lord of the Mysteries | MANGA / CN, 65 ch, FINISHED  | the manhua. Novel is 1,432 ch |
| Omniscient Reader     | MANGA / KR, RELEASING        | the manhwa                    |
| Shadow Slave          | nothing                      | absent entirely               |
| Kill the Sun          | nothing                      | absent entirely               |

There is no novel entry for any of them. So `format_hint` records what the row
**is**, and the add flow must show it — a 96-chapter manhua offered silently
under the name "Reverend Insanity" hands the reader a chapter count wrong by a
factor of twenty-four. This is a correctness requirement on Phase 3's add
screen, not a nicety.

**Only 53 of the top 2,000 AniList entries are light novels.** `type: MANGA`
sorted by popularity is overwhelmingly manga. Reaching light novels in quantity
needs `format: NOVEL` as a separate paged query.

**Open Library author names are not resolved.** Stage 2 writes author _keys_
into `external_ids.authorKeys`; turning them into names needs the authors dump
joined in. The keys are written now so that join never has to re-stream 3.8 GB.

**`edition_count >= 2` is not in the works dump.** The brief's filter predicate
includes it, but it can only be computed by streaming the 11.7 GB editions dump
and counting. Deferred until the simpler filter's output count is known.

**Universes are empty.** Only Wikidata states that several series share a
continuity. Deriving them from AniList relation clusters would put confident
wrong groupings in front of the reader, which is the exact thing the series
cascade is written to avoid.

**`total_entries` is always NULL.** What the corpus knows about a series is not
the same as what exists. A count from a relation cluster would be a wrong
denominator under a completion ring, which SCHEMA forbids outright.

---

## The web-novel source research

Timeboxed task from the brief, done on 2026-09-03. **Conclusion: no
permissively-licensed dataset covers pure web novels, and both candidate sites
actively block automated access.**

| candidate                                                             | what it is                                                                                                                                                                                                                            | why it is not usable                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [shaido987/novel-dataset](https://github.com/shaido987/novel-dataset) | 24,639 NovelUpdates novels, CSV + JSON, committed to the repo, updated Aug 2025                                                                                                                                                       | **No LICENSE file.** No licence means all rights reserved by default. This is the closest thing that exists and it is one file away from being usable.                                                                                                                                                                     |
| [NovelUpdates](https://www.novelupdates.com/)                         | the canonical index                                                                                                                                                                                                                   | No public API. `robots.txt` itself returns **403** to an automated request — the site is behind bot protection, and getting past it means evading that.                                                                                                                                                                    |
| [Royal Road](https://www.royalroad.com/)                              | the other major host                                                                                                                                                                                                                  | No official API; [the request has been open for years](https://www.royalroad.com/ideas/482). Also **403** to automated requests. Several unofficial scrapers exist ([fs-c/royalroad-api](https://github.com/fs-c/royalroad-api), [EL-S/RoyalRoadAPI](https://github.com/EL-S/RoyalRoadAPI)) and all work by scraping HTML. |
| Hugging Face                                                          | [LightNovel5000](https://huggingface.co/datasets/bh2821/LightNovel5000), [alpindale/light-novels](https://huggingface.co/datasets/alpindale/light-novels), [WebNovels-Ja](https://huggingface.co/datasets/OmniAICreator/WebNovels-Ja) | Text corpora for model training, not metadata catalogues. WebNovels-Ja deliberately **conceals the source novel and author**, which is precisely the field we need. Licences are training-oriented (`creativeml-openrail-m`).                                                                                              |
| Google Books, Open Library                                            | —                                                                                                                                                                                                                                     | Cover published books only. A web serial has no ISBN and no edition.                                                                                                                                                                                                                                                       |

The brief says not to scrape a site whose terms forbid it, and a 403 on
`robots.txt` is that answer given in advance. So this is reported rather than
worked around.

**Options for the owner, in the order I would take them:**

1. **Ask for a licence.** `shaido987/novel-dataset` is one `LICENSE` file away
   from solving this outright. Opening an issue costs nothing and might work.
2. **Paste-a-list, brought forward from Phase 8.** The reader's own web novels
   are a bounded set — tens of titles, not thousands. Pasting them and
   confirming a screen of matches is one evening, and it is the same import path
   Phase 8 builds anyway.
3. **Per-title lookup at add time,** which is a completely different posture
   from bulk scraping: user-initiated, one request, no crawl. Still blocked by
   the 403s today, but it is the shape to revisit if either site ever ships an
   API.

Not recommended: substituting AniList's comic adaptation for the novel. That is
what the corpus would do by default, and it is the reason `format_hint` exists.

---

## Gotchas

- **`node:sqlite`, not better-sqlite3.** Node 24 ships SQLite 3.50 with FTS5,
  `unicode61 remove_diacritics 2` and prefix indexes — every option SCHEMA §10
  names — so there is no native module to build on Windows. It is flagged
  experimental, which is why `build.ts` is imported lazily and why nothing at
  runtime depends on it: the app reads the finished file through wa-sqlite.
- **The pipeline runs under plain `node`,** which strips TypeScript but demands
  real file extensions. That is why every import inside `pipeline/` ends in
  `.ts`, and why `allowImportingTsExtensions` is set.
- **`title_normalized` comes from the app's own `sortTitleOf`.** The pipeline
  imports `src/db/keys.ts` rather than reimplementing it. Two copies would drift
  and search would quietly stop matching.
- **JSONL between stages, never JSON.** A 600,000-row array has to be complete
  before it parses, so a crash costs the whole stage. A torn last line costs one
  row.
- **`public/corpus/` and `pipeline/.cache/` are gitignored.** The corpus is
  built, not committed.
