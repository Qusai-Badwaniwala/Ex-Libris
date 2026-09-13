# Ex Libris approved execution plan

Approved by the owner on 2026-09-06. This is the durable Phase 3–10 sequence.
It evolves the current PWA; it is not permission to rebuild or reinterpret the
approved Claude Design. `HANDOFF.md` records live status, `DECISIONS.md` records
settled choices, and this file records the intended order and phase boundaries.

## Design contract

- Claude Design remains the foundation: onboarding, constellation, dark
  palette, drawer, FAB, sheets, Wishlist, Surprise Me, Trash, personal reading
  moments, illustrations, and motion language.
- Registered Index (Concept B) supplies editorial hierarchy, controlled colour,
  typography roles, catalogue presentation, metadata grids, filters, and
  information-heavy screens.
- Night Route (Concept A) contributes only functional progress paths, shelf
  markers, reading-state indicators, and meaningful transitions.
- Light mode remains warm cream with restrained accents. Dark mode retains
  Claude Design's blue-grey palette.
- Sansita is expressive display type, Montserrat Alternates is functional UI,
  and Taviraj is notes and reading copy.
- Every visible control, number, screen, state, and decoration must serve a
  useful and expected reader task. No inert control, duplicate search, dummy
  content, ornamental statistic, or empty placeholder screen ships.
- `design/`, `src/styles/tokens.css`, and `src/data/taxonomy.json` remain
  immutable.

## Illustration contract

All thirteen approved Claude illustrations keep their artwork, internal detail,
and placement. On 2026-09-07 the owner superseded the earlier single-palette
rule after seeing that some illustrations belonged only to one theme. The
immutable sources remain unchanged; production uses deterministic warm-light
and blue-grey-dark derivatives that preserve lightness and colour distinctions.
`magic-tree-cuate` remains unchanged in both themes.

| Illustration           | Approved placement       |
| ---------------------- | ------------------------ |
| `magic-tree-cuate`     | Bookplate and About      |
| `dragon-rafiki`        | Completely empty library |
| `library-pana`         | Catalogue index/download |
| `cherry-tree-pana`     | Finish moment            |
| `knowledge-rafiki`     | Stats opening plate      |
| `cherry-tree-amico`    | Stats year divider       |
| `cherry-blossom-cuate` | Empty Wishlist           |
| `research-paper-amico` | Empty Notes              |
| `studying-bro`         | Blank note editor        |
| `library-rafiki`       | Empty format shelf       |
| `bibliophile-rafiki`   | No search results        |
| `bibliophile-bro`      | Empty Trash              |
| `bibliophile-pana`     | Backup with no history   |

Use at most one illustration per screen. Illustrations belong only to their
approved first-run, empty, finish, Stats, or blank-editor states—not ordinary
populated screens or navigation chrome. Only the finish moment and blank note
editor may place low-opacity art behind content. Do not hand-edit the immutable
or derived SVGs; regenerate variants through
`scripts/generate-illustration-themes.ts`.

## Approved screen integration for Phase 4 and later

- Preserve Welcome and Bookplate, then restore the complete spotlight tour over
  the real Home screen.
- Keep Home's top local search, theme controls, drawer trigger, constellation,
  and FAB. Continue becomes a cover-led hero backed by a real library record;
  further active works may form a compact secondary queue.
- Empty Home uses the approved empty-library illustration and real Add/Wishlist
  routes, never dummy books.
- Books, Novels, and Manhwa always retain a three-spine identity marker. Real
  cover-derived colours may populate it; the structural marker remains when
  empty.
- Everything adopts Registered Index hierarchy while retaining real sorting,
  format handling, genre Any/All filtering, and all 242 frozen tags.
- Preserve collapsible list and spine views on format shelves and Claude's
  cover-led work-detail/edit flow; improve only within the approved hierarchy.
- Home search remains local-library search. **Search online** deliberately
  transfers a query into catalogue acquisition rather than duplicating search.
- Preserve the FAB's shape, location, bloom, haptics, Add by hand card, and
  underlying Add by hand / Search catalogue actions.
- Preserve the drawer and add a working Catalogue index destination.
- Replace the glass bottom pill with the approved four-zone editorial dock,
  keeping Library, Wishlist, Stats, and Settings and a tactile active marker.
- Preserve Wishlist, Surprise Me, Trash, Notes' floating pencil/editor card,
  and the illustration placement contract.
- Stats becomes an honest editorial register; Settings, Backup, and About use
  quiet dossier layouts containing only functional rows and truthful states.

## Execution sequence

### Phase 3 — Catalogue runtime, alone

- Build the bounded production Open Library/Wikidata catalogue; AniList and
  MangaDex bulk rows remain engineering fixtures only.
- Verify checksum failure, retry, interruption/resume, offline restart, manual
  fallback, service-worker replacement, and catalogue exclusion from Workbox.
- Measure the real worker/OPFS path on physical mid-range Android below 50 ms
  from input event to painted results.
- Pass `npm run gate`, host the production build on port 4173, update durable
  docs, and stop before Phase 4.

Current status: the production 438,584-work / 261.1-MiB index, runtime journeys,
full gate, hosted install, search, and phone-size visual checks are complete.
Q-028's physical Android measurement is the only remaining Phase 3 gate.

### Phase 4 — Metadata, covers, and visual foundation, alone

Before changing production UI, build and host an isolated clickable approval
prototype on port 4184 containing Home, Everything/format shelf, work detail,
and hybrid navigation/drawer in warm light and preserved Claude dark themes.
Production work starts only after exact visual approval.

Then establish the unified component language; restore spotlight onboarding;
implement persistent shelf markers and the approved bottom dock; build metadata
clients and the OPFS cover pipeline; downscale covers to about 600 px wide while
preserving aspect ratio; add custom-cover select/preview/replace/remove; and
build the cover-led Home hero and upgraded detail facts. Preserve FAB, Add by
hand, search separation, illustrations, and constellation. Gate, host, document,
and stop.

Current status: the Phase 4 checkpoint passed its full gate and was accepted for
sequencing. The later owner-requested dual-theme illustration variants and
perceptible-operation feedback also passed the 2026-09-08 Phase 5 full gate.

### Phase 5 — Series and universes

Build conservative suggest-and-confirm series/universe resolution, series and
universe pages, truthful completion rings, multiple named reading orders, and
the approved starting-point warning. Never silently apply detected
relationships. Gate, host, document, and reassess whether any later phases are
small enough to pair.

Current status: **accepted for sequencing**.
Exact catalogue lookup, conservative resolution, explicit transactional
confirmation, ghost publication orders, rollback-safe missing-series Wishlist
addition, completion facts, series/universe screens, manual relationship editing,
post-add confirmation, multiple named-order editing, and the separate universe
starting point are implemented. Focused Phase 5 journeys and the full 170-unit /
30-E2E gate pass; light/dark Pixel 7 states were inspected; the exact build is
hosted on 4173. The current production catalogue has zero verified universes, so
no Add-whole-universe action may appear until real complete membership evidence
exists. The owner approved an exact-title preflight for bulk Wishlist addition;
that focused journey passes. The owner then explicitly authorized Phase 6.

### Phase 6 — Axes and matching

Build reading axes, finish flow, ending handling, and explainable More Like
This. Use Night Route's journey motif only where it communicates progress or a
relationship. Preserve Claude's finish moment and illustration. Gate, host,
document, and stop unless an approved pair was announced first.

Current status: **accepted for sequencing**. The owner settled Q-017:
Translation always appears as the seventh editing step, while matching remains
the approved six-axis calculation. Axis persistence and UI, the finish moment,
`endingNone`, the Detail profile, direct named-axis editing, and explainable
local-library matching are integrated. Focused tests, Pixel 7 light/dark review,
the 178-unit / 33-E2E full gate, exact-build hosting on 4173, and durable
documentation passed before the owner authorized Phase 7.

### Phase 7 — Notes

Complete notes, work links, pinning, tags, attachments, and cross-search.
Upgrade hierarchy while retaining the floating pencil and editor card. Restore
the empty Notes and blank-editor illustration states. Deleting a work only
unlinks its notes. Gate, host, and document.

Current status: **accepted for sequencing**. The owner
accepted Phase 6 for sequencing and explicitly authorized Phase 7 on 2026-09-08.
Transactional multi-work links and attached-work pills, pinned ordering, seeded
and custom tags, Detail presence, cross-search, note Trash/restore/purge, themed
empty/editor illustrations, and delayed feedback are integrated. The focused
journeys, Pixel 7 light/dark review, 181-unit / 36-E2E full gate, exact-build
hosting on 4173, and durable documentation passed. The owner authorized Phase 8
on 2026-09-08.

### Phase 8 — Data safety

Build automatic backup rotation, ZIP export, restore, paste-list import, CSV
mapping, and share target. Include user covers in every export/import/restore/
reset/deletion path. Show the approved empty Backup illustration. Every import
is transactional and shows a preview before writing. Gate, host, and document.

Current status: **accepted for sequencing**. Automatic
OPFS rotation, complete ZIP export/restore with user-cover fidelity, merge and
replace previews, paste-list and mapped-CSV confirmation, and the cold-start
share target are integrated. Focused checks, explicit Pixel 7 light/dark review,
the 189-unit / 40-E2E full gate, exact-build hosting on 4173, and durable
documentation passed on 2026-09-12. The owner accepted that checkpoint and
authorized Phase 9.

### Phase 9 — Stats and spine view

Build complete truthful Stats and Home summaries. Finish virtualized spine view
and adaptive width buckets. Retain both Stats illustrations. Verify 60 fps at
the expected library size. Gate, host, and document.

Current status: **accepted for sequencing**. The truthful
editorial Stats register, existing truthful Home summaries, approved dual-theme
Stats illustrations, adaptive per-unit width ladders with fixed small-library
fallback, row virtualization, and tapped-cover transitions are integrated.
Focused tests and Pixel 7 light/dark review passed; the complete gate and exact
build evidence are recorded in `HANDOFF.md`. The owner authorized Phase 10 on
2026-09-13.

### Phase 10 — Final polish

Complete Settings and About. Audit every action, state, animation, and
navigation path. Verify loading, empty, error, offline, long-content, keyboard,
reduced-motion, service-worker, and both-theme behavior. Re-run performance
budgets and physical-device checks. Host the release candidate and complete the
final handoff.

Current status: **accepted; public phone-release preparation authorized**.
Settings and About are complete, the final interaction/accessibility audit
passed, and Q-008 has explicit transactional rename/merge/delete maintenance
without similarity suggestions. The owner supplied the final app icon and
requested a working Settings installation state plus a final onboarding step
before public GitHub Pages publication. This is a bounded release extension to
Phase 10, not Phase 11. Q-028 remains a deferred, explicitly unpassed
physical-device check; emulation does not satisfy it.

## Hosting, pairing, and completion rules

- During active frontend work, host Vite with network access on port 5173.
- The isolated Phase 4 approval prototype uses port 4184.
- Stop this repository's dev/preview listener before a gate or production
  build, then host the verified production preview on port 4173.
- Keep `HANDOFF.md`, `progress.md`, `DECISIONS.md`, `OPEN-QUESTIONS.md`,
  `SCHEMA.md`, and `PIPELINE-NOTES.md` current whenever their subject changes.
- Phases 3 and 4 run alone. Later phases may pair only if both have no external
  gate, major migration, new dependency, or new data source and both fit one
  normal session. Announce the exact pair first and retain separate test/doc
  checkpoints.
- Stop after every completed single phase or approved pair for owner review.

A phase is complete only when `npm run gate` passes without weakening or
skipping checks, relevant Pixel 7 light/dark states are visually inspected,
every visible action is functional and accessible, storage failures visibly
roll back, manual entry remains available, the verified build is hosted, and
durable documentation states only observed facts.

## Efficiency rule for remaining phases

Use the shortest safe path to a complete phase. Prefer current architecture and
components; do not expand scope, refactor working systems, research unnecessary
alternatives, or add speculative infrastructure. Read only the durable handoff
and relevant files, batch cohesive work, run targeted checks before the gate,
delegate only genuinely independent work, and stop when the phase definition of
done is met.
