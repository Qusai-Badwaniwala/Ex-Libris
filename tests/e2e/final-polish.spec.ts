import { expect, test, type Page } from '@playwright/test';

async function freshLibrary(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__EXL_PHASE10_TEST__));
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
  await page.goto('/');
  await page.getByRole('button', { name: 'Open the library' }).click();
  await page.getByLabel('Your name').fill('Qusai');
  await page.getByRole('button', { name: 'Open the library' }).click();
  const skip = page.getByRole('button', { name: 'Skip' });
  if (await skip.isVisible()) await skip.click();
  await page.waitForFunction(() => Boolean(window.__EXL_PHASE10_TEST__));
}

test.beforeEach(async ({ page }) => {
  await freshLibrary(page);
});

test('Settings saves and rolls back honest controls with full touch targets', async ({ page }) => {
  await page.evaluate(() => window.__EXL_PHASE10_TEST__!.openSettings());
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  await page.getByRole('radio', { name: 'Light' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({ path: '.impeccable/review/phase10-settings-top-light.png' });
  await page.getByRole('button', { name: 'About' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.impeccable/review/phase10-settings-bottom-light.png' });
  await page.getByRole('heading', { name: 'Settings' }).scrollIntoViewIfNeeded();

  const themeButtons = page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio');
  await expect(themeButtons).toHaveCount(3);
  for (const button of await themeButtons.all()) {
    const box = await button.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  for (const control of await page.getByRole('switch').all()) {
    const box = await control.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  }

  await page.getByRole('radio', { name: 'Light' }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('radio', { name: 'Dark' })).toBeFocused();
  await expect(page.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');

  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'light');
  await page.waitForFunction(() =>
    window.__EXL_PHASE10_TEST__!.getTheme().then((theme) => theme === 'dark'),
  );
  await page.evaluate(() => window.__EXL_PHASE10_TEST__!.failNextSettingsUpdate());
  await page.getByRole('radio', { name: 'Light' }).click();
  await expect(page.getByRole('alert')).toContainText('previous value was restored');
  await expect(page.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'light');

  const owner = page.getByLabel('From the books of');
  await owner.fill('Qusai of the Very Long Marginal Archive');
  await page.getByRole('button', { name: 'Save the name' }).click();
  await expect(page.getByRole('button', { name: 'Save the name' })).toHaveCount(0);
  await page.screenshot({ path: '.impeccable/review/phase10-settings-top-dark.png' });

  await page.getByRole('button', { name: 'About' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.impeccable/review/phase10-settings-bottom-dark.png' });
  await page.getByRole('button', { name: 'About' }).click();
  await expect(page.getByRole('heading', { name: 'Ex Libris' })).toBeVisible();
  await expect(page.getByText('Qusai of the Very Long Marginal Archive')).toBeVisible();
  await expect(
    page.locator('img[data-illustration-theme="dark"][src$="magic-tree-cuate.svg"]'),
  ).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/phase10-about-dark.png', fullPage: true });
  const aboutScroller = page.locator('.exl-scroll');
  await aboutScroller.evaluate((element) => element.scrollTo(0, element.scrollHeight));
  await page.screenshot({ path: '.impeccable/review/phase10-about-bottom-dark.png' });
  await page.getByRole('heading', { name: 'Ex Libris' }).scrollIntoViewIfNeeded();
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await expect(
    page.locator('img[data-illustration-theme="light"][src$="magic-tree-cuate.svg"]'),
  ).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/phase10-about-light.png', fullPage: true });
  await aboutScroller.evaluate((element) => element.scrollTo(0, element.scrollHeight));
  await page.screenshot({ path: '.impeccable/review/phase10-about-bottom-light.png' });
});

test('tag maintenance renames, explicitly merges, and removes only unused tags', async ({
  page,
}) => {
  await page.evaluate(async () => {
    await window.__EXL_PHASE10_TEST__!.seedTags();
    window.__EXL_PHASE10_TEST__!.openSettings();
    document.documentElement.setAttribute('data-theme', 'light');
  });
  await page.getByRole('button', { name: 'Tidy up the tags' }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Tidy up the tags' }).click();
  await expect(page.getByRole('heading', { name: 'Tidy up the tags' })).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/phase10-tags-light.png', fullPage: true });

  await page.getByRole('button', { name: 'Edit Dark fantasy' }).press('Enter');
  const name = page.getByLabel('Tag name');
  await page.evaluate(() => window.__EXL_PHASE10_TEST__!.failNextTagUpdate());
  await name.fill('Shadow fantasy');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Nothing was changed');
  await expect(page.getByText('Dark fantasy', { exact: true })).toBeVisible();

  await name.fill('Grimdark');
  await page.getByRole('button', { name: 'Merge', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Confirm merge' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm merge' }).click();
  await expect(page.getByText('Merged into Grimdark. Every attachment was kept.')).toBeVisible();
  await expect(page.getByText('Grimdark', { exact: true })).toHaveCount(1);
  await expect(page.getByText('2 uses')).toBeVisible();

  await page.getByRole('button', { name: 'Edit Grimdark' }).click();
  await page.getByLabel('Tag name').fill('Shadow fantasy');
  await page.getByRole('button', { name: 'Save', exact: true }).press('Enter');
  await expect(page.getByText('Renamed to Shadow fantasy.')).toBeVisible();

  await expect(page.getByRole('button', { name: 'Remove Only in Trash' })).toHaveCount(0);
  const remove = page.getByRole('button', { name: 'Remove Unused label' });
  await remove.click();
  await expect(page.getByRole('button', { name: 'Remove Unused label' })).toHaveText('Confirm');
  await page.getByRole('button', { name: 'Remove Unused label' }).click();
  await expect(page.getByText('Removed Unused label.')).toBeVisible();
  await expect(page.getByText('Unused label', { exact: true })).toHaveCount(0);

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.screenshot({ path: '.impeccable/review/phase10-tags-dark.png', fullPage: true });
  await page.evaluate(() => window.__EXL_PHASE10_TEST__!.clearTags());
  await expect(
    page.getByText('No tags yet. Tags appear here after they are used on a work or note.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});

test('Settings and tag maintenance remain complete with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(async () => {
    await window.__EXL_PHASE10_TEST__!.seedTags();
    window.__EXL_PHASE10_TEST__!.openSettings();
  });
  await page.getByRole('button', { name: 'Tidy up the tags' }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Tidy up the tags' }).click();
  await expect(page.getByRole('heading', { name: 'Tidy up the tags' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit Dark fantasy' })).toHaveCSS(
    'transition-duration',
    '0s',
  );
});
