import type { ThemeChoice } from '../db/schema';

/**
 * Theme resolution.
 *
 * tokens.css defines dark on bare `:root` and light on `[data-theme='light']`
 * only — there is no `prefers-color-scheme` block, which is deliberate: the two
 * themes are not mirrors of each other (D-064, D-067) and the light values are
 * a genuine second palette rather than an inversion.
 *
 * The consequence is that `theme: 'system'` cannot be honoured by CSS alone. It
 * is resolved here, once, and written to the document element. Anything that
 * reads the theme reads that attribute.
 */

const LIGHT_QUERY = '(prefers-color-scheme: light)';

export function resolveTheme(choice: ThemeChoice): 'light' | 'dark' {
  if (choice === 'light' || choice === 'dark') return choice;
  return typeof matchMedia === 'function' && matchMedia(LIGHT_QUERY).matches ? 'light' : 'dark';
}

export function applyTheme(choice: ThemeChoice): 'light' | 'dark' {
  const resolved = resolveTheme(choice);
  const root = document.documentElement;
  // The dark palette is the bare :root, so the attribute is only ever set for
  // light. Setting data-theme="dark" would work but would leave two ways to
  // express the same state, and one of them would eventually go stale.
  if (resolved === 'light') root.setAttribute('data-theme', 'light');
  else root.removeAttribute('data-theme');
  return resolved;
}

/**
 * Follows the OS while the choice is 'system'. Returns an unsubscribe. The
 * listener is removed when the choice stops being 'system', so switching to an
 * explicit theme does not leave a listener behind that later overrides it.
 */
export function watchSystemTheme(
  choice: ThemeChoice,
  onChange: (resolved: 'light' | 'dark') => void,
): () => void {
  if (choice !== 'system' || typeof matchMedia !== 'function') return () => {};
  const mq = matchMedia(LIGHT_QUERY);
  const handler = () => onChange(applyTheme('system'));
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
