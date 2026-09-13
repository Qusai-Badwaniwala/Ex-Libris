export const ILLUSTRATION_NAMES = [
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
] as const;

export type IllustrationName = (typeof ILLUSTRATION_NAMES)[number];
