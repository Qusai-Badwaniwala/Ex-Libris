# Astra experiment record

## 2026-09-14 to 2026-09-19

Owner approved a complete isolated alternate frontend after the initial design
review, with no prescriptive design skills. The production checkout and frozen
design package were preserved. The Reading Room direction uses a new shell,
Literata/Source Sans 3, mineral daylight/pine night themes and real existing
routes and repository operations. Only OFL font packages were added.

Rebuilt Reading, Collection, Wishlist, Notes, Stats and onboarding; recomposed
Detail, named profile axes, sheets and responsive utility pages. Reused original
illustrations and theme derivatives. Added direct session destination and dirty
note dismissal protection. Kept separate local search and catalogue acquisition,
real reading orders, matching, import/restore, installation and offline paths.
The `?evaluate` launcher seeds real records into the preview origin only.

Verification found and corrected: a full-height desktop note panel extending
above the viewport; `all: unset` suppressing alternate action styles; stale
relationship-offer state when entering another Detail without unmounting; missing
shelf-default routing in the new Home; ambiguous old test selectors after adding
semantic headings and cover titles. Failed browser assertions were diagnosed,
not waived. Existing test-fixture data was copied locally, including relationship
rows required to retain its exact byte-size contract.

The note-dismissal regression was observed failing with the guard deliberately
disabled and passing after restoration. A full gate reached 208 unit / 52 E2E
passes and a normal production build; final CSS/focus/error-handling corrections
triggered another complete gate. Consult HANDOFF.md for that final result.

Rejected approaches: no isolated mock renderer, new backend, animation package,
new feature service, regenerated artwork, forced audit upgrade, production edits,
phase approvals or deployment. Desktop Notes uses the existing real modal draft
boundary instead of introducing a persistent split-editor state model. The
historical Format component remains unused rather than being removed before an
adoption decision.

Reports and migration notes live only under `docs/astra`. The current-app audit
is independent of the alternate frontend. Physical Android performance and the
existing waiting-worker update-discovery gap remain explicitly unresolved.

## 2026-09-20 final handoff

The final repeat gate passed all 208 unit and 52 E2E tests and the normal build.
Hosted on localhost:4274, manually checked at 390×844 in both themes and at
1440×1000, including the corrected session action and editor geometry. A real
session save and saved shelf preference were exercised. Console errors/warnings
were empty. Production remained clean; no commit, push or deployment occurred.
