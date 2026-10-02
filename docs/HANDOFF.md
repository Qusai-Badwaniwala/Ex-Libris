# Ex Libris — Reading Room live; EX identity revision

Updated 2026-10-02. Production checkout: `H:\Ex libris Project\Website`,
branch `master`; isolated implementation remains in `../Astra-Redesign`, branch
`astra/frontend-redesign`. The owner explicitly authorised commit, push
and GitHub Pages publication (E-111), including fixing the stuck onboarding tour
and subtle Add by hand selection. This supersedes earlier no-publication notes.
No prescriptive design skills. Preserve deployed data only; never import samples.

## EX identity revision · 2026-10-02

The owner rejected the folio launcher and asked for a large, minimally artistic
`EX` with both light and dark accent colours. The release uses a custom
vermilion-orange `E` and blue-grey `X` on a near-black square. Separate ordinary
and maskable SVG masters generate the existing 192px/512px icon filenames; the
toolbar and transient startup share the same vector. Light and dark screen
palettes, data, routes and functionality are unchanged. Native raster icons and
the local 390px header in both themes were visually inspected. The complete
`npm run gate` passed: formatting, lint, strict types, frozen-source checks,
220 unit tests, 60 browser journeys and normal build. The exact Pages-path
build uses `index-pwWpQDW9.js`, keeps the installation identity and 438,584-work
catalogue, and includes the header SVG in its 51-entry offline precache. The
192px ordinary and 512px maskable PNGs in `dist/` match their reviewed sources;
the ordinary icon SHA-256 is
`fd058db3484e990c1edd29601582590f67964e30d6a555c7e28af72509da2741`.
The Pages-path build was opened at 390x844 and the mark inspected in both
themes after activating the local waiting worker. This is browser evidence,
not physical Android launcher evidence. No library data was changed.

Application commit `e46cd28529c346393f0a066e3f6dbf8a7d35d70b` was pushed
normally to `master`. [Pages run 36998803870](https://github.com/Qusai-Badwaniwala/Ex-Libris/actions/runs/36998803870)
completed successfully. Public HTML serves the exact `index-pwWpQDW9.js` build
and the public 192px PNG hash matches the source above. In the live 390px
browser, the waiting worker activated, the new EX toolbar mark loaded, and the
pre-existing two library records remained. The public origin was not seeded or
edited. The icon's appearance in the owner's Android launcher itself remains
unverified; browser emulation cannot establish launcher refresh timing.

Next three actions:

1. On the phone, open Ex Libris online, accept the offered update after saving
   any active edit, then reopen the installed app. Do not clear site data to
   refresh its icon. If Android keeps a cached launcher image, make a complete
   backup before considering a reinstall.
2. If the owner dislikes the new mark on the physical launcher, compare an
   actual phone screenshot before changing scale or artwork again.
3. Measure deferred Q-028 catalogue latency and TalkBack behavior on an
   available physical Android device; both remain unpassed.

`http://127.0.0.1:4278/Ex-Libris/` currently hosts the exact release
(preview session 80694); stop it before another build.

The completed preceding release is recorded below.

## Preceding follow-up release · 2026-10-02

The owner showed that the Android launcher icon was too small and asked for a
new mark, broader catalogue discovery, and one-click series/world grouping.
The new folio-under-arch icon is generated from two vector masters into the
unchanged manifest filenames, with the old raster masters removed from
`public/`; the toolbar letter seal now uses the same mark. Light and dark
Reading Room screen palettes are unchanged. The online catalogue now offers a
reader-triggered, ten-result Open Library book lookup alongside the existing
MangaDex comics lookup, with both choices reachable above results on a phone.
The licensed 438,584-work offline catalogue is unchanged. Conservative series
suggestions appear whenever an ungrouped work is opened; a series page can
create or join a same-named, clearly reader-authored world in one tap. No data
migration or bulk catalogue acquisition was added. The shipped catalogue still
contains zero verified world rows.

The complete final-source `npm run gate` passed: formatting, lint, strict
types, frozen source checks, 220 unit tests, 60 production-mode Pixel 7 browser
journeys and normal build. The exact `/Ex-Libris/` build assembled and verified
all 273,784,832 original catalogue bytes. Its main JS is 606.47 kB (180.79 kB
gzip), optional Codex 526.45 kB (132.65 kB gzip), CSS 39.68 kB (8.80 kB
gzip); the offline shell precache is 51 entries / 15,876.65 KiB. A real
in-app-browser Open Library search returned ten Piranesi results; the final
Pages-path build was inspected at 390x844 in both themes, including catalogue
controls. This is browser evidence, not physical-phone evidence. Q-028 remains
deferred and unpassed. The old icon PNG masters remain available in Git history.

Application commit `3a11f3aaded212ea0c2592d7175b4b900bf455b0` was pushed
normally to `master`; [Pages run 36995073107](https://github.com/Qusai-Badwaniwala/Ex-Libris/actions/runs/36995073107)
completed successfully. Public HTML serves `index-D6zqd1zy.js`; the public
192px icon has the same SHA-256 as the reviewed local icon. Public manifest
scope and icon paths remain `/Ex-Libris/`. Public catalogue manifest remains
production, 438,584 works, SHA-256
`1d5c9eba8347481ab55db124378c15d1d6ac05264f7012160fc0954a0a7272c7`.
In a public 390px browser session, the waiting service-worker update activated
with the existing two library records intact. The new Open Library action
returned real results for Piranesi and the new folio toolbar mark rendered.
No public-origin records were added, removed or imported during verification.

Actions recorded for that preceding release:

1. On the phone, reopen Ex Libris online and accept the in-app update offer
   after any active edit is saved. Android may retain its old launcher artwork
   temporarily; do not clear site data to refresh it. Make a complete manual
   backup before any eventual reinstall.
2. Try book lookup with a known missing title and group a work via its record;
   a series page can create a reader-authored world in one tap. Unverified
   worlds and pure web-novel coverage remain honest limitations.
3. Measure deferred Q-028 catalogue latency and TalkBack behavior on an
   available physical Android device. Both remain unpassed.

Earlier local release preview:
`http://127.0.0.1:4278/Ex-Libris/` (session 60316, stopped). A preview must stop before
another build. A disposable first-run record exists only on the localhost
browser origin. `npm run gate` starts its own test-mode preview and restores the
ignored engineering fixture only inside that build; the normal release has no
evaluation data.

**Live:** https://qusai-badwaniwala.github.io/Ex-Libris/
Previous Reading Room application release: `4fa9e934eb75698f8eeaa3284cd0c0049a8ce548`.
GitHub Pages run [36963081036](https://github.com/Qusai-Badwaniwala/Ex-Libris/actions/runs/36963081036)
completed successfully. Both checkouts fast-forwarded from a218b8a; nothing was
reset or force-pushed. The production checkout's exact dependencies were installed.

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

Public HTML serves index-C2dMfdb1.js and index-DJYBSpXD.css, matching the reviewed
local Pages-path build. Public manifest retains name, scope, start URL, icons
and share target; production catalogue count/bytes/checksum match local output.
The browser initially ran the cached original frontend. Closing that public tab
and reopening activated the new worker and preserved both existing records,
their reading/finished statuses and completed onboarding. Live 390x844 Collection
and Codex were inspected with the new asset loaded and no captured runtime errors.

Next three actions:

1. The owner can use the live app. To upgrade the old installed build, open online,
   close all Ex Libris tabs and the installed app, then reopen. Do not clear site
   data or reinstall. Export a complete manual backup from the phone as normal.
2. If the owner reports a device-specific issue, reproduce the exact journey in
   the adopted frontend; do not restart the redesign or restore the old DB-v2 build.
3. Perform deferred Q-028 on an available physical Android device. It remains
   unpassed; no new implementation phase is waiting for approval.

Normal production preview: http://127.0.0.1:4275/Ex-Libris/ (exec 67419).
Set VITE_BASE_PATH=/Ex-Libris/ for both build and preview; omitting it from
preview serves HTML for nested JS URLs. CUA browser 1/tab 1 has a disposable
local review record. Stop preview before building. Older localhost tabs may have
stale workers. No phone data has been read, exported or altered. Public browser
inspection used its already-existing two-record library, without adding records.

See [adoption](astra/ADOPTION.md), [audit](astra/AUDIT.md),
[comparison](astra/COMPARISON.md), [upgrade/rollback](astra/RELEASE.md).
Historical prototype docs are marked as such. A presentation rollback must
retain DB-v3 compatibility; do not simply redeploy the DB-v2 binary.
Q-028 physical Android catalogue latency and physical TalkBack review remain
unpassed. The refreshed 2026-10-02 audit reports zero production vulnerabilities
and five development-only entries (one high, three moderate, one low); details
and the deferred tooling maintenance are recorded in RELEASE and AUDIT.
