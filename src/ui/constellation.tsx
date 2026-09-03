/**
 * The constellation behind Home and the welcome screen.
 *
 * Copied path-for-path from design/Ex Libris.dc.html. It is the only decorative
 * thing in the app, which is why it has its own colour tier well under
 * `--hairline`: it must never compete with a hairline that means something
 * (D-076). Dark needs roughly a third of light's value, and both live in
 * tokens.css as `--art-line` and `--art-dot`.
 */
export function Constellation() {
  return (
    <svg
      viewBox="0 0 800 800"
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: '-6%',
        left: '-34%',
        width: '168%',
        pointerEvents: 'none',
      }}
    >
      <g fill="none" stroke="var(--art-line)" strokeWidth="2.1">
        <path d="M769 229L1037 260.9M927 880L731 737 520 660 309 538 40 599 295 764 126.5 879.5 40 599-197 493 102 382-31 229 126.5 79.5-69-63" />
        <path d="M-31 229L237 261 390 382 603 493 308.5 537.5 101.5 381.5M370 905L295 764" />
        <path d="M520 660L578 842 731 737 840 599 603 493 520 660 295 764 309 538 390 382 539 269 769 229 577.5 41.5 370 105 295 -36 126.5 79.5 237 261 102 382 40 599 -69 737 127 880" />
        <path d="M520-140L578.5 42.5 731-63M603 493L539 269 237 261 370 105M902 382L539 269M390 382L102 382" />
        <path d="M-222 42L126.5 79.5 370 105 539 269 577.5 41.5 927 80 769 229 902 382 603 493 731 737M295-36L577.5 41.5M578 842L295 764M40-201L127 80M102 382L-261 269" />
      </g>
      <g fill="var(--art-dot)">
        {[
          [769, 229],
          [539, 269],
          [603, 493],
          [731, 737],
          [520, 660],
          [309, 538],
          [295, 764],
          [40, 599],
          [102, 382],
          [127, 80],
          [370, 105],
          [578, 42],
          [237, 261],
          [390, 382],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="8" />
        ))}
      </g>
    </svg>
  );
}
