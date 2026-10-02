# Historical Astra prototype handoff — 2026-09-19

This file preserves the pre-adoption experiment. Its authority and runtime URLs
are superseded by `../HANDOFF.md`, `ADOPTION.md` and owner decision E-111.
Do not follow the old no-deployment or sample-launcher instructions as current.

This experiment is approved for implementation, not adoption or deployment.
Production remains in `../Website`, untouched at `a218b8a` on `master`.
This checkout is `../Astra-Redesign`, branch `astra/frontend-redesign`.

The approved direction is **The Reading Room**: mineral daylight, pine-charcoal
night, a vermilion action colour, Literata titles and Source Sans 3 controls.
Creative direction comes from Astra's reasoning; no prescriptive design skill
is used. Existing illustrations, on-device data contracts, catalogue worker,
repository operations, backups, and history semantics remain the foundation.

Phone navigation: Library, Wishlist, central Add (Write in Notes), Notes, Stats.
Library offers Reading and Collection. Utilities live in the persistent menu.
All meaningful screens and journeys must be implemented and evaluated before
delivery. The working app is the prototype, not a separate mock data renderer.

Preview target: localhost:4274; development:5274; isolated E2E:4284.
Never run builds while a server is serving this checkout. Never publish, push,
merge, or modify the production checkout as part of this experiment.

Current state (2026-09-20): the complete route set is implemented and navigable.
New shell, fonts, intentional light/dark tokens, Reading, Collection, Wishlist,
Notes, Stats, onboarding, detail composition, named axis profile, shared sheets,
direct session input, note-draft Back protection and explicit `?evaluate` sample
launcher are integrated. Existing utility, import/restore, catalogue, series,
universe, cover, profile and deletion workflows use the same real operations.
The launcher transactionally creates real on-device records and refuses to
overwrite a non-empty preview library. It is separate from ordinary app flows.

The final `npm run gate` PASSED (exec session 94430, exit 0): formatting, lint,
strict TypeScript, frozen-token/structural checks, 208 unit tests, all 52 E2E
journeys (3.1 minutes), and a normal production build. It includes the final
Detail contrast correction, Wishlist modal focus handling and session/Wishlist
failure messages. No checks were skipped or weakened. The extra centralized
Astra token file is the only added literal-allowlisted source file.

The normal build is RUNNING at **http://localhost:4274/**, preview session 47295.
The evaluation launcher is **http://localhost:4274/?evaluate**. A sample library
has been opened in the Codex preview browser; its first book is now on page 150
after the final real session check, and Books is set to open in Spines. Other
browsers have their own storage and can choose the sample or genuine first run.
Restart command: `npm run preview -- --port 4274 --strictPort` from this checkout.
Stop this preview before any future build. Do not reuse it for test-mode E2E.

Exact final output: `index-CnHDj91O.js` 597,238 bytes (177.00kB gzip), CSS
`index-CkKzicFN.css` 36,493 bytes (8.50kB gzip); two fonts total 138.82kB;
evaluation chunk 5.47kB (2.22kB gzip). Precache 52 entries / 15,347.88KiB.
The large-chunk and redundant dates dynamic-import warnings remain; they are
not hidden or described as performance wins. Worker and WASM are unchanged.

Observed live browser checks include Reading at 412×915 both themes, Collection
and linked Detail in dark, Notes editing and draft protection, 390×844 optimized
build note editor with full-width bottom Save, Settings light, series/universe
dark, and 1440px Reading/Stats. Test captures cover 360/412/820/1440 in both
themes and specialised workflows. Full suite includes real catalogue OPFS
install/resume/offline/update paths, all original 47 journeys and five Astra
journeys. The 500-work spine test passed its >=55fps / <=13-row criteria.

The note-guard unit regression was deliberately broken: 1 failed/14 passed;
restoring the guard returned 15/15. A consecutive-detail suggestion state leak
was reproduced by the relationship E2E and fixed by keying Detail by work ID.
An inline `all: unset` required explicit CSS priority for the persistent Save
and Detail session actions. Formatting during dev HMR briefly loaded an empty
stylesheet; optimized-build testing avoids treating that transient as a product
result. The dev server on 5274 is stopped.

Local setup: `npm ci` needed elevated execution because sandbox process spawn
was blocked. The optional production catalogue was assembled from existing
release chunks, checksum verified, and copied into this checkout's ignored
`public/corpus`. Test inputs were copied read-only from Website's ignored cache:
AniList works + relations and MangaDex works. They remain test-only; the normal
build distribution guard excludes the restricted fixture. No new acquisition.

Docs: DESIGN.md describes the visual/interaction system and migration;
EVALUATION.md maps all meaningful journeys; AUDIT.md prioritizes current-app
findings; COMPARISON.md includes tradeoffs and measured build sizes.

Final exact-build browser review (2026-09-20): 390×844 Detail light/dark, a real
typed session persisted from 146 to 150, Settings -> Books default Spines ->
actual spine shelf, and 1440×1000 dark Notes editor. Desktop panel measured
top 24 / bottom 976, with Save fully inside at y917–961. The final dark session
action measured 204×44px with the intended coral background and dark text.
Console warning/error log was empty. The browser was returned to light Reading
and marked as the deliverable. The deployed production app was also re-opened
read-only and remains available with its original frontend.

Next three actions belong to evaluation, not unfinished implementation: owner
reviews the complete alternate frontend; decide whether to adopt or revise it;
only then plan a scoped migration and separately approve production audit fixes.
Physical Android Q-028 remains explicitly unpassed. No production files changed,
commit, push, merge or deployment. Production is still clean at a218b8a.
