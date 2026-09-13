# Ex Libris handoff

**Last updated:** 2026-09-13

**Repository:** `H:\Ex libris Project\Website`

**Active checkpoint:** Phase 10 accepted; release commit pushed; GitHub Pages
needs the owner's one-time repository setting

Read `OPEN-QUESTIONS.md`, `EXECUTION-PLAN.md`, and `DESIGN-STATE.md` before
changing anything. The immutable Claude package under `design/`, frozen
`src/styles/tokens.css`, and frozen `src/data/taxonomy.json` remain untouched.

## Roadmap checkpoint

| Phase                    | State                   | Durable truth                                                                                                                    |
| ------------------------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 0–4                      | Complete for sequencing | Phase 3's physical Android worker/OPFS latency gate remains deferred as Q-028, not passed.                                       |
| 5 · Series and universes | Accepted                | Confirmation-only relationships, named orders, starting point, feedback, gate, and exact-title Wishlist preflight passed.        |
| 6 · Axes and matching    | Accepted                | Seven-step editing, Finished-only ending, finish paths, Detail profile, explainable six-axis matching, gate, and review passed.  |
| 7 · Notes                | Accepted                | Multi-work links, tags, pinning, cross-search, Detail notes, reversible deletion, themed illustrations, gate, and review passed. |
| 8 · Data safety          | Accepted                | Automatic snapshots, complete ZIP export/restore, paste/CSV import, share target, gate, and review passed.                       |
| 9 · Stats and spine view | Accepted                | Truthful Stats, adaptive/fixed widths, row virtualization, 500-work performance, gate, and visual review passed.                 |
| **10 · Final polish**    | **Accepted**            | Original 207/46 gate plus the owner-approved icon/install/publication extension and definitive 207/47 gate passed.               |

There is no Phase 11. The current work is a bounded public-release extension,
not a new product phase.

## Phone-release extension delivered

- Q-018 is resolved. The owner-supplied reader-circle logo is now the release
  icon, with separate full-bleed and maskable masters and deterministic 192px,
  512px, and maskable outputs.
- Settings has one real `Install Ex Libris` section. It opens the native browser
  prompt when available, gives iOS or generic browser menu instructions when it
  is not, keeps dismissal retryable, and displays a green tick plus `Installed`
  for a standalone launch or an accepted current prompt.
- First-run onboarding has a sixth and final spotlight. It navigates from Home
  to the real Settings installation row and invokes that same installation
  path; no duplicate or ornamental install control exists.
- All runtime public paths support the GitHub Pages project base
  `/Ex-Libris/`, including the manifest, icons, service worker, illustrations,
  share target, route fallback, and optional catalogue download.
- `.github/workflows/pages.yml` builds the project site on `master`. The ignored
  261.1-MiB production SQLite file is represented by 66 checked 4-MiB-or-smaller
  parts under `deployment/corpus/`; CI reassembles and verifies the exact
  273,784,832 bytes before upload. The AniList/MangaDex fixture remains ignored
  and cannot ship.
- `README.md` is a concise first-person project introduction, install note,
  privacy/backups warning, local setup, and acknowledgements. It does not claim
  the software was authored by an automated system.

No dependency, Dexie migration, corpus row/source/licence change, immutable
design edit, speculative feature, or unrelated refactor was added.

## Verification evidence

- Focused strict TypeScript and production Pixel 7 install journeys passed.
  Native-prompt acceptance, Installed status, completed-tour persistence, and
  manual fallback are covered.
- Explicitly inspected `.impeccable/review/release-install-*.png` in warm light
  and blue-grey dark, including the spotlight, native state, manual instructions,
  and green Installed state. The 192px regular and 512px maskable icons were
  also inspected after generation.
- A local `/Ex-Libris/` production build and preview returned HTTP 200 for the
  app, web manifest, and catalogue manifest. The assembled catalogue was
  273,784,832 bytes and matched SHA-256
  `1d5c9eba8347481ab55db124378c15d1d6ac05264f7012160fc0954a0a7272c7`.
- Definitive `npm run gate` passed on 2026-09-13: formatting, lint, strict
  TypeScript, frozen token/taxonomy checks across 96 source files, 207/207 unit
  tests in 20 files, 47/47 production Pixel 7 E2E tests, and the production PWA
  build.
- Final local application JS is `index-BNZBCYIL.js`, 621.67 kB raw / 180.73 kB
  gzip; CSS is `index-DXm9LgQ2.css`, 24.18 kB / 4.87 kB gzip; worker JS is
  77.68 kB; FTS5 WASM is 842.76 kB / 411.47 kB gzip. Workbox precaches 82
  entries / 15,784.70 KiB and excludes catalogue bytes.
- Public-file audit found zero high-confidence credentials in the current tree
  and existing Git history. `.env`, local databases, pipeline cache, test output,
  and visual-review captures are ignored. Broad matches were only deliberate
  fake values in backup tests that prove keys are excluded.
- Q-028 remains deferred and explicitly unpassed. Pixel 7 emulation does not
  measure physical Android storage or CPU.
- Commit `b41ac679f9527cc5a47799852a889c4297c7e3ca` is pushed to
  `origin/master` at the public
  `https://github.com/Qusai-Badwaniwala/Ex-Libris` repository. Its author and
  committer use GitHub's verified-format no-reply address; the first rejected
  attempt published nothing and the private email is absent from Git history.
- GitHub Actions run `34745951062` built through the corpus reconstruction, then
  failed only at `Configure GitHub Pages` because Pages is not enabled for this
  new repository. The deploy job was skipped; no public app URL is live yet.

## Still open

- Q-028 is the deferred physical mid-range Android input-to-painted catalogue
  result.
- Q-029 is an unapproved, unimplemented empty `More Like This` explanation.
- Q-013 re-reads remain deferred and undesigned.

## Next three actions

1. Owner opens the repository's **Settings → Pages**, changes **Build and
   deployment → Source** to **GitHub Actions**, and reports that it is done. This
   is the only current external blocker; the unauthenticated in-app browser
   cannot change repository settings.
2. Trigger and watch a fresh Pages workflow, then verify the public URL,
   manifest, icons, service worker, app start, share fallback, and production
   catalogue manifest from the network.
3. Record the successful workflow and public URL here and in `progress.md`,
   commit and push that final durable release record, and give the owner the
   detailed first-time phone guide. Do not start an undocumented product phase.

## Environment and repository hazards

- Commit `b41ac67` contains the complete Phase 2–10 implementation as one
  audited public release unit. Do not reset, clean, discard, or rewrite its
  history.
- The release commit is pushed; Pages is not deployed because the repository
  setting above is still off. Do not claim that the app URL is live until a
  fresh workflow succeeds and the network checks pass.
- Run Git, npm, and tests from `H:\Ex libris Project\Website`.
- Ports 5173 and 4173 are stopped. Never build while either serves this
  repository; host the exact gate build on 4173 after Git work if local review
  is still useful.
- `public/corpus/` and `pipeline/.cache/` are deliberately ignored. Only the
  production checksummed parts in `deployment/corpus/` belong in Git.
- Existing Vite warnings about the main chunk size and mixed static/dynamic
  `dates.ts` import are non-blocking and unchanged in kind.
- The optional local `impeccable` engine binary is absent. The release review
  used its complete documented manual criteria; do not install it without owner
  instruction.

```text
npm run gate
$env:VITE_BASE_PATH='/Ex-Libris/'; npm run build
npm run pages:corpus:assemble
```
