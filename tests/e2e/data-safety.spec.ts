import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function clearDevice(page: Page, path = '/') {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__EXL_PHASE8_TEST__));
  await page.evaluate(() => window.__EXL_PHASE8_TEST__!.clearAutomaticBackups());
  await page.evaluate(async () => {
    for (const registration of await navigator.serviceWorker.getRegistrations()) {
      await registration.unregister();
    }
    for (const key of await caches.keys()) await caches.delete(key);
    if (navigator.storage.getDirectory) {
      const root = await navigator.storage.getDirectory();
      for (const directory of ['backups', 'covers']) {
        await root.removeEntry(directory, { recursive: true }).catch((error: unknown) => {
          if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error;
        });
      }
    }
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase('ex-libris');
      request.onsuccess = request.onerror = request.onblocked = () => resolve(null);
    });
  });
  await page.goto(path);
}

async function openLibrary(page: Page) {
  await page.getByRole('button', { name: 'Open the library' }).click();
  await page.getByLabel('Your name').fill('Qusai');
  await page.getByRole('button', { name: 'Open the library' }).click();
  const skip = page.getByRole('button', { name: 'Skip' });
  if (await skip.isVisible()) await skip.click();
  await page.waitForFunction(() => Boolean(window.__EXL_PHASE8_TEST__));
}

test.beforeEach(async ({ page }) => {
  await clearDevice(page);
  await openLibrary(page);
});

test('Backup shows honest empty and populated local states in both themes', async ({ page }) => {
  await page.evaluate(() => window.__EXL_PHASE8_TEST__!.clearAutomaticBackups());
  await page.evaluate(() => window.__EXL_PHASE8_TEST__!.openBackup());
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await expect(page.getByRole('heading', { name: 'Backup' })).toBeVisible();
  await expect(page.getByText('No backup history yet')).toBeVisible();
  await expect(
    page.locator('img[data-illustration-theme="light"][src$="bibliophile-pana.svg"]'),
  ).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/phase8-backup-empty-light.png' });

  await page.evaluate(async () => {
    await window.__EXL_PHASE8_TEST__!.seed();
    await window.__EXL_PHASE8_TEST__!.forceAutomaticBackup();
  });
  // Backup history is loaded on screen entry; re-enter from a fresh render to
  // exercise the same path the reader gets after navigating back here.
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__EXL_PHASE8_TEST__));
  await page.evaluate(() => window.__EXL_PHASE8_TEST__!.openBackup());
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await expect(page.getByText('Backed up on this device')).toBeVisible();
  await expect(page.getByText('1 work').first()).toBeVisible();
  await expect(page.getByText('1 note').first()).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/phase8-backup-history-dark.png' });
});

test('a downloaded ZIP is previewed before merge and retains current records', async ({ page }) => {
  await page.evaluate(() => window.__EXL_PHASE8_TEST__!.seed());
  await page.evaluate(() => window.__EXL_PHASE8_TEST__!.openBackup());
  await page.evaluate(() =>
    Object.defineProperty(window, 'showSaveFilePicker', {
      value: undefined,
      configurable: true,
    }),
  );
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export a copy now' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^ex-libris-manual-.*\.zip$/);
  const path = await download.path();
  expect(path).toBeTruthy();
  const downloaded = await readFile(path!);

  await page.evaluate(async () => {
    await window.__EXL_PHASE8_TEST__!.seed();
  });
  await page.getByRole('button', { name: 'Restore from a backup file' }).click();
  await page.getByLabel('Choose an Ex Libris backup').setInputFiles({
    name: download.suggestedFilename(),
    mimeType: 'application/zip',
    buffer: downloaded,
  });
  await expect(page.getByRole('heading', { name: 'Restore preview' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'merge' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText(/1 work, 1 note/)).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/phase8-restore-preview-light.png' });
  await page.getByRole('button', { name: 'Merge this backup' }).click();
  await expect(page.getByText('The library was restored in full.')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__EXL_PHASE8_TEST__!.counts()))
    .toEqual({
      works: 2,
      notes: 2,
    });
});

test('paste and generic CSV imports require a visible review before one batch write', async ({
  page,
}) => {
  await page.evaluate(() => window.__EXL_PHASE8_TEST__!.openBackup());
  await page.getByRole('button', { name: 'Paste a list of titles' }).click();
  await page.getByLabel('Titles to import').fill('Piranesi\npiranesi\nThe Dispossessed');
  await expect(page.getByText('2 distinct titles')).toBeVisible();
  await page.getByRole('button', { name: 'Review 2 titles' }).click();
  await expect(page.getByRole('heading', { name: 'Import preview' })).toBeVisible();
  await expect(page.getByText('no catalogue record selected')).toHaveCount(2);
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.screenshot({ path: '.impeccable/review/phase8-paste-preview-dark.png' });
  await page.getByRole('button', { name: 'Import 2 works' }).click();
  await expect(page.getByText('2 works were imported together.')).toBeVisible();

  await page.getByRole('button', { name: 'A CSV, with columns to map' }).click();
  await page.getByLabel('Choose a CSV file').setInputFiles({
    name: 'library.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'Book title,Writer,Reading Status,Progress,Rating,Tags\n"A, B",Mira Vale,Reading,12/40,4,Memory;War',
    ),
  });
  await expect(page.getByRole('heading', { name: 'Map the columns' })).toBeVisible();
  await expect(page.getByLabel('Title column')).toHaveValue('0');
  await expect(page.getByLabel('Author column')).toHaveValue('1');
  await expect(page.getByLabel('Rating column')).toHaveValue('4');
  await expect(page.getByRole('cell', { name: 'A, B' })).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/phase8-csv-map-light.png' });
  await page.getByRole('button', { name: 'Review mapped rows' }).click();
  await expect(page.getByLabel('Title for row 1')).toHaveValue('A, B');
  await expect(page.getByText('12 of 40')).toBeVisible();
  await expect(page.getByText('4 out of 5')).toBeVisible();
  await expect(page.getByText('Tags: Memory, War')).toBeVisible();
  await page.getByRole('button', { name: 'Import 1 work' }).click();
  await expect
    .poll(() => page.evaluate(() => window.__EXL_PHASE8_TEST__!.counts()))
    .toEqual({
      works: 3,
      notes: 0,
    });
});

test('a cold-start share target opens a prefilled Wishlist add flow', async ({ page }) => {
  await clearDevice(page, '/share?title=Piranesi');
  await openLibrary(page);
  await expect(page.getByText('Wishlist', { exact: true }).first()).toBeVisible();
  const catalogue = page.getByRole('dialog', { name: 'The catalogue' });
  await expect(catalogue).toBeVisible();
  await expect(catalogue.getByLabel('Search the catalogue')).toHaveValue('Piranesi');
  await catalogue.getByRole('button', { name: 'Add by hand' }).click();
  const byHand = page.getByRole('dialog', { name: 'Add by hand' });
  await expect(byHand.getByLabel('Title')).toHaveValue('Piranesi');
  await expect(byHand.getByRole('radio', { name: 'Wishlist' })).toBeChecked();
});
