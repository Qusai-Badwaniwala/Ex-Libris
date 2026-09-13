# PIPELINE-NOTES.md

The corpus pipeline is re-run roughly monthly by someone who will not remember
how it works. That someone is the reason this file exists.

```
npm run pipeline                    # licensed production stages, no acquisition
npm run pipeline -- acquire         # ONLY after explicit approval; works + authors
npm run pipeline -- wikidata --pages 100
npm run pipeline -- fixture-merge fixture-build # isolated local test fixture
```

Downloads, paged requests, and the author-key join are checkpointed. Rerunning
a finished source stage is a no-op; an interrupted one resumes its saved work
from `pipeline/.cache/<stage>/checkpoint.json`. The merge and SQLite build are
deliberately rebuilt from their completed inputs. If a source itself changes,
remove only that exact stage cache after inspecting and backing up its path.

`acquire` is deliberately **not** part of `all`. Its default transfer is the
4.84 GB works/authors pair; `--force` would add the unused 11.7 GB editions
dump. Neither starts without an explicit owner instruction.

---

## What each stage does, and what it costs

| #   | stage                 | source                    | cost                    | current state                       |
| --- | --------------------- | ------------------------- | ----------------------- | ----------------------------------- |
| 1   | `acquire`             | Open Library dumps        | 4.84 GB default         | complete; dated hashes match        |
| 2   | `wikidata`            | SPARQL, paged             | 8 pages                 | complete; 14,440 memberships        |
| 3   | `openlibrary`         | works dump                | streams 4.06 GB         | complete; 476,612 staged            |
| 4   | `openlibrary-authors` | authors dump + keyed rows | streams 0.78 GB + JSONL | complete; 476,547 resolved works    |
| 5   | `anilist`             | GraphQL, paged            | 700 ms/page             | fixture: 40 pages, 128 s            |
| 6   | `mangadex`            | REST, paged               | 300 ms/page             | fixture: 20 pages, 32 s             |
| 7   | `merge`               | licensed local inputs     | seconds                 | complete; 438,584 production works  |
| 7f  | `fixture-merge`       | restricted local fixture  | under 1 s               | isolated engineering fixture built  |
| 8   | `build`               | local                     | seconds                 | complete; 261.1 MiB production DB   |
| 8f  | `fixture-build`       | local                     | under 1 s               | isolated 4.6 MiB Playwright fixture |

---

## Measured, 2026-09-03

Everything below is a number this machine produced, not an estimate.

### Source sizes, checked against the live servers

```
ol_dump_works_latest.txt.gz       4.06 GB
ol_dump_editions_latest.txt.gz   11.72 GB
ol_dump_authors_latest.txt.gz     0.78 GB
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

### Wikidata join rate — not yet measured in the 2026-09-03 sample

At this historical checkpoint the stage had no Open Library ids to join. The
completed production result is recorded immediately below.

---

## Licensed production run — 2026-09-06

These numbers supersede the projections above for the production core. The old
sample measurements remain because they explain why the bounded filter and
physical-phone gate exist.

### Acquisition and source integrity

The approved works/authors-only download completed in 2,122.3 seconds. Editions
were never requested. Both dated 2026-08-31 files matched Archive.org's
published size and SHA-1 before parsing:

```text
works    4,058,336,593 bytes  c9362f345368cdc8bf64efcc05d6e4b590974cb6
authors    779,810,028 bytes  96de3a474e5aa1f7b893dbe51a7b31ef3e24f1bd
total    4,838,146,621 bytes
```

The Wikidata query is intentionally bounded to P179 work-to-series claims that
also state an Open Library P648 identifier. Those are the only rows the current
merge can join; a broad subclass traversal hit the public endpoint's 429 limit
without producing more usable links. The completed source exhausted after 8
pages: 14,440 memberships, 4,524 distinct series, 8,170 explicit ordinals, and
14,440 P648 identifiers.

### The measured compact-core predicate

A first full streaming pass using only title, author and positive cover kept
9,302,140 of 41,591,088 work rows and produced 5,434,168,408 bytes of JSONL.
That was fifteen times the target and was not built or shipped. Open Library's
work dump supplied no usable work-level language field in this pass, so the
filter does not pretend an `en` label proves English content.

The accepted bounded core requires title, author and a positive cover, then
keeps either:

- a record with at least four subjects and a standalone `fiction` subject,
  while explicitly rejecting `non-fiction`; or
- an explicit Wikidata series membership joinable through P648.

This is a measured catalogue boundary, not a claim that every retained work is
English or that every book worth reading is present. Broad Open Library remains
an optional future module; manual entry remains the fallback.

```text
Open Library source rows                     41,591,088
staged core works                               476,612
  fiction-qualified                            473,503
  Wikidata-series-qualified                      8,022
  qualified by both                              4,913
resolved works                                 476,547
wanted / resolved authors             171,119 / 171,108
unresolved works                                    65
partially resolved coauthor rows                     9
```

The production merge read 476,547 resolved rows and emitted 438,584 works. It
collapsed 37,963 title-plus-author matches, left 28,496 same-title groups apart
conservatively, created 2,185 Wikidata series, and linked 7,222 works. Another
352 works had multiple different series claims and stayed unassigned rather
than losing context behind a guessed single value. `universes` remains empty.

### Production artifact and runtime proof

```text
corpus.sqlite       273,784,832 bytes (261.1 MiB)
works               438,584
series              2,185
works with series   7,222
works with cover    438,584
missing authors     0
SHA-256             1d5c9eba8347481ab55db124378c15d1d6ac05264f7012160fc0954a0a7272c7
chunks              66 × up to 4 MiB
distribution        production
sources             openlibrary: 438,584
```

The production preview installed all 66 ranged chunks through the real
manifest/checksum/OPFS/worker path, displayed 438,584 works and 261.1 MiB, and
searched the installed database. Exact normalized-title ranking was added after
the raw BM25 probe put “Dunedin” above “Dune”; the app and the shared post-build
probe now both put Frank Herbert's **Dune** first. The same shared query also
puts exact **The Hobbit** rows before “The Hobbits”.

The final machine-side gate passes with 131 unit tests and 21 Pixel 7
Playwright journeys. The fixture worker and full UI latency checks remain
desktop regression evidence only. Q-028's physical Android result is the sole
remaining Phase 3 completion gate.

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

**Open Library author names require their own stage.** `openlibrary` writes
author keys into a keyed intermediate. `openlibrary-authors` retains only the
referenced names from the authors dump and writes the final author-searchable
input. Production merge refuses to run if that resolved file is absent.

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

## Source permission re-audit — 2026-09-04

Phase 2 proved that the extraction and merge machinery works. It did not prove
that every API result may be collected into a redistributable offline database.
That question was rechecked before Phase 3:

- **AniList cannot be a shipped bulk source.** Its current
  [API terms](https://anilist.gitbook.io/anilist-apiv2-docs/docs/guide/terms-of-use)
  prohibit hoarding or mass collection and restrict competing
  list/tracker-style services. The 3,722-work sample remains a local engineering
  fixture for the SQLite runtime and `format_hint` tests; it is not production
  catalogue data.
- **Open Library is the primary bulk lead.** It publishes monthly
  [data dumps](https://openlibrary.org/developers/dumps) for bulk use. Its
  [licensing page](https://openlibrary.org/developers/licensing) says the
  Internet Archive asserts no new rights over the database while warning that
  some contributions may carry existing rights in some jurisdictions. Keep
  provenance and attribution, ship metadata rather than covers, and preserve
  the modular small/optional split.
- **Wikidata is the clean enrichment source.** Its structured data is
  [CC0](https://www.wikidata.org/wiki/Help:Data_access). Use it for series,
  universe, identifiers, and relationships, with an honest User-Agent and
  conservative request rate. A large extraction should use a dump rather than
  treating the public SPARQL service as a bulk endpoint.
- **MangaDex is suitable only as a possible live connector under the published
  policy.** Its
  [acceptable-use policy](https://gitlab.com/mangadex-pub/mangadex-api-docs/-/blob/main/index.md)
  permits free API use for qualifying projects, requires MangaDex credit, and
  forbids ads or paid service. It does not expressly grant permission to package
  a bulk snapshot, so do not redistribute one. The proposed safe shape is a
  user-initiated online search with only the chosen work cached in the private
  library.
- **Project Gutenberg is legally usable but low-priority.** It explicitly
  provides [machine-readable catalogue metadata](https://www.gutenberg.org/ebooks/offline_catalogs.html)
  for databases and encourages libraries to incorporate its MARC records. It
  improves classic/public-domain coverage, not the modern web-novel gap.

This supersedes the assumption that AniList + MangaDex can form a downloadable
core. The owner approved the recommended replacement as E-046: a filtered Open
Library/Wikidata offline core, broad Open Library as optional, credited live
MangaDex lookup, and manual/paste entry for unsupported web novels.

---

## Owner-supplied source guide audit — 2026-09-05

`H:\Ex libris files\READING_TRACKER_DATA_SOURCES_GUIDE.md` was reviewed as a
research lead, not as an app brief (E-048). Its strongest additions were checked
against current first-party pages:

- **Inventaire is the most useful new bulk candidate.** Its bibliographic graph
  explicitly separates works, editions, authors, and series; its own entity data
  is CC0; and it publishes JSON/NDJSON/Turtle dumps. The current own-entity dump
  is about 270 MB compressed, far smaller than the complete Open Library input.
  It needs one extracted-record quality check and a measured output projection
  before it can amend E-046; it is not silently added to Phase 3.
- **Japan has two credible later enrichment layers.** NDL publishes selected
  bibliographic datasets as public domain, including a roughly 10 MB compressed
  recent-year Japanese-publications file and identifier lists, and exposes wider
  catalogue access under source-specific terms. CiNii Books exposes NACSIS-CAT
  records under CC BY 4.0 through an API that requires a registered application
  id; bulk datasets are application-based. These are promising for Japanese
  editions, light novels, and manga, but neither is a drop-in global core.
- **ISFDB is useful specialist data with attribution and provenance work.** Its
  site identifies the database as CC BY 4.0 and has publication-level pages,
  series, and speculative-fiction coverage. Images and occasional quoted or
  third-party text are not automatically covered, so a future importer must
  whitelist factual fields rather than mirror records wholesale.
- **Grand Comics Database is open but not licence-neutral.** Its database schema
  and data distribution are CC BY-SA 4.0, while covers remain copyrighted by
  their owners. ShareAlike can affect the licence of a combined distributed
  database, so GCD stays out of the core until that boundary is designed and
  reviewed deliberately.
- **The guide's server-side catalogue recommendation is rejected for this app.**
  Ex Libris has no account, cloud, telemetry, or server-owned user library. Its
  catalogue index remains an optional on-device download; only explicit live
  metadata lookups may touch the network.

Potential product ideas found in the guide are not Phase 3 work. The owner
approved edition-specific page counts for possible Phase 4 use when metadata
supports them, and multiple named reading orders plus a mid-series/start-point
warning for Phase 5 (E-055). Each visible implementation still needs its exact
design comparison at the relevant phase.

Official evidence retained for the next source decision:
[Inventaire entity data](https://wiki.inventaire.io/wiki/Entities_data),
[Inventaire dumps](https://dumps.inventaire.io/inv/latest/),
[NDL free data](https://www.ndl.go.jp/en/dlib/standards/opendataset),
[CiNii metadata/API](https://support.nii.ac.jp/en/cinii/api/api_outline),
[ISFDB policy](https://isfdb.org/wiki/index.php/ISFDB:Policy), and
[GCD licensing](https://www.comics.org/).

---

## Phase 3 runtime proof — 2026-09-05

The 3,722-work engineering fixture now exercises the real delivery path in a
production-optimized test build: HTTP byte ranges, per-chunk SHA-256, OPFS,
immutable wa-sqlite, FTS5, and worker messages. A fresh install requests exactly
two ranges for the 4,825,088-byte file. An interrupted second range resumes by
requesting only that second range. A network failure leaves manual entry usable.

Upstream wa-sqlite's default WASM omits FTS5. Runtime therefore pins the
MIT-licensed `@journeyapps/wa-sqlite` 0.4.2 build, whose Makefile enables FTS5
and whose package has no post-install network script. A narrow synchronous
read-only OPFS VFS avoids loading the database into memory and reduced the first
desktop query from 70-89 ms through the general async VFS to roughly 46-55 ms;
warmed queries are 1-4 ms. These measurements are regression evidence only.
The under-50-ms acceptance gate still requires a physical mid-range Android
device and the licensed production core.

---

## Gotchas

### Inventaire audit and source decision, 2026-09-05

Q-027 was approved and the dated 2026-09-02 own-entity NDJSON dump was downloaded
to `pipeline/.cache/inventaire/entities-2026-09-02.ndjson.gz`. Measured download:
296,097,469 bytes in about 84 seconds. SHA-256:
`a37b3115717bafdc92c4cafd64931ed36d4f9f0371374066782a63e19bcce167`.

`node pipeline/inspect-inventaire.ts <path>` streams and audits without ingesting:
3,572,174 entities; 1,434,552 explicitly typed editions; 1,218,641 generic-work
records; 859,372 humans. Among the generic works, 720,348 have an `en` label,
1,039,137 have author references, 642,429 resolve all those author references
inside this own-entity dump, and 432,789 meet both the en-label and local-author
conditions. These are source-shape counts, not usable English catalogue counts.
One actual `en` label is "Inteligência Emocional": the label key cannot establish
the work's language. Claims may wrap values with references, and generic
work types do not establish whether a record is a comic or its novel source.

The owner subsequently chose to **keep Open Library + Wikidata** (E-056).
Inventaire is retained as research evidence only, not incorporated in production.

Open Library HEAD checks resolved to the dated 2026-08-31 dump:
works 4,058,336,593 bytes; authors 779,810,028 bytes; together 4,838,146,621 bytes
(4.84 decimal GB / 4.51 GiB). Editions are excluded. Official API guidance
requires bulk builders to use dumps; do not replace the download with API
harvesting.

The owner approved the exact bounded transfer in E-059 and implementation began
on 2026-09-06. Archive.org's file metadata publishes these verification values:

```text
ol_dump_works_2026-08-31.txt.gz    SHA-1 c9362f345368cdc8bf64efcc05d6e4b590974cb6
                                    MD5   eda3a83f9dbc85a4d8f7cde838f070b5
ol_dump_authors_2026-08-31.txt.gz  SHA-1 96de3a474e5aa1f7b893dbe51a7b31ef3e24f1bd
                                    MD5   bb417161512436212f9509a8705b4c11
```

Do not parse or accept the downloaded files until their local sizes and SHA-1
values match these dated source records. Editions remain excluded.

The same continuation review found that `openlibrary` replayed a gzip after an
interruption but reopened `works-keyed.jsonl` in truncate mode, so it restarted
rather than resumed. Production JSONL checkpoints now pair their source position
with the exact flushed output byte boundary. Resume truncates an uncommitted
tail before appending, and a short output restarts safely instead of skipping
source rows. Wikidata uses the same boundary. The regression test failed under
the old tail-preserving behavior and passes with the fix.

### Runtime corrections during continuation

A failing unit test demonstrated that corrupt stored bytes with an intact
resume marker were previously promoted. Resume now rehashes stored committed
chunks in bounded memory and redownloads from the first mismatch. The test then
passed (byte arrays compared by contents across the JSDOM/Node realm boundary).

Two simultaneous worker opens reproduced an exclusive OPFS handle error.
Worker requests are now serialized; the real browser test then passed. Candidate
verification uses a separate short-lived worker so an update cannot switch
the live reader to an unpromoted file. Reinstalling an identical active version
opens it without rewriting its locked file; changed checksums under an installed
version are rejected. WASM now belongs to shell precaching; catalogue data does not.

A production-browser upgrade probe installs a byte-changed replacement service
worker while the current page remains controlled. The replacement waits, takes
control after the page closes, then cold-loads the shell and the OPFS catalogue
offline with IndexedDB user data intact. The same probe enumerates Cache Storage:
the SQLite WASM is present and no `/corpus/` URL is cached.

### Production pipeline corrections during continuation

The old `all` and `merge` paths could read AniList/MangaDex caches merely
because those files existed, despite the later licensing decision that forbids
shipping them. The default path now excludes those inputs mechanically.
`fixture-merge` is the only command that opts into them, and its generated
manifest remains an engineering fixture that normal Vite production removes.

Open Library works store author references as keys. The previous implementation
stopped there even though author typeahead is a required catalogue field.
`openlibrary-authors` now streams the authors dump, checkpoints retained names,
and creates the resolved work input; production merge fails loud if it is absent.

The previous Wikidata stage marked itself complete when it reached a local page
budget and overwrote resumed totals with only the latest run. It now marks done
only when the source returns no more rows, retains cumulative counts on resume,
and retries the same page after a timeout. Production merge refuses an incomplete
checkpoint. Unambiguous P179 memberships join to Open Library work IDs through
P648; multiple different series claims are left unassigned rather than forcing
one into the runtime's single series slot.

### Existing pipeline gotchas

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

---

## Phase 4 runtime metadata and covers · 2026-09-07

This is deliberately separate from bulk acquisition. The production catalogue
already carries licensed Open Library cover identifiers; adding one of its
records may derive the official Covers API URL and attempt one reader-triggered
background fetch. The image is untrusted input: it is fetched, decoded,
downscaled to at most about 600 px wide without upscaling, and stored in OPFS
before Dexie names it as the active cover. A failed fetch leaves the remote URL
as a retry lead and keeps `coverSource: none` unless an older local cover exists.
No remote image URL is rendered directly on library screens.

`src/metadata/openlibrary.ts` is the low-volume per-record enrichment boundary.
It accepts validated Open Library work and optional exact edition identifiers,
requests one record at a time, surfaces HTTP failures and `Retry-After`, and
never substitutes a page count from a different edition. It is not a search,
crawler, dump replacement, or permission to burst the public API. The bulk
pipeline above remains the only catalogue-building path.

User and API cover files occupy separate OPFS namespaces. A user-selected image
always wins over an API response that finishes later. Workbox does not cache
cover requests; retaining both a permanent OPFS copy and a 30-day Cache Storage
copy was rejected after the OPFS journey passed (E-071).

---

## Phase 5 relationship runtime · 2026-09-07

No acquisition source or redistribution boundary changed. Phase 5 reads
relationships already present in the licensed production SQLite file by exact
`corpus_work.id`. The worker joins `corpus_work` to `corpus_series` and
`corpus_universe`, then lists exact series members ordered by stated ordinal,
year, and title. Search similarity never creates relationship evidence.

The production index contains 2,185 series and 7,222 linked works but **zero
universe rows**. Series suggestions, known totals, ordinals, ghost entries, and
whole-series review may therefore use real source evidence. Universe code remains
forward-compatible, but the current app must not show Add whole universe or
claim a series position within a universe because the corpus cannot support
those statements.

The required Golden Son fixture is local test evidence only. It constructs a
small in-memory SQLite relationship and proves Red Rising entry 2, one missing
earlier entry, exact-source confirmation, and rollback-safe Wishlist bulk add.
It is not additional production catalogue content.

The 2026-09-08 Phase 5 completion work did not acquire, transform, or add any
production catalogue row and did not change a source, count, checksum, license,
or redistribution boundary. The browser-only `__EXL_PHASE5_TEST__` bridge is
dynamically imported only in Vite test mode and seeds Dexie/runtime mocks for
focused E2E journeys; it is absent from the normal production build. The
production catalogue therefore remains 438,584 bounded Open Library/Wikidata
works with zero verified universes, and the 3,722-work AniList/MangaDex database
remains an isolated engineering fixture that must never ship.

---

## GitHub Pages catalogue packaging · 2026-09-13

GitHub's single-file limit prevents committing the 273,784,832-byte production
SQLite file directly. `npm run pages:corpus:split` therefore maps the already
approved production manifest's 66 chunks to `deployment/corpus/part-000.bin`
through `part-065.bin`. Each part is checked against its existing SHA-256 before
it is written; no row, source, count, licence, or database byte changes.

The Pages workflow first builds the shell without any ignored local corpus,
then `npm run pages:corpus:assemble` checks every committed part, reconstructs
`dist/corpus/corpus.sqlite`, and rejects the artifact unless both the declared
273,784,832-byte size and whole
`1d5c9eba8347481ab55db124378c15d1d6ac05264f7012160fc0954a0a7272c7`
SHA-256 match. The manifest is copied only after successful assembly. The
engineering fixture remains under ignored `pipeline/.cache` and is neither an
input nor a fallback for this workflow.
