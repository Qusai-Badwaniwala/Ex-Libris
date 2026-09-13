# Ex Libris — Engine Brief

### For Claude Code

**Version 1.0 · Owner: the engine. Companion document: `EX-LIBRIS-DESIGN-BRIEF.md` (owned by Claude Design).**

---

## 0. Read this first

**Before you write any code, do these four things, in order:**

1. **Read this entire document.** It is long on purpose. Every gap I could anticipate is closed here so you do not have to guess or invent. If something genuinely is not specified, it goes in `OPEN-QUESTIONS.md` — you do not fill it in yourself.
2. **Inventory your tooling.** Run `/plugin` and check available skills, plugins, and MCP servers _before_ Phase 0, not halfway through. If a plugin exists for SQLite, PWA scaffolding, IndexedDB, or build pipelines, use it. Say what you found in your first message.
3. **Ask your questions.** There is a list at the end (§13). Ask them, plus anything else you need. Wait for answers. Do not begin Phase 0 until the user has replied.
4. **Set up the handoff files** (§12) before any implementation. They are how the project survives session limits.

### How to communicate

**Standard technical English. Plain words. Say only what is necessary.**

- No preamble. No summarising what you just did unless asked.
- No unsolicited insights, observations, or commentary.
- No restating the user's request back to them.
- When reporting, give the result and any problem. Nothing else.
- **Ask questions whenever you have them.** A question is never wasted; a wrong assumption always is.
- When a decision is needed, give two or three concrete options with a recommendation, not an open question.
- Never dump a raw stack trace on the user. State what broke and what you need.

The user is not a backend engineer. They own product and design direction. Verbose output costs them tokens and attention.

---

## 1. What you are building

**Ex Libris** is a personal reading tracker. A Progressive Web App, mobile-first, single-user, fully offline, no accounts, no cloud, no cost — ever.

The user reads across three formats: published **books**, serialized **novels** (web novels and light novels), and **manhwa**. Existing trackers fail them because those tools model a book as a finished, ISBN'd, atomically-published object, and rate it on a single star axis. Ex Libris models serialized work properly and rates on named qualitative scales.

**The name is load-bearing.** _Ex libris_ — "from the books of ___" — is the inscription on a bookplate pasted inside the cover of a book to mark ownership. The app is a private archive. It never nags, never gamifies, never sends a notification. It remembers what the user has read and shows it back with some dignity.

### Non-negotiable constraints

|              |                                                                                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cost**     | Zero. No paid API, no paid hosting, no service with a credit card attached. If a dependency has a paid tier, we use only what is free without billing enabled. |
| **Storage**  | Entirely local to the device. No cloud sync, no remote database, no user accounts, no telemetry, no analytics.                                                 |
| **Network**  | Permitted and expected — for metadata lookups, cover images, and the one-time corpus download. Never for storing user data.                                    |
| **Size**     | Generous. A one-time download in the hundreds of megabytes is acceptable. Multi-gigabyte on-device storage is acceptable.                                      |
| **Platform** | Mobile-first PWA, installable, offline-capable. Android primary. Desktop should work but is not the design target.                                             |

---

## 2. Your domain, and the boundary

### You own

- All data modelling, schema, migrations, storage
- The build-time corpus pipeline (§6) — this is the largest single piece of work in the project
- All runtime logic: search, matching, series and universe resolution, dominant-colour extraction, progress calculation, statistics
- All external API clients and caching
- Backup, export, import, restore
- Service worker, offline behaviour, PWA manifest, share-target handling
- Performance, correctness, error handling
- Implementing the components and screens that Claude Design specifies

### Claude Design owns

- All visual design: palette, typography, spacing, motion, illustration
- Screen layout and composition
- Interaction and transition specification
- Component appearance and states
- All user-facing copy — labels, empty states, errors, button text

### The boundary rule

**Do not make visual decisions.** If you need a screen, a component, a colour, a label, an animation, or a piece of copy that the design brief does not specify, you **stop and ask** — either the user, or the user relays to Claude Design. Do not improvise a UI and mark it "to be styled later," because it will not be restyled later; it will ship.

If a design specification is technically impossible or would break a performance budget, **say so with a specific reason and propose an alternative that preserves the intent.** Do not silently simplify. Example of the right response: _"The spine view specifies per-spine width from chapter count. For 400+ items this causes layout thrash on scroll. I can virtualise the list and keep the exact visual, or bucket widths into 5 steps. Recommend virtualising — no visual change. Which?"_

### The shared contract

Everything below was written before you started. You consume all of it:

- **`SCHEMA.md`** — the data contract, authored up front and shared with Claude Design. Every entity, every field, every enum value, and every returned payload shape. Implement it exactly. Changes go through the user.
- **`tokens.css` + `COMPONENTS.md`** — from Claude Design. You never hardcode a colour, size, radius, or duration. Every value comes from a token. If you need a token that does not exist, ask; do not invent one.
- **Design's prototypes and `MOTION.md`** — HTML, CSS, JS, JSON, SVG. See below.

### Handling Design's output — read this carefully

Claude Design produces **static prototypes**: typically one HTML file per screen or one long HTML file, plus CSS and sometimes a JS or JSON file for interaction and sample data. **You are the one who assembles these into the real application.** That is your job and they are not doing it.

**The rule: port, do not redesign.**

- Convert their markup and CSS into React components as faithfully as you can. Preserve class names, structure, spacing values, and animation timings.
- **Do not "clean up," reorganise, simplify, or improve their CSS.** What looks redundant to you is often deliberate.
- **Do not substitute a component library** for something they hand-built.
- Their JSON is sample data illustrating the shape a screen expects. Read it as a specification, not as content to keep.

**When you must deviate**, and you sometimes will, the protocol is:

1. Do not change it silently.
2. Tell the user: what you changed, the specific technical reason, and what visual difference results — if any.
3. If the visual result differs at all, ask before proceeding.
4. Log it in `DECISIONS.md`.

A silent deviation is the single most expensive failure mode in this two-session setup, because nobody notices until the design session sees the built app and has to redo work.

**If a design specification is genuinely impossible** or breaks a performance budget, say so with a specific reason and propose an alternative that preserves the intent. Example of the right response: _"The spine view specifies per-spine width from chapter count. For 400+ items this causes layout thrash on scroll. I can virtualise the list and keep the exact visual, or bucket widths into 5 steps. Recommend virtualising — no visual change. Which?"_

### Design is finished before you start

**There is exactly one handover in this project, and it has already happened by the time you read this.**

Claude Design worked through all nine of their phases first. You are receiving a complete design package:

- `tokens.css` — the full token set
- `COMPONENTS.md` — every component: anatomy, states, spacing, motion, tokens consumed
- All screen prototypes as working HTML and CSS
- Any JS or JSON showing interaction and expected data shape
- All illustration SVGs
- `MOTION.md` — spring curves, durations, transition choreography, haptic points
- `DECISIONS.md` — their reasoning, so you understand intent rather than only output

**`SCHEMA.md` is attached to this brief and both sessions worked from it.** You did not author it and Claude Design did not wait for it. Implement it exactly.

**If you need to change the schema** — a missing index, an unworkable type, a field that turns out to be necessary — propose it to the user with the reason. If the change affects anything visible on screen, it goes back to them before you implement it. This is the one path that can send work back to the design session, so keep it rare.

**If something in the design is genuinely unbuildable**, say so immediately with a specific technical reason and a proposed alternative that preserves the intent. Do not silently simplify and do not wait until a later phase to mention it. Design was given a technical-constraints section covering browser APIs, virtualisation, and performance limits, so this should be uncommon — but if it happens, flag it the day you find it.

You have no other dependencies. Everything from here is yours.

---

## 3. Stack — decided, do not relitigate

These are settled. If you believe one is wrong, raise it in your opening questions with a specific reason. Do not change one mid-build.

| Layer             | Choice                                                                      | Why                                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework         | **React + TypeScript + Vite**                                               | PWA plugin ecosystem, fast builds, strict typing on a schema-heavy app                                                                             |
| User data         | **IndexedDB via Dexie**                                                     | Migration story is the reason; raw IDB migrations are where this kind of app dies                                                                  |
| Corpus            | **SQLite compiled to WASM (`wa-sqlite`) with an OPFS-backed VFS**           | A ~150 MB database cannot be held in memory on a phone. OPFS VFS reads pages on demand. Do **not** use `sql.js` — it loads the whole file into RAM |
| Corpus queries    | **Web Worker**, always                                                      | FTS queries must never touch the main thread                                                                                                       |
| Binary storage    | **OPFS** (Origin Private File System)                                       | Covers, backups, the corpus file                                                                                                                   |
| Persistence       | `navigator.storage.persist()` requested at first run                        | Without it the browser may evict everything                                                                                                        |
| Service worker    | **Workbox** via `vite-plugin-pwa`                                           | Precache shell, runtime-cache covers, handle share target                                                                                          |
| Styling           | **CSS custom properties**, tokens from Claude Design                        | No Tailwind unless Claude Design asks for it                                                                                                       |
| Animation         | Native CSS + View Transitions API; **Motion One** only if springs demand it | Keep the bundle small                                                                                                                              |
| Colour extraction | Canvas-based, written in-house or a tiny library (~2 KB)                    | Runs once per cover, result cached                                                                                                                 |
| Testing           | Vitest for logic; Playwright for critical flows                             | Matching and backup logic must have tests                                                                                                          |

**Browser API budget.** Verify support and write a graceful fallback for each: OPFS, `storage.persist()`, View Transitions, Web Share Target, `BarcodeDetector` (only if the user later enables scanning), Vibration.

---

## 4. Data model

This is the contract. Mirror it into `SCHEMA.md` and keep them in sync.

### 4.1 `work` — a book, novel, or manhwa

```ts
interface Work {
  id: string; // uuid v4
  title: string;
  sortTitle: string; // leading articles stripped, lowercased, for ordering
  subtitle?: string;

  format: 'book' | 'novel' | 'manhwa';
  // DECIDED BY HOW THE USER READS IT, NOT BY WHAT IT TECHNICALLY IS.
  // A web novel with a print edition is 'novel' if they read it serialized.
  // Always user-editable in one tap. Never auto-corrected after creation.

  authorIds: string[]; // may be empty; manhwa often credits studios
  seriesId?: string;
  seriesPosition?: number; // decimal permitted: 1.5 for novellas between entries
  universeId?: string;

  status: 'wishlist' | 'reading' | 'caught_up' | 'finished' | 'dropped';
  publicationStatus: 'ongoing' | 'complete' | 'hiatus' | 'abandoned' | 'unknown';
  // CRITICAL: these are orthogonal. `status` describes the user.
  // `publicationStatus` describes the work. A manhwa can be `ongoing` while the
  // user is `caught_up`. Never derive one from the other.
  // `caught_up` is ONLY offered when publicationStatus is 'ongoing' or 'hiatus'.

  progressUnit: 'page' | 'chapter' | 'percent';
  // Defaults by format: book -> 'page', novel -> 'chapter', manhwa -> 'chapter'.
  // Always user-overridable per work.
  progressCurrent: number; // 0 when unstarted
  progressTotal?: number; // prefilled from corpus where known, always editable

  coverSource: 'api' | 'user' | 'none';
  coverPath?: string; // OPFS path
  coverRemoteUrl?: string; // original source, for re-fetch after restore
  coverDominantColor?: string; // '#RRGGBB', extracted once and cached
  coverTextColor?: string; // 'light' | 'dark', computed for contrast

  rating?: number; // 1-5, half-steps allowed. Independent of axes.
  tagIds: string[];

  isTranslated: boolean; // compatibility only; E-087 shows Translation always

  dateAdded: string; // ISO 8601, all dates
  dateStarted?: string;
  dateFinished?: string;
  dateDropped?: string;

  dropReason?: string; // free text, always optional, never prompted twice
  dropAtProgress?: number; // where they stopped

  externalIds: {
    openLibraryWork?: string;
    openLibraryEdition?: string;
    wikidata?: string;
    anilist?: number;
    mangadex?: string;
    googleBooks?: string;
    isbn13?: string;
  };

  corpusId?: string; // provenance link back to the corpus row
  isManualEntry: boolean; // true when no corpus match existed

  notes?: string; // short free-text field on the work itself,
  // separate from the Notes feature (§4.6)

  deletedAt?: string; // soft delete — Trash. Hard-purge after 30 days.
  updatedAt: string;
}
```

**Indexes:** `status`, `format`, `seriesId`, `universeId`, `sortTitle`, `dateFinished`, `deletedAt`, and a compound `[format+status]`.

### 4.2 `axisRating`

One row per work. Every field nullable — partial ratings are normal and must not break `moreLikeThis`.

```ts
interface AxisRating {
  workId: string;
  protagonist?: 1 | 2 | 3 | 4 | 5; // Heroic · Principled · Pragmatic · Ruthless · Monstrous
  powerSystem?: 1 | 2 | 3 | 4 | 5; // Vague · Loose · Coherent · Codified · Rigorous
  world?: 1 | 2 | 3 | 4 | 5; // Gentle · Fair · Harsh · Brutal · Merciless
  pacing?: 1 | 2 | 3 | 4 | 5; // Slow burn · Patient · Steady · Driving · Relentless
  prose?: 1 | 2 | 3 | 4 | 5; // Plain · Clean · Textured · Rich · Dense
  ending?: 1 | 2 | 3 | 4 | 5; // Botched · Rushed · Passable · Satisfying · Earned
  endingNone?: boolean; // TRUE = the work has no ending (author abandoned it).
  // Mutually exclusive with `ending`. This is NOT a
  // low score — it is a different fact. Never average it in.
  translation?: 1 | 2 | 3 | 4 | 5; // Rough · Stiff · Serviceable · Smooth · Fluent
  // E-087: shown for every work, but excluded from six-axis matching
  ratedAt?: string;
}
```

**Rules.** `ending` is writable only when `status === 'finished'`. The axis names above are the canonical strings — never display a number, always display the word. Claude Design will specify the presentation.

### 4.3 `series`

```ts
interface Series {
  id: string;
  name: string;
  sortName: string;
  universeId?: string;
  totalEntriesKnown?: number; // from corpus; powers completion rings
  source: 'corpus' | 'user';
  externalIds: { wikidata?: string; anilist?: number; openLibrary?: string };
  updatedAt: string;
}
```

### 4.4 `universe`

A level above series. Solves the user's stated pain: discovering too late that a series sits inside a larger continuity that should be read in a different order.

```ts
interface Universe {
  id: string;
  name: string;
  description?: string; // short, from corpus, optional
  readingOrderNote?: string; // free text — "start with X, not Y"
  source: 'corpus' | 'user';
  externalIds: { wikidata?: string };
  updatedAt: string;
}
```

### 4.5 `author`

```ts
interface Author {
  id: string;
  name: string;
  sortName: string; // "Brown, Pierce"
  role?: 'author' | 'artist' | 'studio' | 'translator';
  externalIds: { openLibrary?: string; wikidata?: string; anilist?: number };
}
```

### 4.6 `note` and `noteLink`

Free-floating, optionally attached to one or more works. Google Keep semantics.

```ts
interface Note {
  id: string;
  title?: string;
  body: string; // plain text or lightweight markdown — ask the user
  tagIds: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

interface NoteLink {
  noteId: string;
  workId: string;
  createdAt: string;
}
```

A note with no links lives only in the Notes feed. A linked note appears in the feed **and** on each linked work's page. Deleting a work must not delete its notes — it unlinks them, and they survive as loose notes.

### 4.7 `tag`

```ts
interface Tag {
  id: string;
  name: string;
  normalizedName: string; // lowercased, trimmed — used for dedupe
  source: 'user' | 'corpus'; // corpus tags come from OL subjects / AniList genres
  usageCount: number; // denormalised, for suggestion ordering
}
```

Tags are shared across works and notes. Merge on `normalizedName` collision.
Never delete a tag automatically. Settings now offers explicit rename and exact
destination merge, plus removal only when no active or soft-deleted work or
note references the tag. Near-match suggestions remain outside the approved
product.

### 4.8 `settings`

Single-row key-value store. Includes at minimum: theme (`light` | `dark` | `system`), owner name (from the bookplate), default view per format (`list` | `spine`), corpus version, last backup timestamp, AI enabled flag (default `false`), AI API key (default empty), last-seen app version for migrations.

---

## 5. The corpus — what and why

The user's core frustration is not knowing whether a book stands alone, sits in a series, or belongs to a larger universe. The fix is a **prebuilt local database** shipped with the app, giving Google-style instant typeahead with no network call and no API cost.

Target: **type three characters, see ranked results in under 50 ms, offline.**

### Sources

| Source                      | Provides                                                                   | Access                                | Licence |
| --------------------------- | -------------------------------------------------------------------------- | ------------------------------------- | ------- |
| **Open Library bulk dumps** | Works, editions, authors, subjects, cover IDs                              | Monthly `.txt.gz` dumps               | CC0     |
| **Wikidata**                | **Series membership (P179) and ordinal (P1545); universe/franchise links** | SPARQL + dumps                        | CC0     |
| **AniList GraphQL**         | Light novels, manga, manhwa; relations; chapter counts; publication status | Free API, no key                      | Per ToS |
| **MangaDex API**            | Manhwa/manhua detail and chapter counts                                    | Free API                              | Per ToS |
| **Google Books**            | Gap-filling, `seriesInfo`                                                  | Free, keyless for basic volume lookup | Per ToS |

**Wikidata is the important one.** It is the only free structured source that states _"this work is entry N of series S"_ as data rather than as a string to be parsed. Series resolution quality lives or dies on how well you exploit it.

**Known gap — pure web novels.** Works living only on NovelUpdates or Royal Road (Reverend Insanity, Shadow Slave, Kill the Sun) appear in none of the above. NovelUpdates has no public API. **Phase 2 includes a timeboxed research task** — investigate whether a permissively-licensed community dataset exists. Report findings; do not scrape a site whose terms forbid it. If nothing exists, manual entry covers it and that is acceptable. Do not silently substitute AI-generated metadata for a real source.

---

## 6. The corpus pipeline (build-time)

A Node/TypeScript pipeline under `/pipeline`, run manually on the user's machine, roughly monthly. It is not part of the app bundle. This is the "backend" of the project.

**Design it as resumable, idempotent stages with checkpoints.** The OL editions dump alone is tens of gigabytes; a stage that fails at 90% must not restart from zero. Log counts at every stage.

### Stages

**1 · Acquire.** Download OL dumps (`ol_dump_works`, `ol_dump_editions`, `ol_dump_authors`), verify sizes, cache locally. Stream-parse — never load into memory.

**2 · Filter.** From ~40M works, cut to a shippable core. Proposed predicate, tunable, and **report the resulting count before proceeding**:

- has a title and at least one author
- has a cover ID
- English language (or has an English edition)
- `edition_count >= 2` **or** appears in Wikidata **or** is tagged fiction

Target 300k–600k works. If the first pass lands far outside that, tune and report rather than shipping something enormous.

**3 · Wikidata enrichment.** Extract entities with P179 (part of the series) and P1545 (series ordinal). Also capture franchise/universe relations — P179 chains, and "present in work" style links where a series belongs to a broader continuity. Join to OL via ISBN, title+author fuzzy match, and existing OL↔Wikidata identifiers. **Log the join rate.** This number is the single best predictor of whether series detection will feel good, and the user should see it.

**4 · AniList ingest.** Paginated GraphQL pull of type `MANGA` (which covers manga, manhwa and light novels; use `countryOfOrigin` and `format` to classify). Capture: titles including synonyms, `chapters`, `volumes`, `status`, `genres`, `tags`, `relations` (PREQUEL/SEQUEL/PARENT/SIDE_STORY), cover URLs. Respect rate limits; checkpoint every page.

**5 · MangaDex ingest.** Manhwa/manhua specifically, for chapter counts and status where AniList is thin.

**6 · Normalize and merge.** Unicode NFKC, strip articles for sort keys, normalise punctuation, build a `title_normalized` field for matching. Deduplicate across sources with a documented confidence rule. **When sources conflict, precedence is: Wikidata > AniList > MangaDex > Open Library > Google Books.** Record which source won in a `source` column so provenance is inspectable.

**7 · Derive series and universes.** Cluster into `corpus_series` and `corpus_universe`. Compute `total_entries` per series — this powers completion rings, so accuracy matters more than coverage. Where a count is uncertain, store null rather than a guess.

**8 · Build SQLite.** Emit `corpus.sqlite` with:

- `corpus_work` — id, title, title_normalized, authors (denormalised text), format_hint, series_id, series_position, universe_id, cover_id, cover_source, publication_status, chapter_count, volume_count, year, popularity, external ids, source
- `corpus_series` — id, name, universe_id, total_entries
- `corpus_universe` — id, name, description
- `corpus_work_fts` — FTS5 virtual table over title + title_normalized + authors, `tokenize='unicode61 remove_diacritics 2'`, with a `prefix='2 3 4'` index so short prefixes are fast

`VACUUM` and `ANALYZE` before shipping. Report final byte size.

**9 · Emit.** Write to `/public/corpus/` with a `manifest.json` carrying version, build date, row counts, byte size, and a checksum. Versioning matters — the app must detect and offer a corpus update without touching user data.

### Cover images are never bundled

Half a million covers is hundreds of gigabytes. Covers fetch on demand from `covers.openlibrary.org` (or AniList/MangaDex CDN), then cache into OPFS permanently. A user-supplied cover always wins and is never overwritten by a fetch.

---

## 7. Runtime architecture

### Corpus loading

On first launch, after the bookplate, download `corpus.sqlite` into OPFS with **visible, honest progress** — Claude Design specifies the screen. Must be resumable and must survive backgrounding. The app is usable while it downloads: manual entry and live API lookup work without the corpus. Never block the user behind it.

### Search — one bar, two result sets

A single search field serves both "find something I own" and "add something I don't."

1. Query Dexie for library matches (fast, small).
2. Query the corpus FTS5 in the worker.
3. Merge, deduplicate against `corpusId`, and return two labelled groups.
4. If the corpus returns nothing and the query is 4+ characters, fall back to live Open Library / AniList search.
5. **Any live result the user acts on is written into the local corpus**, so the corpus grows toward the user's taste and never repeats a network round trip.

Debounce ~120 ms. Cancel in-flight queries on new input. Rank by: exact prefix on title > prefix on any title token > author match > popularity > has cover.

### Series and universe resolution

Runs when a work is added. **Suggests, never applies.** Cascade, stopping at first confident hit:

1. **Corpus** — direct `series_id` / `universe_id` on the matched row. Highest confidence.
2. **Title pattern** — `#2`, `Book Two`, `Vol. 3`, `Part II`, `(Series Name #4)`. Regex set; keep it in one documented module.
3. **Library fuzzy match** — normalised trigram similarity against existing works and series. Threshold must be tuned conservatively; a false positive is far worse than a miss.
4. **AI fallback** — only when enabled, only when 1–3 all fail (§10).

Output is a dismissible suggestion. Claude Design specifies the presentation; the payload you provide is: series name, position, total known entries, other entries not yet in the library, and a confidence indicator.

**Universe suggestions are separate and rarer.** Only surface one when the corpus has a genuine universe link, and phrase it as a distinct offer from the series suggestion.

### Cover pipeline

Fetch → validate it is an image → downscale to a sensible max (propose ~600px wide, ask) → store in OPFS → extract dominant colour → compute a light/dark contrast flag → cache both on the work. Extraction runs once, never on render.

The dominant colour feeds **two** features — cover-tinted detail pages and spine-view colours. Build it once, expose it as one utility.

### Backups

**Automatic.** On app open, if more than 48 hours since the last snapshot, write one to OPFS at `/backups/`. Include all user data **and user-uploaded covers** — those are irreplaceable. API-fetched covers are excluded; they can be re-fetched. Keep the last 10, rotate oldest out. Silent, no interruption. Log the timestamp in Settings.

**Manual export.** A `.zip` containing `data.json` (schema-versioned), `/covers/user/`, and a `manifest.json`. Saved via the File System Access API where available, otherwise a normal download. This is the device-to-device path and the only protection against device loss — Claude Design should be told to make this discoverable, and you should surface a gentle reminder if no manual export has ever been made.

**Import — three paths, one screen:**

1. **Restore** from an Ex Libris backup. Offer merge or replace; default to merge; always show a preview count before writing.
2. **Paste a list** — plain text, one title per line. Match all against the corpus, present a single confirmation screen with per-row match/no-match, let the user fix or skip individually, then commit as one batch.
3. **CSV with column mapping** — parse headers, let the user map columns to fields (title, author, status, rating, progress, tags). Deliberately generic: no hardcoded vendor schema, so it works with any app's export now or later.

All three must be **transactional** — a partial import that half-writes is worse than a failed one.

### Share target

Register in the manifest. Receiving a share (URL, text, or title) opens the add flow prefilled and pre-searched, defaulting to Wishlist. Must work from cold start.

---

## 8. Feature specifications

**Bookplate (first run).** Full-screen, illustrated, one field: the owner's name. Writes to settings, then becomes the About screen permanently. This is the only time the app asks the user for anything about themselves.

**Status model.** `wishlist → reading → finished`, with `dropped` reachable from anywhere and `caught_up` offered only when the work is `ongoing` or `hiatus`. Setting `reading` stamps `dateStarted` if empty. Setting `finished` stamps `dateFinished`, unlocks the `ending` axis, and triggers the finish moment (Claude Design specifies; you provide the hook and a haptic tick via the Vibration API). **Finished is never rendered as diminished** — no strikethrough, no grey, no reduced opacity. It is the shelf the user should be proudest of.

**Progress.** Unit per work. When `progressTotal` is known, a percentage is derived. When it is not, show the raw count and no bar. Editing progress should be one tap plus a number, not a form.

**More like this.** Weighted distance across the six axes among the user's own works. Weight `protagonist`, `powerSystem` and `world` highest; weight `pacing` and `prose` loosely, because those are appetites rather than judgments. Ignore null axes rather than imputing them, and require at least three shared rated axes before returning a result. **Return the matching axis names with each result** so the UI can explain itself — "matched on Monstrous and Merciless." A recommendation that cannot explain itself is not trustworthy.

**Series completion rings.** `entriesOwned / series.totalEntriesKnown`. Where the total is null, no ring — never a fake denominator.

**Spine view.** Provide per-work: dominant colour, a width value derived from length (chapter or page count, bucketed — Claude Design will specify the buckets), and the title. Must virtualise for large libraries.

**Surprise me.** Random pick from Wishlist. Optional format filter. Trivial, and it solves a real problem.

**Stats.** Finished this year, currently reading, library total, genre distribution, most-read author, series started versus completed, finish rate versus drop rate. Home shows three; the Stats tab shows all. **All counts must be honest** — never inflate by counting wishlist items as library items.

**Trash.** Soft delete, 30-day retention, restore, empty-now. Deleting a work unlinks its notes rather than deleting them.

---

## 9. Performance budgets

Treat these as tests, not aspirations. Measure on a mid-range Android device, not a desktop browser.

| Metric                                  | Budget                        |
| --------------------------------------- | ----------------------------- |
| Typeahead keystroke → results painted   | < 50 ms                       |
| App cold start → Library interactive    | < 1.5 s                       |
| Library scroll, 1000 items              | 60 fps, virtualised           |
| Main-thread block from any corpus query | 0 ms — all in worker          |
| JS bundle, gzipped, excluding corpus    | < 250 KB                      |
| Cover fetch → cached and painted        | < 400 ms on a warm connection |

---

## 10. AI — optional, off, and structurally free

The app must be complete and fully functional with AI disabled. Ship it that way by default.

**Where AI is genuinely useful:** series and universe detection for works absent from every source (pure web novels), and tag suggestions for the same. That is the whole list.

**Where it is not:** spoiler-free summaries. On obscure web novels the model will confidently invent plot. If the user later asks for this, implement it with a visible "AI-generated, may be inaccurate" marker and never cache it as though it were metadata.

**Implementation.** One toggle in Settings, default off. Provider: Google Gemini free tier — no credit card required. The key is pasted by the user, stored locally, never bundled. Add a hard client-side cap (propose 50 calls/day, configurable) and surface the count in Settings. **Document clearly for the user that with no billing configured on their Google account, over-quota requests fail rather than charge.** That is the structural guarantee they asked for; state it plainly and do not overstate it.

---

## 11. Phase plan

Each phase ends with: a working build, updated `HANDOFF.md`, updated `SCHEMA.md` if the schema moved, and **a checkpoint with the user.** Do not roll into the next phase unprompted.

| #      | Phase                | Delivers                                                                                                                                                                                         | Gate                                                                                   |
| ------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| **0**  | Foundations          | Repo, Vite + React + TS, PWA manifest, service worker, Dexie schema implementing `SCHEMA.md` exactly, migration harness, OPFS wrapper, `storage.persist()`, handoff files, `tokens.css` wired in | Schema matches the contract; a token change propagates everywhere                      |
| **1**  | Core library         | Add/edit/delete works, all three formats, status, progress, tags, authors, trash, soft delete. **Ported from the design prototypes, styled properly from day one**                               | User can add a book manually, it looks right, and it survives a reload                 |
| **2**  | Corpus pipeline      | The full build-time pipeline. Longest phase. Includes the timeboxed web-novel source research                                                                                                    | **Report row counts, Wikidata join rate, and final file size before building further** |
| **3**  | Corpus runtime       | wa-sqlite in a worker, OPFS load with resumable download, FTS5 typeahead, unified search                                                                                                         | Typeahead hits the 50 ms budget on a real phone                                        |
| **4**  | Metadata and covers  | API clients, cover fetch and cache, downscale, dominant-colour extraction, manual cover override                                                                                                 | Adding a book auto-populates cover and metadata                                        |
| **5**  | Series and universes | Full resolution cascade, suggest-and-confirm flow, series pages, universe pages, completion rings                                                                                                | Adding _Golden Son_ correctly suggests Red Rising #2                                   |
| **6**  | Axes and matching    | Axis storage, finish flow, `endingNone` handling, more-like-this with explanations                                                                                                               | Recommendations return and explain their reasoning                                     |
| **7**  | Notes                | Notes, links, pinning, tags, cross-search                                                                                                                                                        | A note attaches to two works and appears in three places                               |
| **8**  | Data safety          | Auto-backup with rotation, manual export, all three import paths, share target                                                                                                                   | Export from one device, import to another, nothing lost                                |
| **9**  | Stats and spine view | Stats screen, home stats, spine view with virtualisation                                                                                                                                         | Spine view scrolls at 60 fps with 500 works                                            |
| **10** | Polish               | Performance pass against §9, error states, offline verification, optional AI slot, accessibility                                                                                                 | All budgets met on a real device                                                       |

---

## 12. Handoff protocol

Sessions will hit context limits. These files are how the project survives that. **Update them at the end of every working session and after every significant decision — not just at phase boundaries.**

**`HANDOFF.md`** — overwritten each session. Current phase and completion state; what was done this session; what is in progress and exactly where; the next three concrete actions; anything broken or half-finished; commands needed to run the project; environment gotchas. Write it for someone with **no memory of the conversation**, because that is literally who reads it.

**`DECISIONS.md`** — append-only, dated. Every non-obvious technical decision with its reasoning and the alternatives rejected. This is what stops a future session from re-litigating something settled.

**`OPEN-QUESTIONS.md`** — anything needing the user or Claude Design. Mark each `BLOCKING` or `NON-BLOCKING`. Clear resolved items into `DECISIONS.md`.

**`SCHEMA.md`** — the live contract. Versioned. Never let it drift from the code.

**`PIPELINE-NOTES.md`** — corpus-specific: source URLs, dump dates, filter predicates, row counts at each stage, join rates, known data-quality problems. The pipeline is re-run monthly by someone who will not remember how it works.

Start a session by reading `HANDOFF.md` and `OPEN-QUESTIONS.md`. End one by updating both. If a session is running long, **write the handoff before you run out of room**, not after.

---

## 13. Ask before you start

Ask these, plus anything else. Wait for answers.

1. **Where does this live?** Local folder, or a GitHub repo? Any preference on how it gets served for testing on the phone — local network dev server, or deployed somewhere free?
2. **What device do we optimise for?** Android make and model, and roughly how much free storage. This decides the corpus size budget.
3. **Corpus size** — I've proposed 300k–600k works, roughly 100–200 MB. Confirm that ceiling before the pipeline runs, because retuning after the fact is expensive.
4. **Library scale** — roughly how many works on day one, and what should we expect within a year? Changes virtualisation strategy.
5. **Notes format** — plain text, or lightweight markdown with bold/italic/lists?
6. **Cover resolution** — 600px wide is my proposal. Higher looks better on a modern phone but multiplies storage. Preference?
7. **Should the corpus download be optional?** The app works without it via live API, just slower. Force it at first run, or offer "skip for now"?
8. **Web-novel sources** — before Phase 2 I'll research whether any permissively-licensed dataset covers NovelUpdates/Royal Road titles. If none exists, are you comfortable entering those manually?
9. **Barcode scanning** was deferred. Do you own enough physical books to want it? It's cheap to add.
10. **Anything in this document that looks wrong**, or any feature you assumed was included that you cannot find here?
