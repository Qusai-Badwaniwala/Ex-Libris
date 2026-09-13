import { expect, test, type Page } from '@playwright/test';

async function clearDevice(page: Page) {
  await page.goto('/');
  await page.evaluate(async () => {
    for (const registration of await navigator.serviceWorker.getRegistrations()) {
      await registration.unregister();
    }
    for (const key of await caches.keys()) await caches.delete(key);
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase('ex-libris');
      request.onsuccess = request.onerror = request.onblocked = () => resolve(null);
    });
  });
  await page.reload();
}

test('Settings gives honest manual installation steps when no browser prompt is available', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.addEventListener('beforeinstallprompt', (event) => event.stopImmediatePropagation(), {
      capture: true,
    });
  });
  await clearDevice(page);
  await page.getByRole('button', { name: 'Open the library' }).click();
  await page.getByLabel('Your name').fill('Qusai');
  await page.getByRole('button', { name: 'Open the library' }).click();
  await page.getByRole('button', { name: 'Skip' }).click();

  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('button', { name: 'Settings' })
    .click();
  await page.getByRole('button', { name: 'Install' }).click();

  await expect(
    page.getByText(
      'Open your browser menu, choose Install app or Add to Home screen, then confirm.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hide the steps' })).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/release-install-fallback-light.png' });

  await page.getByRole('button', { name: 'Hide the steps' }).click();
  await expect(page.getByText('Open your browser menu')).toHaveCount(0);
});
