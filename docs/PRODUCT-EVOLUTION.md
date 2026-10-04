# Ex Libris — Product evolution with app-wide motion

Approved for implementation and publication by the owner on 2026-10-04.
This is an evolution of the released Reading Room, not another prototype or
an architecture/identity replacement. All six approval boundaries from the
audit are covered. The full user-approved plan is the execution scope.

## Execution order

1. **Recovery and write safety:** shared OPFS probe, abort failed binary writes,
   atomic work edits, handled status/genre failures, complete restore validation,
   explicit collisions and verified safety copies, actionable retained snapshots,
   inactive-slot catalogue repair, compatible concurrent readers, reversible
   Wishlist removal.
2. **Continuity and motion foundations:** pinned free MIT Motion 14.0.0,
   LazyMotion/m, shared reviewed presets, interruptible presence, immediate
   navigation, search/catalogue/group/import context, modal focus and draft
   protection including multi-client updates. Native cover/add transitions stay.
3. **Record and secondary screens:** Detail priorities and attached notes,
   read-only session history, short-phone headers, world descriptions and honest
   sections, long note titles, local-current-year pages/chapters, Trash, restore
   hierarchy, truthful persistence and release identification. Committed progress,
   reorder, Notes, Wishlist and Stats receive deliberate motion.
4. **Runtime and release:** archive worker, unused originals excluded from
   precache, actual bundle/performance measurement, reproducible CI correctness
   checks, normal Pages artifact, durable handoff, commit/push/publication and
   deployed verification.

## Motion contract

CSS owns simple colour/press feedback; Motion owns presence, springs and bounded
layout; native View Transitions own cover/add continuity. Theme uses a brief CSS
colour handoff to preserve immediate live input (E-122). Three.js stays confined
to the optional Codex. One owner per property.
No animation delays navigation or data commits. Exiting content is immediately
inert and releases its trap. Reduced motion renders the final state without
stagger or waiting. Native scroll/virtualisation and restored positions survive.
No ambient motion, scroll theatre, heavy blur, confetti, or idle GPU work.

Every meaningful screen gets appropriate treatment: startup/onboarding,
primary/drill-down navigation, Reading, Collection/Codex, local/catalogue search,
Detail/disclosures, sheets/FAB/forms, session/finish/axes, groups/orders,
Wishlist/Surprise, Notes, Stats, backup/import/restore, Settings/Tags/Trash and
About/theme. Frequent tasks remain immediately usable. Timings use the maintained
120–260ms range with up to 320ms for larger spring surfaces. Animation code
targets at most 40KiB additional gzip, measured against the original build.

## Preservation and verification

Keep IDs, schema 2 archives and DB-v3 compatibility, incoming-backup precedence,
field rules, private offline model, typography/palette/artwork, relationship
semantics and Codex renderer. No paid services, accounts, telemetry, providers,
bulk acquisition, automatic edition merge, rereads or session editing.

Each cohesive pass requires the unweakened full gate and real browser review.
New regressions must fail with the defect restored, then pass with the fix.
Phone/tablet/desktop, light/dark, long/empty/populated, focus/back/drafts,
reduced motion, offline/cache updates, large-cover archives and 500-work Codex
are release validation. Physical Android/TalkBack/launcher evidence remains
separate when hardware is unavailable.

## Current checkpoint

Pass 1 complete; focused storage/recovery checks pass (27 tests). Twelve
assertions failed when the preceding defects were temporarily restored, then
all passed with the fixes. Full gate passed: 232 unit tests, 60 E2E journeys,
format/lint/types/frozen checks and normal build. Real snapshot review/collisions
were inspected at desktop and 390×844 in both themes on 4291. Codex measured
60.0fps, five mounted rows. Preview stopped before the next build.
Pass 2 complete: 237 unit / 64 E2E full gate and normal build passed. Phone
light/dark sheets, acquisition, draft dismissal and local SW activation inspected
on 4291, then preview stopped. Codex 60.0fps/five rows/exact restored top 68186.
**All four passes are complete and published.** Application commit
`53fa87dcd6cfe307e2f3c9f17ed0de5d340ff0d0` passed the full GitHub gate,
normal Pages build, licensed catalogue assembly and exact release checks in
[successful run 37187502145](https://github.com/Qusai-Badwaniwala/Ex-Libris/actions/runs/37187502145).
The local final gate passed 252 unit / 73 E2E, including rapid theme input.
Theme-capture and tablet-indicator regressions failed with defects restored,
then passed with their fixes. The live waiting-worker update retained both
existing browser works and preferences; Settings shows Build `53fa87dc`.
Public entry/CSS are `index-DiZDPZr2.js` / `index-ov2LJl_S.css`, matching the
exact local Pages build byte for byte. No localhost fiction was transferred.

Phone/tablet/desktop hierarchy and sequential journeys were inspected in both
themes. Codex remains 60.0fps/five rows with exact restored top 68186. The 16 MiB
archive exercise preserved both cover digests with no observed main-thread long
task. Archive work runs off-thread; both offline illustration themes remain,
with 38 entries in the final Pages precache (41 in the root build), formerly 53.
Motion's measured attribution is 42.8 KiB gzip, 2.8 KiB above target; unsupported
private imports were rejected. Physical Android latency, TalkBack and launcher
review remain explicitly unpassed; they are separate device checks. The
[canonical handoff](HANDOFF.md) records exact measurements and update instructions.
