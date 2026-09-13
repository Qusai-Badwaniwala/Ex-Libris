/**
 * Title-derived series evidence. Keep every accepted spelling here: scattered
 * regexes become an impossible-to-audit source of confident false groupings.
 */
export interface ParsedSeriesTitle {
  seriesName: string;
  position: number;
  pattern: 'parenthetical' | 'suffix' | 'of';
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};

function romanNumber(value: string): number | undefined {
  if (!/^[ivxlcdm]+$/i.test(value)) return undefined;
  const values: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
  let total = 0;
  let previous = 0;
  for (const character of [...value.toLowerCase()].reverse()) {
    const current = values[character] ?? 0;
    total += current < previous ? -current : current;
    previous = current;
  }
  return total > 0 && total <= 100 ? total : undefined;
}

function parsePosition(value: string): number | undefined {
  const normalized = value.normalize('NFKC').trim().toLowerCase();
  const numeric = Number(normalized);
  if (Number.isInteger(numeric) && numeric > 0 && numeric <= 10_000) return numeric;
  return WORD_NUMBERS[normalized] ?? romanNumber(normalized);
}

function cleanSeriesName(value: string): string | undefined {
  const clean = value
    .replace(/[,:\-–—]+$/u, '')
    .replace(/^[,:\-–—]+/u, '')
    .trim();
  return clean.length >= 3 ? clean : undefined;
}

const ORDINAL = String.raw`(\d{1,5}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|[ivxlcdm]{1,7})`;

/**
 * Parses only explicit ordinal forms. A trailing bare number ("Catch-22") or
 * a vague sequel word is not enough evidence to offer a grouping.
 */
export function parseSeriesTitle(title: string): ParsedSeriesTitle | undefined {
  const clean = title.normalize('NFKC').trim();
  if (!clean) return undefined;

  const parenthetical = clean.match(
    new RegExp(
      String.raw`\(([^()]{3,}?)\s*(?:,?\s*(?:book|volume|vol\.?|part)\s*|#)${ORDINAL}\s*\)\s*$`,
      'i',
    ),
  );
  if (parenthetical) {
    const seriesName = cleanSeriesName(parenthetical[1] ?? '');
    const position = parsePosition(parenthetical[2] ?? '');
    if (seriesName && position) return { seriesName, position, pattern: 'parenthetical' };
  }

  const ofForm = clean.match(
    new RegExp(String.raw`^(?:book|volume|vol\.?|part)\s*${ORDINAL}\s+of\s+(.{3,})$`, 'i'),
  );
  if (ofForm) {
    const position = parsePosition(ofForm[1] ?? '');
    const seriesName = cleanSeriesName(ofForm[2] ?? '');
    if (seriesName && position) return { seriesName, position, pattern: 'of' };
  }

  const suffix = clean.match(
    new RegExp(
      String.raw`^(.{3,}?)\s*(?:,?\s*(?:book|volume|vol\.?|part)\s*|\s+#)${ORDINAL}\s*$`,
      'i',
    ),
  );
  if (suffix) {
    const seriesName = cleanSeriesName(suffix[1] ?? '');
    const position = parsePosition(suffix[2] ?? '');
    if (seriesName && position) return { seriesName, position, pattern: 'suffix' };
  }

  return undefined;
}
