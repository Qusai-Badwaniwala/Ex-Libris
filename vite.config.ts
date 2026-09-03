import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
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
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        globIgnores: ['**/corpus/**'],
        navigateFallbackDenylist: [/^\/corpus\//],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            // Covers are fetched once and then live in OPFS. This cache is the
            // in-flight safety net, not the store of record.
            urlPattern:
              /^https:\/\/(covers\.openlibrary\.org|s4\.anilist\.co|uploads\.mangadex\.org)\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'exl-covers',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Ex Libris',
        short_name: 'Ex Libris',
        description: 'A private archive of what you have read.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#212631',
        theme_color: '#212631',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        share_target: {
          action: '/share',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
      },
      devOptions: { enabled: false },
    }),
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
});
