# ILLUSTRATION-NOTES.md
Keeps a later session working in the same hand.

## What changed from the brief
Brief §3.5 specified original monoline line art, one hand, one ink, with a recurring figure appearing five to eight times. The user supplied thirteen flat-colour Storyset illustrations instead and asked for them to be used and recoloured. The crow and the hands are dropped.

**Rules that still bind:**
1. Illustration appears only where content does not — empty states, first run, the finish moment, the Stats plate. Never on a screen that has books on it. Never in the chrome.
2. One ramp. Every illustration is recoloured onto the ten `--il-*` tokens and nothing else. This is what makes drawings by five illustrators read as one set, and it replaces "one hand, one weight, one ink".
3. One illustration per screen, never two.

**Rules deliberately relaxed, with reasons:**
- *Never behind text* is broken in exactly two places: the finish moment and the blank note editor, both at low opacity, both on screens that are otherwise empty. Everywhere else it holds.
- *A recurring figure* is gone. Continuity is carried by colour, which is a weaker thread. Accepted trade.

## The recolour — hue harmonisation, not flattening
**Superseded method (do not go back to it):** the first pass mapped every source colour onto ten `--il-*` tokens. It made the set cohesive and destroyed every drawing — all whites collapsed to one paper, all darks to one ink, and every brand hue to one amber, so shading, highlights and secondary shapes disappeared. The user's verdict was "too orangish, details gone", and they were right.

**Current method.** Each distinct source colour is converted to OKLab, and only its *hue* and *chroma* are touched:
- **Lightness is never changed.** This is what keeps every internal distinction — shading, highlights, rim light, secondary shapes — exactly as the illustrator drew it.
- **Hue** travels 35% of the way toward the nearer of two palette anchors: 62° (crema amber) or 245° (the cool slate). A partial pull, so a blue still reads as a blue and the set does not turn monochrome.
- **Chroma** is scaled to 0.9 and then clamped to 0.105, which is the ceiling the rest of the palette sits under. This is what turns a bright Storyset blue into palette slate without touching its lightness.
- **Near-neutrals** (chroma under 0.022) pass through untouched. Whites stay white, greys stay grey.
- Every distinct input maps to a distinct output. Nothing merges. That property is the whole point.

**`magic-tree-cuate.svg` is exempt** and ships exactly as drawn — the user prefers it that way, and its native gold already sits in the palette.

Illustrations now carry **literal hex**, not `var()`. They no longer respond to the theme, which is correct: they are artwork drawn for a light ground, they read on both surfaces, and `<img>` now works everywhere with no inlining needed. The `--il-*` tokens remain in tokens.css but nothing consumes them; leave them or delete them, they are inert.

**Also stripped:** Storyset's `freepik--background-simple` group — a decorative dot field or blob behind every figure. On our own surfaces it read as a stray lighter rectangle, and inside the bookplate frame it fought the rules. Verified before removal that no subject fill lives in that group.

**Originals** are untouched in `uploads/`. The transform is deterministic and re-runnable from them.

## Placements — all thirteen, one each
| file | screen | size |
|---|---|---|
| magic-tree-cuate | Bookplate, and About thereafter | full width |
| dragon-rafiki | Empty library | full screen — the only one allowed to |
| library-pana | Corpus download (750×500, the only wide file) | full width |
| cherry-tree-pana | Finish moment, behind the tick | 150% width, opacity 0.14 |
| knowledge-rafiki | Stats, opening plate | ~200px |
| cherry-tree-amico | Year divider in Stats | ~160px |
| cherry-blossom-cuate | Empty wishlist | ~200px |
| research-paper-amico | Empty notes | ~200px |
| studying-bro | Note editor, blank body | low opacity, clears on first keystroke |
| library-rafiki | Empty format shelf | ~200px |
| bibliophile-rafiki | No search results | 120px |
| bibliophile-bro | Empty trash | 120px |
| bibliophile-pana | Backup with no history | ~160px |

## Still to draw by hand
The bookplate frame. Engraved-style nested rules with corner diamonds, geometric, no figures — within what SVG-by-hand can do well. Drafted on the Phase 0 direction page; finalise in Phase 5.


## Phase 7 · placements now live
Four of the planned placements were built, all at the sizes the table above specifies, all with literal-hex files loaded through `<img>`:

- `knowledge-rafiki` — Stats, opening plate, 200px, above the year line. The ledger below it has no illustration in it.
- `cherry-tree-amico` — Stats, the divider before "Before this year", 140px, centred above the heading. The one sanctioned appearance among content: it divides the ledger rather than decorating them.
- `library-pana` — Corpus download, full width, above the copy. The screen is otherwise almost empty, which is exactly where illustration belongs.
- `studying-bro` — Note editor, behind an empty body at 0.16 opacity, `pointer-events: none`, gone from the first keystroke. The second of the two deliberate behind-content exceptions.

`magic-tree-cuate` now also carries About, as the brief intends the bookplate to become About. It ships untouched by the harmonisation there too.

Wishlist, Stats, Notes, Settings, Backup and Trash all have content on them and therefore no illustration, empty states aside.
