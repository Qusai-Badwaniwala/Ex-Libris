import { expect, test, type Page } from '@playwright/test';

test.setTimeout(45_000);

async function freshStart(page: Page) {
  await page.goto('/');
  await page.evaluate(async () => {
    for (const registration of await navigator.serviceWorker.getRegistrations()) {
      await registration.unregister();
    }
    for (const key of await caches.keys()) await caches.delete(key);
    if (navigator.storage.getDirectory) {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry('catalogue', { recursive: true }).catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error;
      });
    }
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
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByText('Shelves')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__EXL_PHASE5_TEST__));
}

async function addByHand(page: Page, title: string) {
  if ((await page.getByRole('button', { name: 'Add to the library' }).count()) === 0) {
    await page
      .getByRole('navigation', { name: 'Sections' })
      .getByRole('button', { name: 'Library', exact: true })
      .click();
  }
  await page.getByRole('button', { name: 'Add to the library' }).click();
  await page.getByRole('button', { name: 'Add by hand' }).click();
  await page.getByLabel('Title').fill(title);
  await page.getByRole('button', { name: 'Put it on the shelf' }).click();
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await freshStart(page);
  await openLibrary(page);
});

test('post-add evidence warns about an earlier entry and bulk-adds only to Wishlist', async ({
  page,
}) => {
  const installed = await page.evaluate(() => window.__EXL_CATALOGUE_TEST__!.install());
  expect(installed.phase).toBe('ready');
  await page.evaluate(() => window.__EXL_PHASE5_TEST__!.seedHighSuggestion());

  await expect(page.getByText('The catalogue places this in')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Start earlier')).toBeVisible();
  await expect(page.getByText(/Red Rising comes before this entry/)).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/phase5-high-offer-dark.png' });
  await page.getByRole('button', { name: 'Group it' }).click();
  await expect(page.getByRole('button', { name: 'View the series' })).toBeVisible();
  const additions = page.getByRole('note', { name: 'Wishlist additions' });
  await expect(additions.getByText('Entries to be added to Wishlist')).toBeVisible();
  await expect(additions.getByText('Red Rising', { exact: true })).toBeVisible();
  await expect(additions.getByText('Morning Star', { exact: true })).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/phase5-wishlist-preflight-light.png' });
  await page.getByRole('button', { name: 'Put 2 missing entries on Wishlist' }).click();

  await expect(page.getByRole('heading', { name: 'Red Rising' })).toBeVisible();
  await expect(page.getByLabel('0 of 3 entries finished')).toBeVisible();
  await expect(page.getByRole('button', { name: /Red Rising Wishlist$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Morning Star Wishlist$/ })).toBeVisible();
});

test('medium and low confidence offers are explicit and rejection writes nothing visible', async ({
  page,
}) => {
  await addByHand(page, 'Second Glass (Glass Archive #2)');
  await expect(page.getByText('The title suggests a series')).toBeVisible();
  await expect(page.getByText('Glass Archive', { exact: true })).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/phase5-medium-offer-dark.png' });
  await page.getByRole('button', { name: 'Not this series' }).click();
  await expect(page.getByRole('region', { name: 'Series and universe suggestions' })).toHaveCount(
    0,
  );

  const fixture = await page.evaluate(() => window.__EXL_PHASE5_TEST__!.seed());
  await addByHand(page, 'Late Entry (The Verdigris Cyce #4)');
  await expect(page.getByText('This might be a series')).toBeVisible();
  await expect(page.getByText('The Verdigris Cycle', { exact: true })).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/phase5-low-offer-dark.png' });
  await page.getByRole('button', { name: 'Not this series' }).click();
  await page.evaluate((id) => window.__EXL_PHASE5_TEST__!.openSeries(id), fixture.seriesId);
  await expect(page.getByRole('heading', { name: 'The Verdigris Cycle' })).toBeVisible();
  await expect(page.getByText('Late Entry (The Verdigris Cyce #4)')).toHaveCount(0);
});

test('series orders can be created, renamed, reordered, deleted, and roll back on failure', async ({
  page,
}) => {
  const fixture = await page.evaluate(() => window.__EXL_PHASE5_TEST__!.seed());
  await page.evaluate((id) => window.__EXL_PHASE5_TEST__!.openSeries(id), fixture.seriesId);

  await expect(page.getByLabel('1 of 4 entries finished')).toBeVisible();
  await page.getByRole('button', { name: 'Publication order' }).click();
  await expect(page.getByText('The Salt Accounts', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '2 Nine Winters of Ash Wishlist' })).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/phase5-series-known-dark.png' });
  await page.getByRole('button', { name: 'Manage orders' }).click();
  const editor = page.getByRole('dialog', { name: 'Reading orders' });
  await expect(editor.getByLabel('Order name')).toBeFocused();
  await page.screenshot({ path: '.impeccable/review/phase5-order-editor-dark.png' });
  await editor.getByRole('button', { name: 'Preferred order' }).click();
  await editor.getByLabel('Order name').fill('Chronological order');
  await editor.getByRole('button', { name: 'Move Nine Winters of Ash later' }).click();
  await editor.getByRole('button', { name: 'Save order' }).click();

  await expect(page.getByRole('button', { name: 'Chronological order' })).toBeVisible();
  await page.getByRole('button', { name: 'Manage orders' }).click();
  await editor.getByRole('button', { name: 'Chronological order' }).click();
  await editor.getByLabel('Order name').fill('A failed rename');
  await page.evaluate(() => window.__EXL_PHASE5_TEST__!.failNextOrderWrite());
  await editor.getByRole('button', { name: 'Save order' }).click();
  await expect(editor.getByRole('alert')).toContainText('could not be saved');
  await expect(editor.getByLabel('Order name')).toHaveValue('A failed rename');
  await editor.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Chronological order' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'A failed rename' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Manage orders' }).click();
  await editor.getByRole('button', { name: 'New order' }).click();
  await editor.getByLabel('Order name').fill('Weekend order');
  await editor.getByRole('button', { name: 'Create order' }).click();
  await expect(page.getByRole('button', { name: 'Weekend order' })).toBeVisible();

  await page.getByRole('button', { name: 'Manage orders' }).click();
  await editor.getByRole('button', { name: 'Weekend order' }).click();
  await editor.getByRole('button', { name: 'Delete this order' }).click();
  await expect(editor.getByRole('button', { name: 'Delete order permanently' })).toBeVisible();
  await editor.getByRole('button', { name: 'Delete order permanently' }).click();
  await expect(page.getByRole('button', { name: 'Weekend order' })).toHaveCount(0);
});

test('universe shows a clear starting point and several editable named orders', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('[aria-label="Light theme"]').click();
  const fixture = await page.evaluate(() => window.__EXL_PHASE5_TEST__!.seed());
  await page.evaluate((id) => window.__EXL_PHASE5_TEST__!.openUniverse(id), fixture.universeId);

  await expect(page.getByRole('heading', { name: 'The Ledger Continuity' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Start here' })).toBeVisible();
  await expect(page.getByText('Before following a named order')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Publication order' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recommended order' })).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/phase5-universe-light.png' });

  await page.getByRole('button', { name: 'Manage' }).click();
  const editor = page.getByRole('dialog', { name: 'Reading orders' });
  await page.screenshot({ path: '.impeccable/review/phase5-universe-editor-light.png' });
  await editor
    .getByLabel('Where to begin and why')
    .fill('Start with The Salt Accounts only after The Verdigris Cycle.');
  await editor.getByRole('button', { name: 'Save starting point' }).click();
  await editor.getByRole('button', { name: 'Cancel' }).click();
  await expect(
    page.getByText('Start with The Salt Accounts only after The Verdigris Cycle.'),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Manage' }).click();
  const shortTargets = await editor.getByRole('button').evaluateAll((buttons) =>
    buttons
      .filter((button) => !button.hasAttribute('disabled'))
      .map((button) => ({
        name: button.textContent?.trim(),
        height: button.getBoundingClientRect().height,
      }))
      .filter(({ height }) => height < 44),
  );
  expect(shortTargets).toEqual([]);
});
