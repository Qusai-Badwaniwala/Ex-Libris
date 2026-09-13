import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ILLUSTRATION_NAMES,
  SOURCE_SHA256,
  hexToOklch,
  themeColor,
  themedSvg,
} from '../../scripts/generate-illustration-themes.ts';
import { illustrationPath } from '../../src/ui/illustration';

const HEX = /#[0-9a-f]{3}(?:[0-9a-f]{3})?\b/gi;
const normalize = (value: string) => {
  const raw = value.slice(1).toLowerCase();
  return `#${raw.length === 3 ? [...raw].map((part) => part + part).join('') : raw}`;
};
const colors = (svg: string) => [...svg.matchAll(HEX)].map((match) => normalize(match[0]));

function uiSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return uiSources(path);
    return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [path] : [];
  });
}

describe('theme-aware illustrations', () => {
  it('keeps the thirteen approved source SVGs byte-for-byte unchanged', () => {
    for (const name of ILLUSTRATION_NAMES) {
      const source = readFileSync(`public/illustrations/${name}.svg`);
      expect(createHash('sha256').update(source).digest('hex'), name).toBe(SOURCE_SHA256[name]);
    }
  });

  it('ships a warm-light and blue-grey-dark variant for every approved illustration', () => {
    for (const name of ILLUSTRATION_NAMES) {
      expect(existsSync(`public${illustrationPath(name, 'light')}`), `${name}/light`).toBe(true);
      expect(existsSync(`public${illustrationPath(name, 'dark')}`), `${name}/dark`).toBe(true);
    }
  });

  it('preserves distinct color ramps and perceptual lightness in both themes', () => {
    const completeSourceRamp = new Set<string>();
    for (const name of ILLUSTRATION_NAMES) {
      const source = readFileSync(`public/illustrations/${name}.svg`, 'utf8');
      const sourceColors = colors(source);
      sourceColors.forEach((color) => completeSourceRamp.add(color));
      for (const theme of ['light', 'dark'] as const) {
        const variant = readFileSync(`public/illustrations/${theme}/${name}.svg`, 'utf8');
        const variantColors = colors(variant);
        expect(variant, `${name}/${theme} deterministic output`).toBe(
          themedSvg(source, name, theme),
        );
        expect(variantColors, `${name}/${theme} occurrence count`).toHaveLength(
          sourceColors.length,
        );
        const mapping = new Map<string, string>();
        sourceColors.forEach((source, index) => mapping.set(source, variantColors[index]!));
        expect(new Set(mapping.values()).size, `${name}/${theme} distinct colors`).toBe(
          mapping.size,
        );
        for (const [source, variant] of mapping) {
          expect(
            Math.abs(hexToOklch(source).l - hexToOklch(variant).l),
            `${name}/${theme} ${source}`,
          ).toBeLessThan(0.006);
        }
      }
    }
    for (const theme of ['light', 'dark'] as const) {
      expect(new Set([...completeSourceRamp].map((color) => themeColor(color, theme))).size).toBe(
        completeSourceRamp.size,
      );
    }
  });

  it('keeps the approved magic tree visually and byte-for-byte unchanged in both themes', () => {
    const source = readFileSync('public/illustrations/magic-tree-cuate.svg', 'utf8');
    expect(readFileSync('public/illustrations/light/magic-tree-cuate.svg', 'utf8')).toBe(source);
    expect(readFileSync('public/illustrations/dark/magic-tree-cuate.svg', 'utf8')).toBe(source);
  });

  it('selects explicit theme paths and never falls back to the source directory', () => {
    expect(illustrationPath('dragon-rafiki', 'light')).toBe(
      '/illustrations/light/dragon-rafiki.svg',
    );
    expect(illustrationPath('dragon-rafiki', 'dark')).toBe('/illustrations/dark/dragon-rafiki.svg');
    const css = readFileSync('src/styles/base.css', 'utf8');
    expect(css).toContain("[data-illustration-theme='light']");
    expect(css).toContain("[data-illustration-theme='dark']");
    expect(css).toContain(":root[data-theme='light'] [data-illustration-theme='light']");
    expect(css).toContain(":root[data-theme='light'] [data-illustration-theme='dark']");
    const ui = uiSources('src/ui')
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    for (const name of ILLUSTRATION_NAMES) {
      expect(ui).not.toContain(`/illustrations/${name}.svg`);
    }
  });
});
