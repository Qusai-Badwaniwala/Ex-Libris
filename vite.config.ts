import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const configuredBase = process.env.VITE_BASE_PATH || '/';
const basePath = `/${configuredBase.replace(/^\/+|\/+$/g, '')}${configuredBase === '/' ? '' : '/'}`;
const escapedBasePath = basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The production Open Library/Wikidata corpus lives in `public/corpus`. The
 * AniList/MangaDex engineering fixture lives under pipeline/.cache and is
 * copied into `dist` only after an explicit test-mode build. Keeping the two
 * outputs physically separate prevents a routine Playwright run from
 * overwriting the distributable catalogue.
 */
function corpusDistributionGuard(mode: string, command: string) {
  return {
    name: 'ex-libris-corpus-distribution-guard',
    closeBundle() {
      if (command !== 'build') return;
      const corpusDir = fileURLToPath(new URL('./dist/corpus', import.meta.url));
      const manifestPath = join(corpusDir, 'manifest.json');

      if (mode === 'test') {
        const fixtureDir = fileURLToPath(
          new URL('./pipeline/.cache/fixture-corpus', import.meta.url),
        );
        const fixtureManifestPath = join(fixtureDir, 'manifest.json');
        if (!existsSync(fixtureManifestPath)) {
          throw new Error('The Playwright catalogue fixture has not been built.');
        }
        const fixtureManifest = JSON.parse(readFileSync(fixtureManifestPath, 'utf8')) as {
          distribution?: string;
        };
        if (fixtureManifest.distribution !== 'engineering-fixture') {
          throw new Error('The Playwright catalogue is not marked as an engineering fixture.');
        }
        rmSync(corpusDir, { recursive: true, force: true });
        cpSync(fixtureDir, corpusDir, { recursive: true });
        console.log('Placed the isolated engineering corpus fixture in the test build.');
        return;
      }

      if (!existsSync(manifestPath)) return;

      let production = false;
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
          distribution?: string;
        };
        production = manifest.distribution === 'production';
      } catch {
        // An unreadable permission marker is not permission to distribute.
      }

      if (!production) {
        rmSync(corpusDir, { recursive: true, force: true });
        console.log('Excluded the non-production corpus fixture from dist.');
      }
    },
  };
}

export default defineConfig(({ mode, command }) => ({
  base: basePath,
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // the phone reaches the dev server over the LAN. OPFS and the service
    // worker both need a secure context, so a bare http://192.168.x.x will
    // start but will not persist anything — see docs/HANDOFF.md.
    host: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      // The corpus is downloaded at runtime into OPFS, never precached: Workbox
      // would otherwise try to hold hundreds of megabytes in the Cache Storage
      // API alongside the copy already in OPFS.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,wasm}'],
        globIgnores: ['**/corpus/**'],
        navigateFallbackDenylist: [new RegExp(`^${escapedBasePath}corpus/`)],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // Covers are fetched into unique OPFS files and become visible only
        // after their Dexie pointer commits. Retrying is safe, so a second
        // month-long Cache Storage copy has no recovery job left to perform.
        runtimeCaching: [],
      },
      manifest: {
        name: 'Ex Libris',
        short_name: 'Ex Libris',
        description: 'A private archive of what you have read.',
        start_url: basePath,
        scope: basePath,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#212631',
        theme_color: '#212631',
        icons: [
          { src: `${basePath}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${basePath}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
          {
            src: `${basePath}icons/icon-maskable-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        share_target: {
          action: `${basePath}share`,
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
      },
      devOptions: { enabled: false },
    }),
    corpusDistributionGuard(mode, command),
  ],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    setupFiles: ['tests/unit/setup.ts'],
  },
}));
