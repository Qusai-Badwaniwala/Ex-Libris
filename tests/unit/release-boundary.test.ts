// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assertNoTestCode, assertReleasedCatalogue } from '../../scripts/check-release.ts';

describe('public artifact boundary', () => {
  const approved = JSON.parse(readFileSync('deployment/corpus/manifest.json', 'utf8'));
  it('accepts only the approved catalogue identity and complete source ledger', () => {
    expect(() => assertReleasedCatalogue(approved)).not.toThrow();
    for (const change of [
      { distribution: 'engineering-fixture' },
      { bytes: 4_825_088 },
      { sha256: '0'.repeat(64) },
      { sources: { anilist: 438_584 } },
      { counts: { ...approved.counts, works: 3_722 } },
    ])
      expect(() => assertReleasedCatalogue({ ...approved, ...change })).toThrow();
  });
  it('rejects both named test chunks and test bridges merged into an ordinary chunk', () => {
    expect(() => assertNoTestCode('assets/test-bridge-abcd.js', 'export{}')).toThrow();
    expect(() =>
      assertNoTestCode('assets/index-abcd.js', 'window.__EXL_CATALOGUE_TEST__={}'),
    ).toThrow();
    expect(() => assertNoTestCode('assets/index-abcd.js', 'const title="Ex Libris"')).not.toThrow();
  });
});
