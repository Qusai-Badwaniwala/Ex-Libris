# OPEN-QUESTIONS.md

Anything needing the owner. Marked `BLOCKING` or `NON-BLOCKING`. Resolved items
move to `DECISIONS.md` and are deleted from here.

Questions inherited from the design session live in `design/OPEN-QUESTIONS.md`.
The ones still live are restated below; the rest were answered on 2026-09-02 and
2026-09-03.

---

## NON-BLOCKING

**Q-017 · What "skip the translation axis" means.** `NON-BLOCKING — needed by
Phase 6.` The owner skipped it on the grounds that nearly everything they read
is an English translation. That reasoning supports two opposite builds:

1. **Drop the axis entirely.** Six axes, no translation, `isTranslated` stays
   dormant forever and could eventually be removed.
2. **Keep the axis and always show it.** If nearly everything is translated, the
   gate is pointless but the axis is not — a Rough translation and a Fluent one
   are exactly the distinction the axis exists to record.

`isTranslated` is in the schema either way and nothing sets it today. Reading 2
is the one that loses nothing, but this is the owner's call.

**Q-018 · The app icon.** `NON-BLOCKING.` Claude Design produced no icon and one
is required for an installable PWA. `scripts/icon.svg` reuses the bookplate
frame — nested rules, corner diamonds, tick marks — on the dark page colour, and
`public/icons/` holds the three PNGs the manifest names. It is deliberately the
most conservative thing that could be assembled from the existing vocabulary.
Worth thirty seconds of the owner's eye at a launcher size, because it is the
one piece of the app seen before the app opens.

**Q-019 · Adaptive spine width buckets change the width key's labels.**
`NON-BLOCKING — needed by Phase 9.` The owner asked for adaptive buckets so
Reverend Insanity at 2,300 chapters is not tied with a 1,250-chapter novel.
Proposed: five thresholds computed as quintiles of the library's own length
distribution, separate ladders for chapters and pages, recomputed when the
library changes, cached in settings so a spine never changes width between
renders. Below about forty works, quintiles are noise, so it falls back to
D-027's fixed ladder.
The visible consequence is that the WidthKey at the foot of spine view prints
live numbers instead of the fixed "<40 / 150 / 500 / 1.2k / 2k+". That is a
design-visible change to a component `design/COMPONENTS.md` specifies, so it is
flagged rather than assumed.

**Q-020 · Cover source of record versus the runtime cache.** `NON-BLOCKING —
needed by Phase 4.` Covers are stored in OPFS permanently and also pass through
a Workbox `CacheFirst` runtime cache capped at 400 entries and 30 days. Two
copies of the same bytes. The runtime cache is only the in-flight safety net for
a fetch that is interrupted, but it does double the disk cost of a cover for a
month. Options: drop the runtime cache entirely and rely on OPFS plus a retry,
or keep it and accept the duplication. Leaning toward dropping it once the OPFS
path is proven in Phase 4.

**Q-021 · Should the trash purge on a schedule or on sight?**
`NON-BLOCKING — needed by Phase 1.` `SCHEMA.md` says a soft-deleted record is
hard-purged after thirty days. There is no server and no background job, so the
purge can only run when the app is opened. If the app is not opened for two
months, records sit in the trash past their thirty days and then vanish all at
once on the next launch. That is the honest behaviour and probably fine, but it
means the trash screen's "27 days left" is really "27 days, or until you next
open this after they expire". Proposing: purge on open, and word the trash
screen so it does not promise a countdown it cannot run.

---

## FOR A LATER PHASE, RECORDED SO THEY ARE NOT LOST

**Q-013 · Re-reads.** Deferred by the owner. A finished work started again has
nowhere to go: the schema holds one `progressCurrent`, so a re-read either keeps
a wrong count or loses its finish date. Now partly cheaper to solve than it was,
because `readingSession` (E-005) already records each pass separately — a
re-read would be a second run of sessions rather than a schema change to `work`.
Not built, not designed.

**Q-014 · "Ask a model" is hidden until it works.** Settled: the Settings row is
not rendered at all until the feature exists (Phase 10 at the earliest). A switch
that changes nothing is worse than an absent feature.

**Q-008 · Tag cleanup.** The design's Settings promises "three pairs look like
the same tag twice" and goes nowhere. `normalizedName` is now a unique index, so
exact collisions cannot happen at all; the interesting case is near-misses that
do not collide — "Dark fantasy" and "Grimdark". Build B9 in Phase 1 as rename,
merge and delete; a similarity-suggestion screen is a separate question and is
not proposed.
