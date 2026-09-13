# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One private reader uses an installed mobile PWA to track books, web novels and
manhwa. There are no public, administrative, social or multi-user roles.

## Product Purpose

Ex Libris keeps the reader's current reading life legible, resumable and safe on
their own device. It combines three formats without making the network,
catalogue or an account a prerequisite.

## Positioning

This is a personal library and reading record, not a recommendation feed or a
social bookshelf. The app offers metadata and relationships but the reader
confirms consequential choices such as format, status and grouping.

## Operating Context

The primary scene is one-handed phone use before, during or just after reading.
Frequent tasks are resuming a work, logging a page or chapter, finding a local
record, browsing a format shelf, adding a work and safeguarding local data.
Network access is explicit and optional.

## Capabilities and Constraints

- Formats are book, novel and manhwa; states are reading, caught up, finished,
  dropped and wishlist.
- Local library search and catalogue acquisition are separate experiences.
- The optional downloaded catalogue accelerates entry; manual entry and
  paste-list recovery remain available without it.
- User data stays on-device. There are no accounts, sync, telemetry, analytics,
  advertisements, notifications, paid services or hidden future costs.
- Every visible action must work, every count must be truthful, and every screen
  must carry honest loading, empty, error and offline states where relevant.
- Finished works remain fully legible. The app does not diminish completion or
  gamify reading.
- Android Back closes the uppermost sheet before the underlying screen.

## Brand Commitments

The product name is **Ex Libris**. Claude Design remains the visual identity and
is evolved rather than replaced. The approved light experience is warm and
editorial; the dark experience retains Claude's blue-grey character. The voice
is calm, literate and direct. User-facing language says **catalogue**.
The thirteen approved illustrations retain their source drawings and placements;
production derives a warm-light and blue-grey-dark palette from each source so
the artwork belongs in both themes without losing internal detail.

## Evidence on Hand

- Product, engineering and roadmap truth: `docs/`.
- Immutable visual authority and all thirteen approved illustrations: `design/`.
- Approved comparison evidence: `../design-experiments/`.
- Current implementation: `src/ui/`, `src/router/`, `src/styles/` and `src/db/`.

## Product Principles

1. The next useful reading action should be obvious within one glance.
2. Every feature and control must earn its place through a real reader task.
3. Common paths stay close to the thumb; depth appears progressively.
4. The app is explicit about uncertainty, offline limits and missing metadata.
5. Reader-authored data and choices outrank catalogue suggestions.
6. Perceptible asynchronous work is named after a short delay; instant work
   responds immediately and never flashes a decorative loader.

## Delivery Discipline

Use the smallest cohesive implementation that completes the active phase.
Prefer existing architecture and dependencies, inspect only relevant files,
batch related work, test proportionally, and stop at the documented phase
boundary. Avoid speculative features, unrelated refactors, repeated repository
discovery, and multi-agent work unless independent parallelism materially
improves correctness or completion time.

## Accessibility & Inclusion

Interactive targets are at least 44 CSS pixels. Keyboard behavior, visible
focus, accurate accessible names, non-colour state cues and reduced motion are
required. Layout and content must remain usable at a Pixel 7-sized viewport and
with long or missing text.
