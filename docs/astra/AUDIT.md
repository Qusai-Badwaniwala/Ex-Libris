# Current production application audit

Scope: production baseline `a218b8a`, local source and the deployed GitHub Pages
application at <https://qusai-badwaniwala.github.io/Ex-Libris/>. Investigation
began during the design review and continued through adoption. This describes
the original production baseline; adoption corrections are identified below.
Current publication evidence belongs in the canonical HANDOFF. Findings distinguish observed behaviour from source-based
risks. Difficulty is an estimate, not a schedule or permission to implement.

The baseline is a working application with unusually strong data-safety
foundations: transactional repository operations, on-device data, explicit
relationship confirmation, manual recovery routes, complete cover-aware
backups, real OPFS catalogue queries and existing offline/update tests. The
audit does not treat its visual character as a defect simply because Astra
chooses a different one.

## CRITICAL

No critical vulnerability or release-blocking data corruption was confirmed.
This is a bounded source and browser review, not a penetration-test certificate.

## HIGH

### H4 — Tour actions can fall below the viewport

- **Evidence:** The owner reported a stuck tour in both designs. A 360x640
  replay with enlarged text measured the action bottom at 948.7px; its new
  assertion failed before the correction and passed afterwards through all
  six steps. Focus could also scroll the positioned card independently.
- **Impact:** A new reader cannot reach Next or Skip.
- **Fix:** Measure the card, clamp it to the visible viewport, scroll only its
  copy when necessary, retain the action row, and focus without scrolling.
- **Difficulty / risk:** Medium; target scrolling and first-run/replay differ.
- **Adoption:** Corrected; included in the browser gate.

### H2 — Reading-session and progress writes could separate or double-count

- **Evidence:** Production `logSession` read the starting position outside a
  transaction, inserted a session, then updated progress. With the original
  transaction-free behaviour restored in the isolated checkout, injected write
  failure left one orphan session and concurrent identical submissions created
  two session rows. Both regression assertions failed, then passed with the fix.
- **Impact:** Statistics and the displayed reading position can disagree.
- **Recommendation:** Serialize the read, session insert and progress/status
  update in one transaction; reject non-finite input before writing.
- **Difficulty / risk:** Medium; both finish paths share this repository action.
- **Adoption:** Corrected and covered by targeted and journey tests. Public
  production remains unchanged.

### H3 — Settings could indicate completion before storage accepted it

- **Evidence:** A production-style first-run journey clicked Skip and immediately
  reloaded; the tour returned. `useSettings` published optimistic completion
  before the database write. A held-write regression also failed with that old
  behaviour and passes when completion is published after commit.
- **Impact:** Reload can interrupt onboarding persistence; independent hook
  instances can display stale settings.
- **Recommendation:** Observe stored settings and expose completion after a
  successful write; retain current state on failure.
- **Difficulty / risk:** Low–medium; verify theme feedback and failed toggles.
- **Adoption:** Corrected; the theme control retains immediate visual feedback
  with its existing failure recovery.

### H1 — Back silently loses an unsaved note

- **Evidence:** In the local current-app browser, type a new note, use Back,
  then reopen the editor: the text is gone. `src/ui/note-editor.tsx` holds the
  draft in component state and closes through the history router without a
  dirty-draft decision.
- **Impact:** A normal phone gesture can destroy user-authored writing.
- **Recommendation:** Keep the editor mounted while offering Keep editing or
  Discard changes; protect document unload too. Preserve text on failed writes.
- **Difficulty / risk:** Medium; history entry restoration must preserve the
  existing sheet/screen race fixes and nested tag picker.
- **Astra:** Addressed in the isolated frontend. The new router regression was
  observed failing with the guard deliberately disabled, then passing when
  restored. The actual Back/keep/save/discard browser journey passed.

## MEDIUM

### M10 — Selected form choices are too subtle

- **Evidence:** Shelf and Counted in used only raised-surface fill and primary
  text; the owner could barely distinguish selection.
- **Impact:** A reader can save the wrong format, unit or shelf unintentionally.
- **Fix:** Use the active theme accent plus a checkmark, preserve checked radio
  semantics, and support arrows/Home/End for keyboard selection.
- **Difficulty / risk:** Low; shared control requires both-theme review.
- **Adoption:** Corrected in the shared segmented control; gate covers all
  three Add by hand groups in both themes.

### M1 — Session entry becomes laborious for large progress jumps

- **Evidence:** Production `SessionSheet` exposes step increments but no direct
  destination field. Reaching a distant web-novel chapter needs repeated taps.
- **Impact:** Friction in one of the application's most frequent tasks.
- **Recommendation:** Add a numeric destination alongside the existing steps;
  validate against the current position and known total through the same save.
- **Difficulty / risk:** Low–medium; invalid and backwards values must remain
  impossible to persist.
- **Astra:** Direct entry added; the browser test verifies a typed page value
  survives saving and reload. Business rules remain in the original repository.

### M2 — Unknown publication state receives false completion wording

- **Evidence:** `src/ui/sheets.tsx` uses completion wording in the status picker
  for a publication state that can still be unknown. Confirmed during browser
  inspection of an unknown-total work.
- **Impact:** Readers may confuse missing metadata with a finished publication.
- **Recommendation:** Explain the unknown state explicitly; keep publication
  status independent of the reader's status.
- **Difficulty / risk:** Low, copy-level change.
- **Astra:** Corrected copy; no status rules or stored values changed.

### M3 — Important record controls miss the project's touch target

- **Evidence:** Measured current Detail controls included Edit approximately
  41.5×26px, Log 103.6×26px, Add cover 116×32px, Reading 101×36px and genre
  targets approximately 85.5×22px. The title was a styled div rather than an h1.
- **Impact:** Tapping/editing is less forgiving on a phone; heading navigation
  conveys less of the record's structure. These measurements use the project's
  44px target, not a claim that every measurement violates WCAG AA.
- **Recommendation:** Increase hit areas without turning every label into a
  visual button container, and use real headings.
- **Difficulty / risk:** Low–medium; account for wrapping and dense sheets.
- **Astra:** Record heading and shared minimum target height added. Visual and
  automated checks cover representative controls; physical assistive-tech
  review is still outstanding.

### M4 — A held-open app offers no visible update decision

- **Evidence:** The PWA uses prompt-style registration without a reader-facing
  update offer. The existing upgrade test activates a replacement worker and
  closes clients; it proves data preservation, not discovery of an available
  update while the old page remains open. Project history also records an old
  open bundle being mistaken for missing new functionality.
- **Impact:** Installed users may continue using stale code without knowing an
  update is available.
- **Recommendation:** Offer a restrained update action when a worker waits,
  defer reload while editing, and verify one uninterrupted installed session.
- **Difficulty / risk:** Medium; do not reload over an unsaved draft or import.
- **Adoption:** Approved and implemented. A waiting worker offers Update/Later;
  drafts, active writes, background snapshots, restore and catalogue installation
  defer activation. The real-worker browser test verifies the disabled offer,
  explicit activation, preserved records/catalogue and offline restart.

### M5 — Startup waits for artwork unrelated to the first screen

- **Evidence:** `src/ui/splash.tsx` creates image requests for both themes of all
  thirteen illustrations, awaits `Promise.all`, enforces 520ms, then a 250ms
  fade. Failed requests resolve, but a request that stays pending has no deadline.
- **Impact:** Unnecessary warm-start delay; a stalled artwork request can hold
  the interface. The latter is a source-confirmed risk, not a reproduced stall.
- **Recommendation:** Gate entry on storage readiness; load the visible art and
  progressively cache the rest. Keep dimensions reserved to avoid layout shift.
- **Difficulty / risk:** Low–medium; inspect cold/offline starts for art flashes.
- **Astra:** Removed the artificial wait and all-artwork boot dependency.

### M6 — Catalogue download size arrives too late

- **Evidence:** The deployed catalogue is 273,784,832 bytes (261.1MiB); the
  initial installation screen did not expose this cost before the action.
- **Impact:** A significant optional download is hard to judge on mobile data
  or a nearly full device.
- **Recommendation:** Read the manifest before installation, show size and
  unavailable-size states, preserve explicit download and retry actions.
- **Difficulty / risk:** Low; failed metadata must not block manual entry.
- **Astra:** Manifest preflight added to the catalogue screen. Download,
  checksum, resume and OPFS contracts remain unchanged.

### M7 — Desktop space separates related information too far

- **Evidence:** At 1440px, many production phone rows expand across most of the
  viewport, putting related labels and actions at opposite ends. Notes remains
  behind the drawer while Settings is a primary tab.
- **Impact:** More eye travel on wide screens and avoidable navigation for a
  major reading activity. This is a product/design judgment, not a broken flow.
- **Recommendation:** Bound reading measures, group related information into
  columns, and consider Notes as a primary destination.
- **Difficulty / risk:** Medium; navigation changes require owner evaluation.
- **Astra:** Rail, responsive groups, bounded utilities and primary Notes.
  Tradeoff: Settings requires an extra tap and existing habits change.

### M8 — Some rejected writes have no reader-facing explanation

- **Evidence:** Production SessionSheet and Wishlist attach success handlers to
  repository promises without rejection handlers. The shared interaction
  feedback helper clears its pending mark in `finally` and deliberately leaves
  errors to the caller. This is source evidence; storage exhaustion was not
  reproduced against the deployed reader's data.
- **Impact:** A failed session or status write can leave a reader uncertain
  whether progress was recorded. The repository does not falsely commit it.
- **Recommendation:** Retain the draft, present an inline error and retry action,
  and prevent concurrent session submissions while a write is pending.
- **Difficulty / risk:** Low–medium; test rejected writes without weakening the
  repository's transaction boundaries.
- **Astra:** Added inline failure messages for session save and Wishlist actions,
  plus pending-session disablement. Other existing failed-write protections
  remain in place. No production changes made.

## MEDIUM (continued)

### M9 — Deleting a series could leave an invalid named-order placeholder

- **Evidence:** `deleteSeries` cleared `readingOrderEntry.seriesId` while keeping
  its `kind: series` row. No group remained behind that entry. The adopted group
  renderer would otherwise treat this as a missing work.
- **Impact:** An order could suggest adding a book that was actually a removed
  series. This is a data-reference defect, not missing catalogue metadata.
- **Recommendation:** Remove references to the deleted group and compact the
  surviving order positions in the same transaction; retain all actual works.
- **Difficulty / risk:** Low–medium; test references from a different world order.
- **Adoption:** Corrected. Trashed works are also identified as In Trash instead
  of being offered as new missing books.

## OPTIONAL

### O1 — Explain the scope of online metadata lookup in its action label

- **Evidence:** The online path uses MangaDex comic metadata; “Search online”
  can suggest general book lookup. A deployed Earthsea lookup produced “Failed
  to fetch”; manual entry retained the query and worked. The external failure's
  cause was not established and is not claimed as an application defect.
- **Impact:** Readers can form the wrong expectation about supported formats.
- **Recommendation:** Name the provider/scope and preserve the manual fallback.
- **Difficulty / risk:** Low.
- **Astra:** Action now says “Search MangaDex comics”. No provider was added.

### O2 — Plan a tested Vitest maintenance update

- **Evidence:** `npm audit --json` on 2026-09-19 reports two moderate package
  entries for one advisory, GHSA-82fw-gwwq-j7x9, affecting Vitest 3.2.7 and
  `@vitest/mocker`. The [maintainer advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9)
  describes file disclosure through a reachable development mock server. This
  project runs unit tests in jsdom and does not configure that public mock
  plugin. No deployed exploit path was found.
- **Impact:** Development dependency maintenance, not a demonstrated shipped
  application vulnerability. The scanner's two entries are not two independent
  security incidents.
- **Recommendation:** Upgrade to a supported patched major in a separate change,
  run the complete gate, and keep development services local in the meantime.
- **Difficulty / risk:** Medium because it crosses a test-runner major version.
- **Astra:** Same development dependency; not upgraded as part of the redesign.

## Other review results and limits

- No account or server-side authorization boundary exists in this personal
  on-device app. No client-rendered HTML injection sink or bundled credential
  was found in the targeted source review. Cover URL handling checks protocol;
  backup/export logic excludes credentials. No speculative vulnerability is
  asserted from the use of IndexedDB itself.
- Catalogue data remains outside mutable-user backups and Workbox precache.
  The normal build mechanically excludes the restricted engineering fixture.
  The public catalogue uses the existing licensed Open Library/Wikidata build.
- Existing tests cover interrupted downloads, offline restart, cover storage,
  transactional import/restore, failed writes, note/work deletion boundaries,
  share cold start and service-worker data preservation. Passing those tests
  is not proof of physical Android latency or iOS installation behaviour.
- Q-028 remains explicitly unpassed: real-phone worker/OPFS latency and device
  behaviour need a physical-device session. No emulated result closes it.
- No cloud synchronization, background notifications, recommendation service,
  extra artwork or new analytics is proposed. The audit itself was read-only;
  the later owner-authorised adoption implements the corrections marked above.
