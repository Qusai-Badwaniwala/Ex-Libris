import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ILLUSTRATION_NAMES } from '../src/ui/illustration-manifest.ts';

export { ILLUSTRATION_NAMES } from '../src/ui/illustration-manifest.ts';

export type IllustrationTheme = 'light' | 'dark';

const CURRENT_FILE = fileURLToPath(import.meta.url);
const PROJECT_ROOT = dirname(dirname(CURRENT_FILE));
const SOURCE_DIR = join(PROJECT_ROOT, 'public', 'illustrations');

// These are the supplied harmonised files. The generator refuses to run if an
// original changes: derived artwork must never become an accidental second
// source of truth.
export const SOURCE_SHA256: Readonly<Record<(typeof ILLUSTRATION_NAMES)[number], string>> = {
  'bibliophile-bro': '9e78a919f79e9a01805e6c1309e713287911095baa594593a6f932528f254846',
  'bibliophile-pana': 'df4ee6e831860895154005996a8e54e27e4d8eaf76233bdc30ef73d35a303950',
  'bibliophile-rafiki': 'a548aea844568901f42ad133fa8a81ddec487d38d2732a64d76f51397f629692',
  'cherry-blossom-cuate': '43af1375d4dbf36f1d08f11bd81c9073f3a521c6c5e5aaa5752435f4884ceb1a',
  'cherry-tree-amico': 'cb2248ea4d6fdc0720588761cb7771d2f6ef17d10d2f7117c1622b0751ac838b',
  'cherry-tree-pana': 'bd197610aed3da1eb89982a5804b022c8835e954ee54be5ef76179486b09bec1',
  'dragon-rafiki': '68f07a5ce557f01b9267b1149fadc4b853fc375949b241a31777bcfee7466857',
  'knowledge-rafiki': 'a0b7056dcb0ed0a36d3e1626b6c9ba2d480a857bae1d0d5b685fcdea2af4ab92',
  'library-pana': 'b3376f1f8c59d900acb75458f3424a81d4031ed315b57ee0b57646295cad868e',
  'library-rafiki': 'ba161dbc0b42e006a1a5f7f47ba76f7b78b29d6d1e0d68a1063b4d99ca231995',
  'magic-tree-cuate': 'fd9c52e4ca4f6f23c2b74cdf89a106a86fe22d4485236f474346dd1288282121',
  'research-paper-amico': 'a8a2b0089dddd56ace5a2136d8572d044ed187dd13d3a73050c7f54b0f4b2cfb',
  'studying-bro': '950d22de8cd5fef4e753562d8719e70fa199c507d28c5c9ca8f076344fef1f64',
};

const HEX = /#[0-9a-f]{3}(?:[0-9a-f]{3})?\b/gi;
const SKIN_RAMP = new Set(['#fac7b7', '#f9c19f', '#e49d71', '#e08f77']);

interface Oklch {
  l: number;
  c: number;
  h: number;
}

const srgbToLinear = (value: number) =>
  value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;

const linearToSrgb = (value: number) =>
  value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;

function normalizeHex(value: string) {
  const raw = value.slice(1).toLowerCase();
  return `#${raw.length === 3 ? [...raw].map((part) => part + part).join('') : raw}`;
}

export function hexToOklch(value: string): Oklch {
  const hex = normalizeHex(value);
  const red = srgbToLinear(Number.parseInt(hex.slice(1, 3), 16) / 255);
  const green = srgbToLinear(Number.parseInt(hex.slice(3, 5), 16) / 255);
  const blue = srgbToLinear(Number.parseInt(hex.slice(5, 7), 16) / 255);
  const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
  const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const b = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const hue = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return { l: lightness, c: Math.hypot(a, b), h: hue };
}

function oklchToHex({ l: lightness, c: chroma, h: hue }: Oklch) {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const channels = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((channel) => Math.round(Math.min(1, Math.max(0, linearToSrgb(channel))) * 255));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function artDirectedHue(source: string, theme: IllustrationTheme, hue: number) {
  if (SKIN_RAMP.has(source)) return theme === 'light' ? hue : 350;
  if (theme === 'light') {
    if (hue >= 85 && hue < 180) return 88; // paper-warm olive and sage
    if (hue >= 180 && hue < 310) return 38; // cool Storyset accents become leather/copper
    return 62; // existing ambers and reds resolve into the cream theme
  }
  if (hue >= 85 && hue < 180) return 205; // botanical values become blue-teal
  if (hue >= 180 && hue < 310) return 248; // blues and violets join the slate family
  return 276; // orange ornament becomes luminous ink-violet, not muddy grey
}

export function themeColor(value: string, theme: IllustrationTheme) {
  const source = normalizeHex(value);
  const color = hexToOklch(source);
  if (color.c < 0.022) return source.toUpperCase();
  const skin = SKIN_RAMP.has(source);
  const chromaScale = theme === 'light' ? 0.86 : skin ? 0.68 : 0.76;
  const chromaCeiling = theme === 'light' ? 0.105 : 0.09;
  return oklchToHex({
    // Lightness is deliberately invariant. It carries every highlight, fold,
    // shadow and plane distinction in the supplied drawings.
    l: color.l,
    c: Math.min(color.c * chromaScale, chromaCeiling),
    h: artDirectedHue(source, theme, color.h),
  });
}

export function themedSvg(source: string, name: string, theme: IllustrationTheme) {
  if (name === 'magic-tree-cuate') return source;
  const mapped = new Map<string, string>();
  return source.replace(HEX, (match) => {
    const normalized = normalizeHex(match);
    let next = mapped.get(normalized);
    if (!next) {
      next = themeColor(normalized, theme);
      if ([...mapped.values()].includes(next)) {
        throw new Error(`${name}/${theme}: ${normalized} would collapse into ${next}`);
      }
      mapped.set(normalized, next);
    }
    return next;
  });
}

export function generateIllustrationThemes() {
  const available = readdirSync(SOURCE_DIR)
    .filter((file) => file.endsWith('.svg'))
    .map((file) => basename(file, '.svg'))
    .sort();
  const expected = [...ILLUSTRATION_NAMES].sort();
  if (available.join('\n') !== expected.join('\n')) {
    throw new Error('The illustration source set is not the approved thirteen-file set.');
  }

  for (const name of ILLUSTRATION_NAMES) {
    const source = readFileSync(join(SOURCE_DIR, `${name}.svg`), 'utf8');
    const hash = createHash('sha256').update(source).digest('hex');
    if (hash !== SOURCE_SHA256[name]) throw new Error(`${name}.svg source hash changed.`);
    for (const theme of ['light', 'dark'] as const) {
      const outputDir = join(SOURCE_DIR, theme);
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(join(outputDir, `${name}.svg`), themedSvg(source, name, theme), 'utf8');
    }
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) ===
    fileURLToPath(new URL(`file:///${process.argv[1].replaceAll('\\', '/')}`))
) {
  generateIllustrationThemes();
}
