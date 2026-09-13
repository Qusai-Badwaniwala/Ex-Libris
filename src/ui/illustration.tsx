import type { CSSProperties } from 'react';
import type { IllustrationName } from './illustration-manifest';

export { ILLUSTRATION_NAMES, type IllustrationName } from './illustration-manifest';

export function illustrationPath(name: IllustrationName, theme: 'light' | 'dark') {
  return `${import.meta.env.BASE_URL}illustrations/${theme}/${name}.svg`;
}

/**
 * Both theme drawings stay in the DOM so changing theme never flashes the old
 * palette while React catches up. CSS exposes exactly one of them from the
 * root theme attribute; the dark drawing is the no-attribute default.
 */
export function Illustration({
  name,
  style,
  className,
}: {
  name: IllustrationName;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <>
      <img
        className={className}
        data-illustration-theme="light"
        src={illustrationPath(name, 'light')}
        alt=""
        style={style}
      />
      <img
        className={className}
        data-illustration-theme="dark"
        src={illustrationPath(name, 'dark')}
        alt=""
        style={style}
      />
    </>
  );
}
