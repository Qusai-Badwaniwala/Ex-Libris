/** Identity and sort-key derivation. Every write path goes through these. */

export const newId = (): string => crypto.randomUUID();
export const nowIso = (): string => new Date().toISOString();

/**
 * Leading articles the library sorts past. English only on purpose: a
 * translated title is filed under the English article it was published with,
 * and stripping "Le"/"Der"/"El" would file a handful of works unpredictably
 * while leaving the rest alone. One rule, applied everywhere, beats a clever
 * rule applied inconsistently.
 */
const LEADING_ARTICLES = ['a', 'an', 'the'];

/**
 * NFKC first: the catalogue mixes full-width and composed forms, and two titles
 * that look identical must produce one sort key. Diacritics are kept — "Ångström"
 * sorting under A is the locale collator's job, not ours to fake by stripping.
 */
export function sortTitleOf(title: string): string {
  const clean = title
    .normalize('NFKC')
    .replace(/[‘’“”]/g, "'")
    .trim()
    .toLowerCase();
  const space = clean.indexOf(' ');
  if (space > 0) {
    const first = clean.slice(0, space);
    if (LEADING_ARTICLES.includes(first)) return clean.slice(space + 1).trim();
  }
  return clean;
}

/**
 * "Pierce Brown" -> "Brown, Pierce". A single-token name is returned unchanged:
 * studios and mononyms are common in this library ("Studio Baekdu"), and
 * inverting them produces nonsense.
 */
export function sortNameOf(name: string): string {
  const clean = name.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  const parts = clean.split(' ');
  if (parts.length < 2) return clean;
  const last = parts[parts.length - 1] as string;
  const rest = parts.slice(0, -1).join(' ');
  return `${last}, ${rest}`;
}

/** The dedupe key for tags. SCHEMA §7 merges on collision. */
export function normalizeTag(name: string): string {
  return name.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}
