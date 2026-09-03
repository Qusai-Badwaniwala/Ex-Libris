import { useEffect, useRef } from 'react';
import { displayL } from './styles';
import { prefersReducedMotion } from './theme';

/**
 * The boot splash. The only place in the app where the reader waits on purpose.
 *
 * Its job is not decoration: written text paints in one frame and thirteen SVGs
 * do not, so without it the first screen is seen half-illustrated (D-050). The
 * bar advances one thirteenth per illustration that lands, and a failed fetch
 * still advances it — boot must never hang on an asset.
 *
 * Minimum 520ms so it reads as a beat rather than a flicker, then a 240ms fade.
 * On a warm cache the images resolve immediately and the minimum is the whole
 * of it.
 */

const FILES = [
  'magic-tree-cuate',
  'dragon-rafiki',
  'library-pana',
  'cherry-tree-pana',
  'knowledge-rafiki',
  'cherry-tree-amico',
  'cherry-blossom-cuate',
  'research-paper-amico',
  'studying-bro',
  'library-rafiki',
  'bibliophile-rafiki',
  'bibliophile-bro',
  'bibliophile-pana',
];

/** MOTION.md §"Boot". Not a token: it is a floor on a wait, not a duration of
 *  a transition, and no other surface has one. */
const MINIMUM_MS = 520; // tokens-allow: MOTION.md, boot

export function Splash({ onDone }: { onDone: () => void }) {
  const bar = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const started = Date.now();
    let done = 0;
    let cancelled = false;

    const bump = () => {
      done++;
      if (bar.current) bar.current.style.width = `${Math.round((done / FILES.length) * 100)}%`;
    };

    void Promise.all(
      FILES.map(
        (f) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            // onerror counts too. An illustration that 404s must not hold the
            // whole app at a splash screen forever.
            img.onload = img.onerror = () => {
              bump();
              resolve();
            };
            img.src = `/illustrations/${f}.svg`;
          }),
      ),
    ).then(() => {
      if (cancelled) return;
      const wait = Math.max(0, MINIMUM_MS - (Date.now() - started));
      window.setTimeout(() => {
        if (cancelled) return;
        const el = root.current;
        if (el && !prefersReducedMotion()) {
          el.style.transition = 'opacity var(--dur-slow) var(--ease-out)';
          el.style.opacity = '0';
          window.setTimeout(onDone, 250); // tokens-allow: matches --dur-slow, MOTION.md boot
        } else {
          onDone();
        }
      }, wait);
    });

    return () => {
      cancelled = true;
    };
  }, [onDone]);

  return (
    <div
      ref={root}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'var(--surface-base)',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-5)',
      }}
    >
      <div style={displayL}>Ex Libris</div>
      {/* No spinner, no logo animation, no tagline. Real progress only. */}
      <div style={{ width: 104, height: 1, background: 'var(--hairline-strong)' }}>
        <div
          ref={bar}
          style={{
            width: '0%',
            height: '100%',
            background: 'var(--accent)',
            transition: 'width var(--dur-base) var(--ease-out)',
          }}
        />
      </div>
    </div>
  );
}
