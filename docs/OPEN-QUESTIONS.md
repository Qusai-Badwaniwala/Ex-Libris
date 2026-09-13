# OPEN-QUESTIONS.md

Anything needing the owner. Marked `BLOCKING` or `NON-BLOCKING`. Resolved items
move to `DECISIONS.md` and are deleted from here.

Questions inherited from the design session live in `design/OPEN-QUESTIONS.md`.
The ones still live are restated below; the rest were answered on 2026-09-02 and
2026-09-03.

There is no unresolved blocking Phase 5, Phase 6, Phase 7, Phase 8, Phase 9, or
Phase 10 product decision. The owner
accepted Phase 5, approved exact title disclosure before bulk Wishlist addition,
then settled Q-017, authorized Phase 6, accepted it for sequencing, and
authorized Phase 7 on 2026-09-08. Translation always
appears as the seventh descriptive step; it remains outside six-axis
recommendation matching. Q-029 is a non-blocking post-phase proposal, and Q-028
remains a deferred release check. The owner accepted Phase 7 for sequencing and
authorized Phase 8 on 2026-09-08. Phase 8's implementation, focused review, and
full gate passed on 2026-09-12. The owner then accepted that checkpoint for
sequencing, authorized Phase 9, and approved Q-019's adaptive width proposal by
instructing work to continue. The owner then authorized Phase 10. Its final
audit and gate passed on 2026-09-13; Q-008 is resolved by explicit
rename/merge/delete maintenance without similarity suggestions.

---

## DEFERRED RELEASE CHECK

**Q-028 · Physical Android performance gate.** `DEFERRED BY OWNER ON
2026-09-06; NOT PASSED.` The desktop browser path is real
OPFS/worker/FTS5 but Pixel emulation does not emulate phone storage or CPU. The
engineering fixture's first cold query measured roughly 46-55 ms here, warmed
queries measured 1-4 ms, and the full Pixel-emulated UI regression is below
100 ms from input event to next-painted results. The real 438,584-work,
261.1-MiB production index also installs and searches correctly on desktop.
Release-quality evidence still requires the same production build on a
physical mid-range Android device and an under-50-ms input-to-painted-results
result. The owner explicitly said phone testing is not needed right now and
authorized work to continue to Phase 4. That is a sequencing decision, not a
measurement.

No Android device or `adb` executable was available on 2026-09-06. When the
owner resumes this check, use the free Android Platform Tools, connect an
owner-supplied phone with USB debugging, run an ADB reverse tunnel from its
localhost to a production preview, then install and measure the production
index.

---

## NON-BLOCKING

**Q-029 · Explain an honest empty More Like This result?** `PROPOSED AFTER PHASE
6; NOT IMPLEMENTED.` More Like This is currently omitted when no other owned
work meets the minimum three shared rated axes plus one exact shared stop. A
quiet Detail line could explain that another work needs at least three shared
axes and offer a direct path to rate one. This preserves the threshold and makes
absence legible, but adds a visible state not present in the frozen design. The
owner should approve or decline it before implementation.

## FOR A LATER PHASE, RECORDED SO THEY ARE NOT LOST

**Q-013 · Re-reads.** Deferred by the owner. A finished work started again has
nowhere to go: the schema holds one `progressCurrent`, so a re-read either keeps
a wrong count or loses its finish date. Now partly cheaper to solve than it was,
because `readingSession` (E-005) already records each pass separately — a
re-read would be a second run of sessions rather than a schema change to `work`.
Not built, not designed.
