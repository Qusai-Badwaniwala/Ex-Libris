# Historical alternate-frontend evaluation — 2026-09-19

The instructions below describe the original experiment, not the adopted
production build. The adopted app opens normal onboarding with no sample data,
uses near-black/slate dark mode and replaces Spines with Collection's Codex.
The canonical `../HANDOFF.md` records the current local/public URL and evidence.
Evaluation seeding exists only in explicit `--mode test` output, never a normal
build. The automated `tests/e2e/astra.spec.ts` uses disposable sample records.

## Original experiment instructions

Use the final normal preview on `http://localhost:4274/?evaluate` once the
handoff records it as running. Port 4284 is the automated engineering-test
server and is intentionally temporary. Port 5274 is development only.

Choose **Explore the sample library** to create actual local records, or choose
**Open existing library / start empty** for the real onboarding. The sample
does not overwrite a non-empty preview library. Preview storage is independent
of the deployed GitHub Pages application. No production data is read.

## A useful evaluation route

1. Open Reading, log a session by typing a destination, and reopen its record.
   Change publication and reading status separately. Unknown-total records
   deliberately show a position without a percentage.
2. Open Collection. Combine format, reading status, genres and sort. Open a
   record and return: the browsing context should remain. Try a format's Spines.
3. Open The Tombs of Atuan, then its series and universe. Inspect named reading
   orders, owned and missing entries, the starting point and editing controls.
4. Open Wishlist, try its random pick and begin a work. Add a title by hand;
   inspect the explicit shelf/unit/status choices, cover picker and metadata.
5. Open Notes. Edit a linked, pinned note; change attachments and tags. Type a
   new draft and use Back, then Keep editing. Save, delete to Trash and restore.
6. Inspect all seven reading-profile axes, including Translation. Ending stays
   locked until Finished. Matching explains the shared approved six axes.
7. Open Stats, then the menu's Settings, Catalogue index, Backup and restore,
   Trash and About. Inspect imports and export/restore review screens. A real
   optional production catalogue download is about 261MiB; it is not required
   to evaluate manual entry or your local sample library.
8. Repeat in both themes, at a narrow phone width and on desktop. Try keyboard
   navigation and reduced motion. A physical phone remains a separate test.

## Frontend coverage map

| Area              | Meaningful states and preserved paths                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Welcome/bookplate | First launch, required reader name, real spotlight onboarding and installation guidance                                                        |
| Reading           | Loading, empty library, active works, no active works, real position and session action                                                        |
| Collection        | Formats, five library status filters, genre Any/All, sorting, empty results, virtualized rows, return context                                  |
| Spines            | Existing format shelves, fixed/adaptive width key, virtualized large collection, record navigation                                             |
| Local search      | Works, Wishlist, authors, series, universes, notes and tags; no-results and catalogue explanation                                              |
| Add               | Explicit catalogue/manual doors; offline/no-index/manual fallback; exact candidates, format/status confirmation                                |
| Catalogue         | Manifest size, optional install, progress, interruption/resume, checksum, unavailable/retry, remove index                                      |
| Record            | Cover, metadata, progress, publication and reading statuses, genres/tags, axes, local matches, linked notes, relationships, removal/restore    |
| Session/finish    | Increments and typed destination, backwards/known-total bounds, reading-end transition, optional profile completion                            |
| Series/universe   | Truthful completion, missing entries, explicit additions, named orders, starting point, edit/rename/reorder/delete and failed-write rollback   |
| Notes             | Empty/feed/blank editor, plain text, multiple work links, pinning, seeded/custom tags, draft guard, failed-save retention, reversible deletion |
| Wishlist          | Empty/populated, explicit start/remove, random pick/re-roll and Back dismissal                                                                 |
| Stats             | Empty/populated, current/prior years, library figures, genre scopes, direct data labels, reused illustrations                                  |
| Settings          | Theme/system, reader name, install state, shelf defaults, section defaults, storage, tags, export and utilities                                |
| Backup/import     | Empty/history, automatic rotation, complete ZIP export/preview/restore, paste and mapped CSV review, errors                                    |
| Trash             | Works and notes, restore, explicit permanent deletion, thirty-day explanation                                                                  |
| About             | Bookplate, ownership/privacy and credits                                                                                                       |
| Cross-cutting     | Cold-start share, offline/reconnecting notices, delayed real-action feedback, focus, reduced motion, safe-area spacing                         |

## Verification interpretation

The baseline's 47 end-to-end journeys remain in the suite with presentation
selectors updated. Five additional Astra journeys cover note Back protection,
typed sessions, browsing context, sample overwrite refusal and a 32-state
layout matrix (four widths × two themes × four destinations). Unit coverage adds
a guard regression to the original 207 tests. Exact final counts and gate status
are recorded in `HANDOFF.md`; this map is not itself proof that every state was
manually visited.

Screenshots generated by tests live in ignored `.astra/review/`. They include
360, 412, 820 and 1440px layouts and existing specialised journey captures. Live
browser inspection complements assertions; screenshots alone are not the
deliverable.

Computed sRGB contrast ratios for the new central tokens: light primary 12.71,
secondary 5.77, muted 4.53 and action text 6.05; dark primary 13.97, secondary
8.52 and action text 7.17. These measure the named flat token pairs, not every
possible image, user-selected cover colour, disabled control or composited state.

## Limits to keep visible

- Real Android OPFS latency, native keyboard resize, physical safe areas,
  installed gestures and iOS installation have not been certified by emulation.
- The existing waiting-service-worker discovery issue remains a separate
  recommendation. Update data preservation is tested, not a new update prompt.
- Sample covers are typographic fallbacks, not licensed publisher covers. Real
  user cover upload and OPFS rendering remain supported.
- Original theme-specific illustrations are retained intact; some cool dark
  derivatives contrast deliberately with the new pine surfaces.
- Desktop Notes keeps a modal editor, not a permanently open split workspace.
  Existing routes/data remain simpler and mobile draft semantics stay consistent.
- Original inline styling still underlies some shared utility components. The
  alternate CSS is coherent for evaluation; adoption should consolidate these
  layers. The unused legacy Format component is retained pending that decision.
