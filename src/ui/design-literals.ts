/**
 * The handful of literal values the design uses that tokens.css does not define.
 *
 * `tokens.css` is the contract and is byte-frozen — `npm run check:tokens`
 * fails the build if it is edited — so these cannot be added to it. They also
 * must not be scattered through components, which is how a value ends up with
 * two slightly different answers in two files.
 *
 * So they live here, once, each with the decision it came from. Every line
 * carries `tokens-allow` because the structural check is otherwise right to
 * refuse them, and being forced to write that word is the point: it makes
 * adding a literal a deliberate act rather than an accident.
 *
 * If this list grows past a dozen entries, that is the signal to ask the owner
 * for a tokens.css revision rather than to keep appending.
 */

/**
 * Scrims. The prototype writes these inline at every modal surface. They are
 * not derived from a surface token because a scrim is not a surface — it is the
 * absence of one.
 */
export const SCRIM = 'rgba(0, 0, 0, 0.5)'; // tokens-allow: design/Ex Libris.dc.html, every sheet and the drawer
export const SCRIM_MENU = 'rgba(0, 0, 0, 0.42)'; // tokens-allow: lighter, because the FAB stays lit above it (D-062)

/**
 * The gold-leaf gradient under the drawer wordmark. It reads as leaf rather
 * than as a yellow label, which is why it is a four-stop gradient and not a
 * colour. Drawer only: on all five wordmarks it turned a credit into a
 * watermark (D-091).
 */
export const LEAF_GRADIENT = 'linear-gradient(100deg, #8A6A34, #E8C77A 42%, #C9A55E 58%, #8A6A34)'; // tokens-allow: D-091

/**
 * Stagger delays. These are choreography, not durations — the durations they
 * stagger are tokens. Each list is in the order the elements appear.
 */
/** The drawer's four rows trail the panel rather than racing it (D-065). */
export const DRAWER_ROW_DELAYS = ['140ms', '200ms', '260ms', '320ms']; // tokens-allow: D-065

/** The FAB's two doors, bottom one first — it is nearest the thumb (D-056). */
export const FAB_DOOR_DELAYS = ['60ms', '20ms']; // tokens-allow: D-056

/**
 * How long to wait before unmounting a surface that is animating out. It has to
 * outlast --dur-fast (120ms) by enough that the last frame is painted, and be
 * short enough that a fast reader never sees a dismissed sheet still present.
 * MOTION §8 specifies 130ms and the prototype uses exactly that.
 */
export const EXIT_UNMOUNT_MS = 130; // tokens-allow: MOTION.md §8

/**
 * The welcome screen's five beats plus its button. The longest sequence in the
 * app and the only place a stagger is allowed: it runs exactly once in a
 * reader's life, which is the frequency band where expressive motion is
 * welcome (MOTION.md §11).
 */
export const WELCOME_BEATS = ['120ms', '260ms', '440ms', '620ms', '760ms', '900ms']; // tokens-allow: MOTION.md §11

/** The constellation scales 1.06 -> 1 behind all of it. */
export const WELCOME_ART_MS = '1400ms'; // tokens-allow: MOTION.md §11
