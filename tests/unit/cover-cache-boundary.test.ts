import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('cover storage boundary', () => {
  it('keeps virtual scroll restoration under its existing single owner', () => {
    expect(readFileSync('src/ui/motion.tsx', 'utf8')).toContain(':not([data-scroll-owner])');
    expect(readFileSync('src/ui/screens/Everything.tsx', 'utf8')).toContain(
      'data-scroll-owner="collection"',
    );
    expect(readFileSync('src/ui/Codex.tsx', 'utf8')).toContain('data-scroll-owner="codex"');
  });
  it('does not restore a duplicate month-long Workbox cover cache', () => {
    const config = readFileSync('vite.config.ts', 'utf8');
    expect(config).not.toContain("cacheName: 'exl-covers'");
    expect(config).not.toContain("handler: 'CacheFirst'");
    expect(config).toContain('runtimeCaching: []');
    expect(config).toContain('unique OPFS files');
  });
});
