import { expect, test, type Page } from '@playwright/test';

async function freshStart(page: Page) {
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

async function openLibrary(page: Page) {
  await page.getByRole('button', { name: 'Open the library' }).click();
  await page.getByLabel('Your name').fill('Qusai');
  await page.getByRole('button', { name: 'Open the library' }).click();

  const skipTour = page.getByRole('button', { name: 'Skip' });
  if (await skipTour.isVisible()) await skipTour.click();
  await expect(page.getByText('Shelves')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await freshStart(page);
  await openLibrary(page);
});

test('the editorial dock is four ruled, truthful destinations', async ({ page }) => {
  const dock = page.locator('[data-editorial-dock]');
  await expect(dock).toBeVisible();
  await expect(dock.getByRole('button')).toHaveCount(4);
  await expect(dock.getByRole('button', { name: 'Library' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(dock.locator('[data-registration-stitch]')).toHaveCount(1);

  const zones = await dock.getByRole('button').evaluateAll((buttons) =>
    buttons.map((button) => ({
      rightRule: getComputedStyle(button).borderRightWidth,
      radius: getComputedStyle(button).borderRadius,
    })),
  );
  expect(zones.slice(0, -1).every((zone) => zone.rightRule !== '0px')).toBe(true);
  expect(zones.at(-1)?.rightRule).toBe('0px');
  expect(zones[0]?.radius).not.toContain('999');

  await dock.getByRole('button', { name: 'Wishlist' }).click();
  await expect(dock.getByRole('button', { name: 'Wishlist' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('the Claude FAB blooms into exactly two working doors and Escape restores focus', async ({
  page,
}) => {
  const fab = page.getByRole('button', { name: 'Add to the library' });
  await expect(fab).toHaveAttribute('data-tour', 'fab');
  await fab.click();

  const menu = page.getByRole('dialog', { name: 'Add to the library' });
  await expect(menu).toBeVisible();
  await expect(menu.locator('[data-fab-door]')).toHaveCount(2);
  await expect(menu.getByRole('button', { name: 'Search the catalogue' })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Add by hand' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(fab).toBeFocused();

  await fab.click();
  await page.getByRole('button', { name: 'Add by hand' }).click();
  await expect(page.getByRole('dialog', { name: 'Add by hand' })).toBeVisible();
});

test('the slower drawer has no row separators and Catalogue index is a real route', async ({
  page,
}) => {
  const trigger = page.getByRole('button', { name: 'Menu' });
  await trigger.click();

  const drawer = page.getByRole('dialog', { name: 'Menu' });
  const panel = drawer.locator('[data-drawer-panel]');
  await expect(drawer).toBeVisible();
  await expect(panel).toHaveCSS('transition-duration', '0.46s');
  await expect(drawer.locator('[data-drawer-destination]')).toHaveCount(5);

  const separators = await drawer.locator('[data-drawer-destination]').evaluateAll((rows) =>
    rows.map((row) => ({
      top: getComputedStyle(row).borderTopWidth,
      bottom: getComputedStyle(row).borderBottomWidth,
    })),
  );
  expect(separators.every(({ top, bottom }) => top === '0px' && bottom === '0px')).toBe(true);

  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.getByRole('button', { name: 'Catalogue index' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/index|catalogue/i);
});

test('Notes uses the Claude pencil and opens a working plain-text editor', async ({ page }) => {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Notes' }).click();
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  const pencil = page.getByRole('button', { name: 'Write a note' });
  await expect(pencil).toBeVisible();
  await pencil.click();
  const editor = page.getByRole('dialog', { name: 'New note' });
  await editor.getByLabel('Note title').fill('A small observation');
  await editor.getByLabel('Note body').fill('The ending changes the opening.');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('A small observation')).toBeVisible();
  await page.getByText('A small observation').click();
  await expect(page.getByRole('dialog', { name: 'Edit note' })).toBeVisible();
});
