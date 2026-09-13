import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('cover storage boundary', () => {
  it('does not restore a duplicate month-long Workbox cover cache', () => {
    const config = readFileSync('vite.config.ts', 'utf8');
    expect(config).not.toContain("cacheName: 'exl-covers'");
    expect(config).not.toContain("handler: 'CacheFirst'");
    expect(config).toContain('runtimeCaching: []');
    expect(config).toContain('unique OPFS files');
  });
});
