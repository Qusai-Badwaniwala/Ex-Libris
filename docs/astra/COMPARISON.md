# Original Ex Libris versus adopted Reading Room

These are design judgments, not a claim that the alternative wins everywhere.
The original is production baseline `a218b8a`; the adopted direction includes
the owner's near-black/slate correction, Codex and rebuilt relationships.
Verification and publication evidence live in the canonical HANDOFF.

| Area              | Original                                                                            | Adopted experience and tradeoff                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visual identity   | Illustrated bookplate, ornate type and shelf personality.                           | Quieter editorial reading room, Literata and Source Sans 3. Less decorative charm; more room for long titles.                                                       |
| Usability         | Familiar to its owner, compact controls and distributed entry points.               | Direct session destination, explicit selected choices and protected note/organisation drafts. The new layout still takes relearning.                                |
| Navigation        | Settings in primary navigation; Notes in the drawer.                                | Notes becomes primary, utilities move to Menu; Settings needs an extra tap. Reading opens first, with Collection beside it.                                         |
| Hierarchy         | Several summaries and format shelves compete with the current work.                 | The active title, position and logging lead; Collection consolidates browsing. Less overview appears immediately.                                                   |
| Reading/library   | Separate format screens and compact length-encoding spines.                         | One filtered Index and optional cover-facing Codex; series/worlds have continuous sections. Length encoding is deliberately removed at the owner's request.         |
| Discoverability   | Familiar gestures, some small actions.                                              | Explicit axes, statuses, local search and clearly scoped catalogue lookup. Filters remain dense for a new reader.                                                   |
| Interaction       | Strong transactional flows and Android Back handling.                               | Reuses those foundations, adds draft decisions, direct session entry and safe update offers. These guards add maintenance responsibilities.                         |
| Phone ergonomics  | Compact expressive screens with some small targets.                                 | Reachable Add action, larger controls, and bounded tour actions. Larger typography requires more scrolling.                                                         |
| Motion            | Coherent cover transitions, tactile feedback, theatrical startup.                   | Useful continuity, restrained sheets and no forced boot wait. Less expressive arrival. Codex is static when idle.                                                   |
| Light theme       | Cream and warm illustration derivatives.                                            | Approved mineral paper/vermilion identity retained, with corrected theme artwork. The original warmth may suit some drawings better.                                |
| Dark theme        | Blue-grey visual world and artwork.                                                 | Near-black/charcoal surfaces with the original slate accent family. It is intentionally darker, with smoked wood only inside Codex.                                 |
| Responsive layout | Mostly the phone composition widened.                                               | Wide-screen rail, columns, bounded utilities and sticky detail summary. More responsive CSS to maintain.                                                            |
| Performance       | Proven virtualized spines, eager screen bundle and many font files.                 | Two font files, optional separately loaded Three.js, bounded shelf rows and zero idle frames. Codex adds download/GPU cost; Index remains cheaper.                  |
| Accessibility     | Existing semantics, focus and reduced motion.                                       | Real record headings, stronger selection with checkmarks, keyboard segments and reachable tour actions. Physical TalkBack review remains outstanding.               |
| Relationships     | Screens assembled overlapping series/world memberships; orders mixed with browsing. | Shared graph queries, inheritance rules, explicit named orders and a transactional organiser. Historical conflicts still need reader reconciliation.                |
| Implementation    | Stable accepted architecture and familiar behaviour.                                | Same local storage/backend contracts with append-only migration 3; complete frontend replacement and focused data hardening. Rollback must retain v3 compatibility. |
| Maintainability   | Stable canonical design but many inline decisions.                                  | One maintained runtime token system and a shared relationship reader. Three.js and new organiser/update guards increase complexity.                                 |

The original remains stronger in decorative warmth, compact length comparison,
familiarity and the simplicity of its shelf renderer. Codex is an optional
experiential view, not the fastest way to find a title. The organiser's previews
cost an extra confirmation but make moves, merges and deletion understandable.

Observed 500-work desktop-emulated sweeps after instancing measured approximately
57–60 fps with at most five mounted rows; idle frames and GPU-loss fallback passed.
These are not physical-phone measurements. Q-028 remains unpassed.

The initial isolated experiment's bundle measurements are historical, not release
measurements. The final normal build's sizes are recorded in HANDOFF after its
gate. Source SVGs, historical tokens and the original design package remain
unchanged; only theme derivatives and the active runtime are adopted.
