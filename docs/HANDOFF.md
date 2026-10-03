# Ex Libris — current Reading Room release

Updated 2026-10-03. Production repository: `H:\Ex libris Project\Website`,
branch `master`. The isolated historical implementation remains in
`../Astra-Redesign`, branch `astra/frontend-redesign`; it is not the release
source. The owner authorised commit, push and GitHub Pages publication in
E-111, superseding earlier no-publication instructions. No prescriptive design
skills. Preserve deployed data; never import localhost evaluation samples.

## Current public release

Live: <https://qusai-badwaniwala.github.io/Ex-Libris/>.

Application commit `9ad1246fd6f2bb6b22a008eb8cbc2e176e84d3cc` introduced the
owner-supplied X-and-quill icon. [Pages run 37048612948](https://github.com/Qusai-Badwaniwala/Ex-Libris/actions/runs/37048612948)
passed; subsequent release-evidence documentation commit `fb03b66` also
deployed successfully in [run 37049057760](https://github.com/Qusai-Badwaniwala/Ex-Libris/actions/runs/37049057760).
On 2026-10-03, read-only checks confirmed both successful runs and the public
assets `index-BerBxkZz.js` / `index-BEaYUs7W.css` still match this release.

The exact 1254px artwork is preserved at
`assets/brand/ex-libris-quill-source.png`, SHA-256
`377e007a4d9a21912a0d36b16b394b9f69e820ad431926cb0d01603f439b973b`.
`npm run icons` generates the established manifest PNG filenames. Ordinary
exports trim only the outer black margin; the maskable export keeps the feather
and pen inside Android's safe circle. Toolbar/startup share the 192px icon,
which is precached; the original source stays outside the shipped build.
Superseded geometric EX and folio marks remain only in release history.

Reviewed/public icon SHA-256 values:

- `icon-192.png`: `188f8e9188a9460e5cbd45d707c69350c6eac6b4b11d2481d34c43bace352b70`.
- `icon-maskable-512.png`: `5c27706015cf3a220751c13aa4e7d4a49a67375e2488079bad9fd796a96a52c5`.

## Implemented experience and data boundaries

The approved light Reading Room remains intact: Literata / Source Sans 3,
mineral paper and vermilion (`#AB3927`). Dark uses near-black (`#111214`) and
charcoal surfaces with blue-grey accents (`#8FA3C4`). All thirteen illustrations
have theme derivatives; original artwork/design files remain untouched.
`reading-room-tokens.css` is the maintained runtime system. Reading opens first;
Collection defaults to Index with optional Three.js Codex. Spines are retired.

All major library, reading, Wishlist, Notes, Stats, editor, search, import,
backup, Trash, Settings and onboarding journeys are implemented. The replayable
tour keeps its actions within the viewport; selected form segments use accent
fill plus checkmarks and keyboard operation. Dirty drafts are protected.

Shared relationship queries power Detail, series/world pages, organiser,
counts and Codex. Membership is separate from optional named reading orders;
legacy conflicts remain for explicit reader review. Supported series suggestions
appear when an ungrouped work opens. One tap accepts a suggested series; series
pages offer a clearly reader-authored same-named world. The production catalogue
has no verified world rows: these actions do not discover an entire universe or
invent missing entries.

The optional offline catalogue remains 438,584 licensed Open Library/Wikidata
works, 273,784,832 bytes, SHA-256
`1d5c9eba8347481ab55db124378c15d1d6ac05264f7012160fc0954a0a7272c7`.
Explicit online Open Library book and MangaDex comic lookups broaden discovery;
pure web-novel coverage remains limited. No new bulk acquisition was performed.

Dexie version 3 retires view preferences only; JSON backup schema remains 2.
Existing IDs, library, onboarding and OPFS covers are preserved. Sessions and
progress commit atomically; settings publish after persistence. Destructive
group operations and replacement restore require a newly read-back-verified
complete safety ZIP with user covers. PWA updates defer during drafts, writes,
backups and catalogue installation. Origin, `/Ex-Libris/`, installation identity
and share handling are unchanged. Normal builds exclude evaluation seeding and
engineering fixtures. No cloud, account, telemetry or paid dependency was added.

## Verification and remaining limits

The last application `npm run gate` passed after the final maskable refinement:
formatting, lint, strict types, structural/frozen checks, **220 unit tests,
60 browser journeys**, and normal production build. The exact Pages-path build
assembled the checksum-verified production catalogue. Local 390x844 toolbar/icons
were inspected in both themes. The live browser activated the waiting worker,
loaded the new icon and retained two pre-existing records; no public records
were added, removed or imported. This documentation check does not rerun or
extend those earlier application tests.

Adoption evidence includes short-phone/enlarged-text onboarding, clear manual
selections, organiser failures/conflicts, old-backup restore, both-theme artwork,
500-work Codex, bounded rows, idle rendering, GPU-loss fallback and scroll
restoration. Defect-restoration regressions failed before fixes and passed after.
The desktop-emulated 500-work Codex sweep improved from 22.7 to approximately
57–60fps with at most five mounted rows; this is not a physical-phone measurement.
Detailed chronology remains in `progress.md` and prior Git versions of this file.

Still unpassed: **Q-028 physical Android catalogue latency**, physical TalkBack
review, and the owner's actual Android launcher appearance/cache refresh. There
is no pending implementation phase. Re-read history remains deferred (Q-013).
The dependency audit as of 2026-10-02 reported zero production vulnerabilities
and five development-only entries (one high, three moderate, one low); targeted
tooling maintenance is deferred. This is dated evidence, not a new audit today.

## Environment and next three actions

The last exact production preview was `http://127.0.0.1:4278/Ex-Libris/`;
it **is not responding as of this check**. Old preview-session IDs and browser
bindings are historical, not reusable current state. Set
`VITE_BASE_PATH=/Ex-Libris/` for both build and preview. Before any build inspect
listeners on 5173/4173 and relevant Node processes; stop servers serving the
checkout being built. Gate creates its own test-mode preview. Never publish
`--mode test` output. Older localhost/public tabs may execute cached workers.

1. On the phone, open online, save active edits, accept Update and reopen the
   installed app. Do not clear site data to refresh a logo; keep a complete
   manual backup before any eventual reinstall.
2. If the launcher still shows an old mark, inspect an actual phone screenshot
   and update state before changing artwork. Reproduce any reported issue in
   the adopted release rather than restarting the redesign.
3. Perform Q-028 and TalkBack review on an available physical Android device;
   record measured evidence without substituting desktop emulation.

Current references: [design state](DESIGN-STATE.md), [adoption](astra/ADOPTION.md),
[audit](astra/AUDIT.md), [comparison](astra/COMPARISON.md),
[upgrade/rollback](astra/RELEASE.md), [schema](SCHEMA.md),
[open questions](OPEN-QUESTIONS.md). Original phase plans, engine brief, design
package and experiment documents are historical where later decisions supersede
them. A rollback must retain DB-v3 compatibility; do not redeploy the DB-v2 binary.
