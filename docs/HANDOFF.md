# Ex Libris — product evolution published

Updated 2026-10-04. Repository: `H:\Ex libris Project\Website`, branch
`master`. All four owner-approved [Product Evolution](PRODUCT-EVOLUTION.md)
passes are complete and publicly released. The owner approved all six boundaries,
commit/push/publication and app-wide purposeful motion (E-117–122). No remaining
implementation or owner decision blocks this release. Preserve Reading Room,
deployed records, immutable design files and installation identity. No
prescriptive design skills or architecture migration.

## Current public release

Live: <https://qusai-badwaniwala.github.io/Ex-Libris/>.

- Application commit: `53fa87dcd6cfe307e2f3c9f17ed0de5d340ff0d0`.
- [Pages run 37187502145](https://github.com/Qusai-Badwaniwala/Ex-Libris/actions/runs/37187502145)
  completed successfully, including the unweakened application gate, normal
  Pages build, production catalogue assembly, exact artifact checks and deployment.
- Public entry: `index-DiZDPZr2.js`; CSS: `index-ov2LJl_S.css`.
- Settings identifies the application as **Build `53fa87dc`**.

The existing live browser accepted Update and retained both pre-existing works,
bookplate, theme, progress and completion. No evaluation records were added,
removed or imported on the public origin. A subsequent read-only phone-sized
review confirmed the released Reading, Detail and Settings hierarchy.
Public entry, CSS, archive worker and launcher icons match the exact local
clean-commit Pages build byte for byte. Entry SHA-256:
`744eb8d7bafc67b2911701be666426101905f34813b40683f55d607bbb85b2af`.
Documentation-only pushes skip Pages; the application build remains `53fa87dc`.

## Implemented evolution and preserved boundaries

Recovery now shares OPFS initialization, aborts failed binary writes and edits
work fields atomically. Status/genre/progress failures retain truthful state.
Restore validates known shapes and references, explicitly names ID collisions
and verifies a complete cover-preserving safety archive before an overlapping
merge or replacement. Retained snapshots support review/export; catalogue
repair promotes an inactive verified slot; immutable readers use compatible
handles. Wishlist removal is recoverable through Undo and Trash.

Pinned Motion 14.0.0 uses LazyMotion/m, shared reviewed presets, interruptible
presence, immediate inert exits and bounded committed layout changes. Native
cover/add transitions remain. Theme uses a brief CSS colour handoff because
native full-page capture swallowed immediate subsequent taps. Scroll, focus,
search/import/group context and dirty drafts survive navigation and coordinated
updates. Virtualised scrolling does not replay entrance animations. Reduced
motion renders final states without stagger or waiting.

Detail prioritises reading controls, relationships and attached note creation,
with expandable profiles and read-only session history ahead of record metadata.
Long note titles, nested tags, short-phone group headers, world descriptions,
honest empty headings, stable form footers, Trash rows and restore hierarchy are
refined. Current-year page/chapter statistics use local session dates. Archive
ZIP/CRC/JSON validation and safety-copy comparison run in a lazy worker. CI uses
authored synthetic catalogue rows and rejects engineering fixtures in releases.
Unused original illustrations leave precache; both theme derivatives stay offline.

The Reading Room identity remains: Literata / Source Sans 3, mineral paper and
vermilion light surfaces, near-black/charcoal and blue-grey dark surfaces, the
owner-supplied X-and-quill icon, all thirteen illustration pairs, Home/Notes
composition and existing relationship semantics. Reading opens first; Collection
defaults to Index with optional Three.js Codex and no idle rendering.
`reading-room-tokens.css` is the maintained runtime design system.

Dexie v3, archive schema 2, existing IDs, records, covers, onboarding, origin,
`/Ex-Libris/`, scope, start URL, share handling and icon filenames remain compatible.
No accounts, cloud, telemetry, paid service, new provider, bulk acquisition,
architecture migration, automatic edition merge, rereads or session editing.
The separate historical `../Astra-Redesign` checkout is not the release source.

## Verification

The local unweakened `npm run gate` passed **252 unit / 73 production-mode
browser journeys**, formatting, lint, strict types, frozen/structural checks and
normal build. The final tablet navigation breakpoint correction then failed its
regression assertion with the defect restored and passed with the fix. GitHub
CI reran the complete gate on the final committed state and passed before deploy.
Storage, archive, router, release-boundary and real-pointer motion regressions
likewise failed with their defects restored and passed after repair.

Sequential real-browser review covered Reading/Collection/Codex, search/manual
acquisition, Detail/log/history/profile, Notes and nested tags, finish/axes,
series/world/orders, Wishlist/Surprise/removal/Trash restore, Stats,
Settings/About/tag maintenance, backup/snapshot/restore/paste review in both
themes. Phone, 820px tablet and 1280px desktop hierarchy were inspected.
Automated journeys also cover 360/412/820/1440px, enlarged text, reduced motion,
first run, empty/populated states, offline/cold start, drafts and worker updates.

- 500-work Codex: **60.0fps**, five mounted rows, exact restored Back position
  **68186**, no idle rendering and passing GPU-loss fallback.
- 16 MiB archive: 16,781,472 bytes, two faithful cover digests, 756ms elapsed,
  46 frames, longest frame gap 16.8ms and no observed main-thread long task.
- Final normal Pages build: entry 660.89 kB / 201.72 kB gzip; CSS 44.37 / 9.66;
  lazy Motion features 85.84 / 28.39; Codex 526.49 / 132.67; archive worker 15.16.
- Pages precache: **38 entries / 11521.36 KiB**; root build: 41 entries /
  11521.18 KiB, formerly 53 / 15935.49 KiB. Both offline artwork themes remain.
- Motion source-map attribution: **43,834 gzip bytes / 42.8 KiB**, 2.8 KiB above
  the 40 KiB target. Unsupported private imports were deliberately rejected.
- Production dependency audit: **zero vulnerabilities**.

These runtime measurements are desktop-browser/emulated evidence, not physical
phone measurements. Q-028 physical Android catalogue latency, TalkBack and actual
launcher appearance remain explicitly unpassed. Separate development-tool
advisories and owner-deferred rereads/session editing are outside this release.

## Catalogue and release checks

The unchanged licensed Open Library/Wikidata catalogue contains **438,584 works**,
273,784,832 bytes, SHA-256
`1d5c9eba8347481ab55db124378c15d1d6ac05264f7012160fc0954a0a7272c7`.
The public manifest matches; a bounded read returned **206**, range
`bytes 0-31/273784832`, 32 bytes and `SQLite format 3`. All existing catalogue
deployment-part hashes remain unchanged. Catalogue data stays out of precache,
Dexie and mutable-user backups. Pure web-novel coverage remains limited; manual
entry and paste-list recovery remain available.

`check:release` verified seven scripts without test bridges, the licensed
catalogue checksum/count/quick check, scope/start URL, 404 fallback and both
offline art themes. The deterministic authored CI fixture is 3,722 works /
7,573,504 bytes / two chunks; it never ships in the normal Pages artifact.

## Environment and next three actions

Exact released Pages build is hosted at **http://localhost:4292/Ex-Libris/**
(preview session 92915). `VITE_BASE_PATH=/Ex-Libris/` is required for both build
and preview: omitting it when serving a Pages build produced incorrect asset
responses until the preview environment was corrected. Port 4291's prior
preview is stopped. Before building, inspect 5173/4173/4284/4291/4292 listeners
and relevant Node command lines; never overwrite a served artifact. The gate
creates its own test preview. Never publish `--mode test` output. Windows
esbuild spawning/tests and external Git/GitHub operations required escalation;
read-only GitHub REST works and `gh` is not on PATH.

1. On the phone, save active edits, open Ex Libris online and accept **Update**.
   If no offer appears, close all Ex Libris windows and reopen the installed app.
   Confirm Settings shows Build `53fa87dc`; do not clear site storage to update.
2. Perform Q-028, TalkBack and launcher review when a physical Android device is
   available; record real device evidence separately from browser acceptance.
3. Use this release normally and address any reproduced defect narrowly. Treat
   deferred tooling maintenance and rereads as separate work, not unfinished
   product-evolution implementation.

Current references: [execution scope](PRODUCT-EVOLUTION.md),
[design state](DESIGN-STATE.md), [settled decisions](DECISIONS.md),
[upgrade/rollback](astra/RELEASE.md), [schema](SCHEMA.md),
[open questions](OPEN-QUESTIONS.md) and [chronology](progress.md).
The previous application release was `9ad1246` (Pages run 37048612948);
its detailed evidence remains in Git history/progress. Historical phase/design
documents yield to later settled decisions. Any rollback must retain DB-v3
compatibility and be validated against a disposable complete backup.
