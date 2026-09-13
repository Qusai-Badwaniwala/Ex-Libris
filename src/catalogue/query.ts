/**
 * Build an FTS5 expression from human input without exposing FTS operators.
 * Every token is quoted, so punctuation such as `:` or `-` cannot turn a title
 * into SQL/FTS syntax. Six words is enough to disambiguate a title and bounds
 * query work for pasted paragraphs.
 */
export function toFtsPrefixQuery(input: string): string {
  const tokens = input
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .match(/[\p{L}\p{N}]+/gu)
    ?.slice(0, 6);
  if (!tokens?.length) return '';
  return tokens.map((token) => `"${token.replaceAll('"', '""')}"*`).join(' AND ');
}
