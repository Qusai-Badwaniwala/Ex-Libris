# Reading Room release

Prepared on `astra/frontend-redesign`. The owner authorised commit, push and
GitHub Pages publication on 2026-09-21. See the canonical HANDOFF for the exact
release commit, verification and deployment status. No localhost sample data
is transferred to the deployed reader's library.

Published 2026-10-02: application commit `4fa9e93`, successful Pages run
[36963081036](https://github.com/Qusai-Badwaniwala/Ex-Libris/actions/runs/36963081036).
The public app's main JS/CSS match the locally reviewed build. A real cached-old
to new-worker browser upgrade preserved its existing two records and onboarding.

## Switch boundary

Before destructive data operations, require a complete verified ZIP including
user covers. A manual export from the **deployed** app is also recommended
before upgrading; this release does not remotely read or back up phone data.
Keep exports outside browser storage and verify them through restore preview
on a disposable origin. Never export/import
localhost sample data into production. Preserve the original origin, `/Ex-Libris/`
base path, scope, start URL, launcher icons and share target.

Deploy only the normal build, never `--mode test`: test builds contain the
explicit evaluation screen and engineering catalogue fixture. Normal builds
must contain neither. The existing Pages workflow supplies `VITE_BASE_PATH`.
The catalogue remains the licensed production Open Library/Wikidata distribution.

Existing readers keep their welcome/bookplate/tour completion and library. Dexie
v3 changes only retired view preferences. Reading remains the opening screen;
Collection Index is the default and Codex is optional. No cloud service, account,
paid dependency, telemetry or remote migration is introduced.

## Backup and rollback

Group merge/delete and replacement restore require a complete verified local
safety ZIP first. If OPFS is unavailable, full, unreadable, or a user cover is
missing, they stop without applying the destructive change. Export a manual
backup before release even though the schema upgrade itself is nondestructive.

For the initial upgrade from the old frontend, open the existing app online,
then close all Ex Libris tabs and the installed app before reopening. The old
build has no visible update offer. Once the new build is active, later updates
offer Update / Later and defer while data operations or editors are active.
Do not clear browser/site storage or uninstall as an update procedure.

Do not redeploy the untouched DB-v2 baseline over a database that has opened v3:
IndexedDB version downgrades fail. For a presentation rollback, prepare and test
the prior frontend **while retaining the append-only v3 migration and compatible
data contracts**. Keep canonical relationship interpretation if new organisation
operations have been used. Validate the rollback against a disposable copy of
the current complete backup before authorising deployment. Restoring a pre-switch
backup loses subsequent edits and is a separately approved destructive action.

## Limits and tradeoffs

- Q-028 remains an explicitly unpassed physical Android catalogue benchmark.
  Desktop Pixel emulation does not measure phone CPU, storage, GPU or TalkBack.
- Three.js is pinned at 0.186.0, MIT, without runtime dependencies. It is loaded
  separately when Codex opens. The cabinet uses bounded rows, small procedural
  textures, three instanced draw batches, capped density and no idle render loop.
  This is more complex than Index and remains optional.
- Legacy conflicts are retained for review, not guessed away. Named orders are
  optional and must be selected explicitly; incomplete metadata stays incomplete.
- The refreshed 2026-10-02 dependency audit reports five development-only entries:
  brace-expansion (high), fast-uri (moderate), serialize-javascript (low), and
  Vitest/mocker (two moderate entries). `npm audit --omit=dev` reports zero
  vulnerabilities. The first three are newly reported transitive tool advisories;
  the earlier Vitest fix requires a major update. Targeted tooling maintenance is
  deferred separately from the usable app release; no blanket or force fix.
- Actual installed-device and assistive-technology evidence is still distinct
  from automated browser and semantic checks.

Final gate counts, exact build sizes, browser coverage and local URL are recorded
in the live handoff after verification. This document does not certify unfinished
checks or claim that mistakes are impossible.
