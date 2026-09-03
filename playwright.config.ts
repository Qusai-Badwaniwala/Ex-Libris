import { defineConfig, devices } from '@playwright/test';

/**
 * The tests run against a PRODUCTION BUILD served by `vite preview`, not
 * against the dev server. Dev and production are different programs here: the
 * service worker only exists in the build, and the dev server serves modules
 * the build has already bundled away. Testing the mode we do not ship is how a
 * green suite ends up sitting on top of a blank screen.
 *
 * localhost is a secure context, so OPFS and storage.persist() behave the way
 * they will on the phone. A bare LAN IP over http is not, which is the single
 * biggest difference between this and testing by hand over wi-fi — see
 * docs/HANDOFF.md.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      // The reference device. Not because the app is tuned for it, but because
      // a 6.6" 1080p Android phone is what the design was composed against.
      name: 'android',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
