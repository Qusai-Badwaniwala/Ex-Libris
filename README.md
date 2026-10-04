<p align="center">
  <img src="public/icons/icon-192.png" width="112" height="112" alt="Ex Libris app icon">
</p>

# Ex Libris

Ex Libris is the reading tracker I wanted for my own shelf: private, quiet, and useful even when the internet is not. It keeps books, web novels, and manhwa together without turning reading into a score, a streak, or a social feed.

**Open the app:** [qusai-badwaniwala.github.io/Ex-Libris](https://qusai-badwaniwala.github.io/Ex-Libris/)

## What it does

- Keeps a local library, wishlist, reading progress, finish dates, and personal notes.
- Shows read-only reading-session history and lets you write an attached note directly from a work.
- Handles books, web novels, and manhwa without pretending their metadata is equally complete.
- Tracks series, worlds, and more than one named reading order, with confirmation-based grouping suggestions.
- Lets you attach notes and tags to several works, pin notes, and recover deleted items from Trash.
- Builds honest reading stats and an optional Codex bookcase from the library you actually keep.
- Exports and restores a complete ZIP backup, including covers you added yourself.
- Reviews retained recovery snapshots and explains overlapping records before restoring a backup.
- Offers an optional 438,584-work offline catalogue built from reusable Open Library and Wikidata data, plus explicit online Open Library book and MangaDex comic lookups. Manual entry remains available at all times.

## Installing it

Open the live link on your phone. During the first tour, Ex Libris takes you to the Install section in Settings. On supported Android browsers, the **Install** button opens the browser's real installer. On iPhone or iPad, it shows the Safari steps for adding the app to the Home Screen.

Once installed, Ex Libris opens in its own window and its app shell works without a signal. The catalogue is a separate optional download because it is much larger than the app itself.

For an existing installation, open it online and choose **Update** when offered.
Updates wait while an editor or data operation is active, including in another
open Ex Libris window. Closing and reopening the app also lets the browser
activate a waiting release. Keep your installation and browser storage.

## Privacy and backups

There is no account, cloud sync, analytics, advertising, or telemetry. Your library is stored by the browser on your device. The repository and the hosted app contain no personal library data or private keys.

That privacy has one important trade-off: losing the phone can also mean losing the library. Use **Settings → Export a copy** from time to time and keep the ZIP somewhere safe.

## Running it locally

You need Node.js 24.

```bash
npm ci
npm run dev
```

The full project check is:

```bash
npm run gate
```

It runs formatting, linting, strict TypeScript, frozen-design checks, unit tests, production-mode Pixel 7 journeys, and the production build.

The browser suite generates an authored synthetic catalogue through the real
SQLite builder. CI then builds the normal Pages artifact separately and verifies
the licensed production catalogue, offline assets and absence of test bridges.
Motion for React handles deliberate transitions and disclosures; native scrolling,
reduced-motion preferences and the existing Reading Room design remain intact.

## Acknowledgements

The offline catalogue is built from Open Library bulk metadata and Wikidata. The illustrations are adapted from Storyset artwork supplied for this project. Literata and Source Sans 3 are self-hosted through Fontsource. The current app icon uses the owner's supplied X-and-quill artwork.

Current release evidence and remaining device checks are in [the handoff](docs/HANDOFF.md); [upgrade and rollback instructions](docs/astra/RELEASE.md) explain how to preserve on-device data. The immutable `design/` package records the original design; [DESIGN-STATE.md](docs/DESIGN-STATE.md) records the adopted Reading Room.
