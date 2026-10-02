import { expect, test, type Page } from '@playwright/test';

async function openLibrary(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open the library' }).click();
  await page.getByLabel('Your name').fill('Qusai');
  await page.getByRole('button', { name: 'Open the library' }).click();
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByRole('heading', { name: 'Your shelves' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await openLibrary(page);
});

test('Reading Room navigation has four reachable destinations and a separate add action', async ({
  page,
}) => {
  const dock = page.getByRole('navigation', { name: 'Sections' });
  await expect(dock.getByRole('button')).toHaveCount(4);
  await expect(dock.getByRole('button', { name: 'Library' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const bounds = await dock.getByRole('button').evaluateAll((buttons) =>
    buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }),
  );
  expect(bounds.every((rect) => rect.width >= 44 && rect.height >= 44)).toBe(true);
  await dock.getByRole('button', { name: 'Wishlist' }).click();
  await expect(dock.getByRole('button', { name: 'Wishlist' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('heading', { name: 'Wishlist' })).toBeVisible();
});

test('Add offers exactly two working choices and Escape returns focus', async ({ page }) => {
  const add = page.getByRole('button', { name: 'Add to the library' });
  await add.click();
  const menu = page.getByRole('dialog', { name: 'Add to your library' });
  await expect(menu.locator('[data-fab-door]')).toHaveCount(2);
  await expect(menu.getByRole('button', { name: /Search the catalogue/ })).toBeVisible();
  await expect(menu.getByRole('button', { name: /Add by hand/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(add).toBeFocused();
  await add.click();
  await page.getByRole('button', { name: /Add by hand/ }).click();
  await expect(page.getByRole('dialog', { name: 'Add by hand' })).toBeVisible();
});

test('the utility sheet restores focus and opens the actual catalogue route', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Menu', exact: true });
  await trigger.click();
  const menu = page.getByRole('dialog', { name: 'Menu' });
  await expect(menu.locator('[data-drawer-destination]')).toHaveCount(5);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await menu.getByRole('button', { name: /^Catalogue index/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/index|catalogue/i);
});

test('Notes is a primary destination with a real plain-text editor', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: 'Notes' }).click();
  await page.getByRole('button', { name: 'Write a note' }).click();
  const editor = page.getByRole('dialog', { name: 'New note' });
  await editor.getByLabel('Note title').fill('A small observation');
  await editor.getByLabel('Note body').fill('The ending changes the opening.');
  await editor.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Edit note: A small observation' }).click();
  await expect(page.getByRole('dialog', { name: 'Edit note' }).getByLabel('Note body')).toHaveValue(
    'The ending changes the opening.',
  );
});
