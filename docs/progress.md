# progress.md

Appended per phase. What was built, what was decided differently and why, what
broke and how it was found, and what was tried and abandoned.

---

## Phase 0 · Foundations — 2026-09-03

### Built

Vite + React 19 + TypeScript, strict, with `noUncheckedIndexedAccess`. PWA via
`vite-plugin-pwa` with a Workbox service worker, a manifest carrying the share
target, and three generated icons. Dexie schema implementing the data contract
exactly, with a single-list migration harness. OPFS wrapper, `storage.persist()`,
storage usage reporting. A hand-rolled router over the History API that gives the
Android back gesture correct behaviour. Self-hosted typefaces. `tokens.css` and
the taxonomy vendored verbatim and byte-compared in the gate. A Phase 0
diagnostics panel that reports every foundation's real state.

Measured at the end of the phase, not estimated: 44 unit tests, 6 end-to-end
tests, 5 structural checks, 97.5 kB gzipped JS against a 250 kB budget.

### Decided differently from the brief, and why

- **The engine brief's §7 search model was superseded by the design's D-055.**
  The brief describes one bar merging library and catalogue results. The finished
  design splits them: search is a lens over the library only and never touches
  the catalogue, which lives behind the FAB. The design package wins by standing
  instruction. The consequence for the schema is that `SearchResults` §9.1 is now
  the catalogue sheet's payload and the library search screen needs its own
  return shape — to be written in Phase 1, not guessed at now.
- **Seven schema changes** (E-001 to E-007) were proposed to the owner and
  approved before any code was written. All are additive except two deliberate
  removals.
- **No router library.** Sixty lines over the History API, because the app is a
  screen plus a sheet stack rather than a nested route tree.

### What broke, and how it was found

- **`installHistory` was not idempotent.** Found because a router test failed on
  its _second_ case, not its first — two `popstate` listeners meant one back
  press unwound two layers. Would have appeared in development as "the back
  gesture sometimes skips a screen", caused by React StrictMode and by every HMR
  reload, and would have been very hard to attribute. Fixed at the source.
- **Dates were being read on the UTC calendar.** Found by _looking_ at the
  diagnostics panel at 01:50 IST and seeing "first tracked 2026-09-02" on the
  3rd. No test caught it and no test would have. The same defect on 1 January
  drops a book out of "finished in 2026". Fixed by making `src/db/dates.ts` the
  only way to ask for a day or a year, and by adding a structural check that
  fails the build on `.slice(0, 4|7|10)` anywhere else.
- **A 404 on `/favicon.ico`.** Found by reading the console after opening the
  built app by hand. Fixed with a real favicon link, and an end-to-end test that
  now refuses to tolerate any console error or 4xx response at all — which is
  the check that would have caught it.
- **Prettier silently reformatted the vendored `taxonomy.json`,** which is a
  verbatim copy of the design contract. Caught by `check:tokens` within an hour
  of that check being written. Both contract copies are now in `.prettierignore`.
- **The first version of the date check was dead on arrival.** It gated on an
  identifier matching `\bAt\b`, which never matches inside `firstTrackedAt`
  because there is no word boundary there. It passed against the very defect it
  was written for. Found by deliberately reintroducing that defect and watching
  the check stay green.

### Every test was watched to fail

Four load-bearing assertions had their defect reintroduced and were confirmed to
go red, then restored:

| defect reintroduced                                           | test that caught it                                     |
| ------------------------------------------------------------- | ------------------------------------------------------- |
| pop the screen before the open sheet                          | router · back closes the topmost sheet first (2 tests)  |
| gate a tag on any warning membership rather than warning-only | taxonomy · Body Horror survives with warnings off       |
| drop the `&` from `tag.normalizedName`                        | db · refuses a second tag with the same normalised name |
| match a leading article as a prefix rather than a whole word  | keys · "Theodore Rex" is not filed under "odore"        |

The two structural checks were proven the same way: `tokens.css` was corrupted
and the drift check went red; a hardcoded `#ff0000` and `250ms` were added to
`base.css` and both were reported with the right line number.

### Tried and abandoned

- **Writing source files with shell heredocs.** They fail silently on this
  machine at any real size — the first attempt at `src/db/schema.ts` produced a
  parse error and no file. Everything since is written with an editor tool.
  Recorded in `HANDOFF.md` so it is not retried.
- **Gating the date check on a date-looking identifier.** Too clever and it did
  not work. Any slice to 4, 7 or 10 characters is now flagged regardless of what
  it is slicing; a false positive costs one comment and a missed one costs a
  wrong year on screen.

### Left deliberately undone

- `work.rating` and `work.isTranslated` are in the type and nothing sets them.
  Both are documented as dormant in `src/db/schema.ts`, both stay so a restored
  backup is never lossy.
- The app icon needs the owner's eye (Q-018).
- `design/Ex Libris.dc.html` has been read structurally and screen by screen,
  not line by line. That full read happens at the start of Phase 1, before
  porting.
