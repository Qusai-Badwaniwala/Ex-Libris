# Ex Libris — Reading Room release preparation

Updated 2026-10-02. Active checkout: `H:\Ex libris Project\Astra-Redesign`,
branch `astra/frontend-redesign`. The owner explicitly authorised commit, push
and GitHub Pages publication (E-111), including fixing the stuck onboarding tour
and subtle Add by hand selection. This supersedes earlier no-publication notes.
No prescriptive design skills. Preserve deployed data only; never import samples.

## Implemented

Approved light Reading Room design retained; near-black/slate dark mode;
all thirteen illustration derivatives corrected; consolidated runtime tokens and
two self-hosted fonts; optional Three.js Codex; Spines retired. Central relationship
queries, series/world pages and a transactional organiser separate membership
from optional named reading orders. Legacy conflicts remain for reader review.

Replayable introduction, bounded tour controls, accent/checkmark selections and
keyboard segments are complete. Notes/organisation protect dirty drafts.
Session logging is atomic and serialized; settings publish after commit.
Destructive group operations and replacement restore require a complete newly
verified safety ZIP with covers. Waiting-worker updates defer during editing,
writes, background backup and catalogue installation.

Append-only DB migration 3 retires view preferences only. Existing IDs, library,
onboarding completion, OPFS covers and backup schema 2 remain compatible.
Original origin, /Ex-Libris/ path, icons, install/share contracts are preserved.
Normal output excludes all evaluation seed data and engineering test bridges.

## Verification checkpoint

The final `npm run gate` passed on 2026-09-21 (exec 69374): formatting, lint,
strict types, frozen-source integrity, all 218 unit tests, all 58 browser journeys
and the final normal build. Earlier focused runs verified migration/old backup,
failed writes, legacy conflicts, organiser, both-theme forms, all-artwork loads,
500-work Codex, idle/GPU-loss fallback, scroll restoration and enlarged text.

The tour regression measured controls at 948.7px in a 640px viewport before the
fix; it passes all six steps after correction. Restoring the old unmarked selected
style failed the new selection assertion; restored source hash matches the gate
(components.tsx SHA256 C1E09FEC4D35F449E3A24EF6A2E225DC9D59E27E7687ECC1FA65948B2EF4CDE9).
Session transaction, stale/Trash
membership and settings-held-write regressions were observed failing with their
defects restored and passing with the fixes. Three.js optimisation improved the
same desktop-emulated 500-work sweep from 22.7 to approximately 57–60fps with at
most five mounted rows. This is not physical Android evidence.

## Environment and next actions

The exact normal Pages-path build was inspected on 2026-10-02 at 360x640 and
390x844: first-run Bookplate/tour, all six tour steps including the scrolled
install target, light replay, explicit manual selections, saved record,
Collection/Codex in both themes, and Codex-to-record navigation. No captured
runtime errors. Local review records are disposable and never exported to Pages.

Final Pages-path build: main JS 602.94kB / 179.72kB gzip; lazy Codex JS 526.45kB /
132.65kB gzip; CSS 39.48kB / 8.77kB gzip; two font files total 138.82kB. The
49-entry offline shell precache is 15871.51KiB, excluding the catalogue. Codex
code is parsed on demand but precached for offline use. These are build sizes,
not phone timings. Evaluation launcher and test bridges are absent from runtime
JS. The production catalogue assembled with full checksum verification:
438,584 works, 273,784,832 bytes, SHA256
1d5c9eba8347481ab55db124378c15d1d6ac05264f7012160fc0954a0a7272c7.

1. Format changed docs, stage reviewed named files and commit.
   Production checkout ../Website is clean at a218b8a; verify
   origin/master again before a normal fast-forward push through existing Pages.
2. Monitor deployment and verify the public assets/manifest/UI.
3. Record the release SHA/run URL in the handoff and publication log.

Normal production preview: http://127.0.0.1:4275/Ex-Libris/ (exec 67419).
Set VITE_BASE_PATH=/Ex-Libris/ for both build and preview; omitting it from
preview serves HTML for nested JS URLs. CUA browser 1/tab 1 has a disposable
local review record. Stop preview before building. Older localhost tabs may have
stale workers. No phone data has been read, exported or altered.
The latest published Pages run is 34747574260, before adoption.

See [adoption](astra/ADOPTION.md), [audit](astra/AUDIT.md),
[comparison](astra/COMPARISON.md), [upgrade/rollback](astra/RELEASE.md).
Historical prototype docs are marked as such. A presentation rollback must
retain DB-v3 compatibility; do not simply redeploy the DB-v2 binary.
Q-028 physical Android catalogue latency and physical TalkBack review remain
unpassed. Development-only Vitest/mocker advisories are recorded in RELEASE.
