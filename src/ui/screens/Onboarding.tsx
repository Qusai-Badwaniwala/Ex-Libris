import { useState } from 'react';
import { Constellation } from '../constellation';
import { caption, displayL, displayS, label, resetButton } from '../styles';
import { prefersReducedMotion } from '../theme';
import { WELCOME_ART_MS, WELCOME_BEATS } from '../design-literals';

/**
 * First run. Ported from design/Ex Libris.dc.html.
 *
 * The welcome screen is the longest motion sequence in the app and the only
 * place a stagger is allowed: it runs exactly once in a reader's life, which is
 * the frequency band where expressive motion is welcome (MOTION §11). Reduced
 * motion drops the stagger entirely rather than shortening it.
 *
 * The four-step spotlight tour that follows the bookplate (D-074) is Phase 1
 * work still to come — it has to point at real controls, and it measures their
 * rects live rather than hardcoding them.
 */

function beat(i: number) {
  if (prefersReducedMotion()) return undefined;
  return {
    animation: `exl-welcome var(--duration-fluid) var(--ease-fluid-out) ${WELCOME_BEATS[i]} both`,
  };
}

export function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          animation: prefersReducedMotion()
            ? undefined
            : `exl-art-in ${WELCOME_ART_MS} var(--ease-fluid-out) both`,
        }}
      >
        <Constellation />
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 'var(--space-7) var(--space-6)',
          gap: 'var(--space-3)',
        }}
      >
        <div style={{ ...label, ...beat(0) }}>Welcome to</div>
        <div style={{ ...displayL, fontSize: '52px', lineHeight: '56px', ...beat(1) }}>
          Ex Libris
        </div>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '19px',
            lineHeight: 'var(--lh-body-l)',
            color: 'var(--text-secondary)',
            textWrap: 'pretty',
            ...beat(2),
          }}
        >
          A private record of what you have read — books, web novels and manhwa, on one shelf.
        </div>
        <div
          style={{
            height: 'var(--hairline-width)',
            background: 'var(--hairline-strong)',
            transformOrigin: 'left',
            animation: prefersReducedMotion()
              ? undefined
              : `exl-rule var(--duration-fluid) var(--ease-fluid-out) ${WELCOME_BEATS[3]} both`,
            margin: 'var(--space-2) 0',
          }}
        />
        <div style={{ ...caption, color: 'var(--text-secondary)', ...beat(4) }}>
          It works with no signal, has no account, and nothing you write ever leaves this device.
        </div>
        <button
          data-active="accent"
          onClick={onNext}
          style={{
            ...resetButton,
            marginTop: 'var(--space-4)',
            height: 52,
            lineHeight: '52px',
            textAlign: 'center',
            borderRadius: 'var(--radius-button)',
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            fontSize: 'var(--size-body)',
            fontWeight: 500,
            ...beat(5),
          }}
        >
          Open the library
        </button>
      </div>
    </div>
  );
}

/**
 * The bookplate. The only time the app asks the reader for anything about
 * themselves, and afterwards it becomes the About screen unchanged.
 *
 * The name is required (D-042, closing Q-003): the button stays inert rather
 * than hidden, and the line under it says why. "Skip for now" is gone.
 */
export function Bookplate({
  initial = '',
  onDone,
  heading = 'Open the library',
}: {
  initial?: string;
  onDone: (name: string) => void;
  heading?: string;
}) {
  const [name, setName] = useState(initial);
  const ok = name.trim().length > 0;

  return (
    <div
      className="exl-scroll"
      style={{
        position: 'absolute',
        inset: 0,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'calc(var(--space-6) + var(--safe-top)) var(--space-5) var(--space-6)',
        gap: 'var(--space-5)',
      }}
    >
      <div style={{ position: 'relative', width: '100%', maxWidth: 320, aspectRatio: '300 / 420' }}>
        {/* The engraved frame: three nested rules, a corner diamond on each
            side, four tick marks where the band rules meet the frame. */}
        <svg
          viewBox="0 0 300 420"
          fill="none"
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          <rect
            x="6"
            y="6"
            width="288"
            height="408"
            rx="3"
            stroke="var(--text-faint)"
            strokeWidth="1"
          />
          <rect
            x="16"
            y="16"
            width="268"
            height="388"
            rx="2"
            stroke="var(--accent)"
            strokeWidth="0.75"
          />
          <rect
            x="21"
            y="21"
            width="258"
            height="378"
            rx="2"
            stroke="var(--accent)"
            strokeWidth="0.75"
          />
          <path d="M21 104 L279 104 M21 300 L279 300" stroke="var(--accent)" strokeWidth="0.75" />
          <path d="M150 8 L156 16 L150 24 L144 16 Z" fill="var(--accent)" />
          <path d="M150 396 L156 404 L150 412 L144 404 Z" fill="var(--accent)" />
          <path d="M8 210 L16 204 L24 210 L16 216 Z" fill="var(--accent)" />
          <path d="M292 210 L284 204 L276 210 L284 216 Z" fill="var(--accent)" />
          <path
            d="M46 104 L46 96 M254 104 L254 96 M46 300 L46 308 M254 300 L254 308"
            stroke="var(--accent)"
            strokeWidth="0.75"
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            left: '10%',
            right: '10%',
            top: '4%',
            height: '20%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ ...displayL, fontWeight: 400 }}>Ex Libris</div>
        </div>
        <div
          style={{
            position: 'absolute',
            left: '16%',
            right: '16%',
            top: '27%',
            height: '41%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src="/illustrations/magic-tree-cuate.svg"
            alt=""
            style={{ maxWidth: '100%', maxHeight: '100%' }}
          />
        </div>
        <div
          style={{
            position: 'absolute',
            left: '12%',
            right: '12%',
            top: '75%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <div style={label}>From the books of</div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="your name"
            aria-label="Your name"
            data-focus="accent"
            style={{
              width: '100%',
              height: 40,
              textAlign: 'center',
              background: 'transparent',
              border: 'none',
              borderBottom: 'var(--hairline-width) solid var(--hairline-strong)',
              color: 'var(--text-primary)',
              ...displayS,
              outline: 'none',
            }}
          />
        </div>
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: 320,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}
      >
        <button
          data-active="accent"
          onClick={() => ok && onDone(name.trim())}
          style={{
            ...resetButton,
            width: '100%',
            textAlign: 'center',
            height: 52,
            lineHeight: '52px',
            borderRadius: 'var(--radius-button)',
            background: ok ? 'var(--accent)' : 'var(--surface-raised)',
            color: ok ? 'var(--on-accent)' : 'var(--text-secondary)',
            cursor: ok ? 'pointer' : 'default',
            fontSize: 'var(--size-body)',
            fontWeight: 500,
          }}
        >
          {heading}
        </button>
        <div
          style={{
            ...caption,
            color: 'var(--text-secondary)',
            textAlign: 'center',
            padding: '6px 12px',
          }}
        >
          {ok
            ? 'It goes on the bookplate, and nowhere else.'
            : 'The bookplate needs a name before the library opens.'}
        </div>
      </div>
    </div>
  );
}
