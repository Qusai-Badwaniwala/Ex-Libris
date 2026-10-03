# Reading Room adoption

The owner approved the complete adoption on 2026-09-20 and authorised commit,
push and publication on 2026-09-21 (E-111). The implementation was adopted from
`astra/frontend-redesign` into `master` and is publicly released through the existing Pages workflow.
Exact verification and publication status is in `../HANDOFF.md`.
Only deployed-app data is retained. Localhost samples never enter release.
No prescriptive design skills were used.

## Adopted experience

The approved light compositions, Literata/Source Sans 3 typography and mineral
paper/vermilion palette remain. Dark uses near-black/charcoal surfaces and the
original slate accent family centred on #8FA3C4. All thirteen illustrations
have reproducible light/dark derivatives with preserved tonal distinctions;
source SVGs and the historical design package remain untouched.

Reading opens first. Collection defaults to Index; Codex is an optional vertical
cabinet with series/world sections and front-facing covers. Wishlist works and
catalogue ghosts remain outside owned shelves. Spines and width calculations
are removed. Notes, Wishlist, Stats, search, catalogue, all record editors,
backups, imports, Trash, Settings, Bookplate, Welcome and the guided tour retain
working destinations.

The tour clamps its card to the viewport and keeps actions reachable with
enlarged text. Settings replays it without resetting data. Selected form segments
have accent fill and a checkmark, checked semantics and arrow/Home/End operation.
These two visible corrections were explicitly requested on 2026-09-21.

## Relationships and data

`relationships/library.ts` centralises membership, sequence, completion and
Codex grouping. Series members inherit their series' world; standalone works
have direct membership. Conflicting historical memberships remain for review.
Optional named reading orders are separate from membership.

The organiser edits membership/sequence, assigns worlds, and reconciles duplicate
groups. Consequential changes are previewed, writes are transactional, stale
membership changes are rejected, and group deletion retains works. A complete
newly written/read-back-verified safety ZIP including user covers is required
before group merge/delete or replacement restore. Missing cover bytes or failed
storage stops the destructive operation.

Append-only Dexie v3 retires view preferences only. Work/group IDs, onboarding
completion, user covers and backup format 2 remain compatible. Session logging
serializes history and progress in one transaction; settings are published after
persistence. Background backup failures are visible. Available PWA updates defer
activation during drafts, data writes, backups and catalogue installation.

## Runtime and maintenance

`reading-room-tokens.css` is the single maintained runtime token system; frozen
original tokens and the immutable design package remain historical references.
The runtime loads two self-hosted font files. Three.js 0.186.0 is exact-pinned,
MIT, without runtime dependencies, and loads separately for Codex. The scene
uses three instanced batches, bounded nearby rows, small procedural textures,
capped pixel density and change-driven rendering. GPU failure retains the same
accessible DOM shelf controls in two dimensions.

Production keeps Ex Libris' original origin, project path, manifest identity,
icon paths and share target. The current artwork is the owner's X-and-quill
image (E-116), replacing earlier logo experiments. Evaluation seeding and engineering bridges exist only
in the explicit test build and are excluded from normal output. No cloud,
account, telemetry, paid dependency or remote migration is introduced.

See `AUDIT.md` for prioritised findings, `COMPARISON.md` for honest tradeoffs,
and `RELEASE.md` for upgrade/rollback instructions. Q-028 physical Android
catalogue latency and physical assistive-technology checks remain unpassed;
emulated performance is not substituted for those measurements.
