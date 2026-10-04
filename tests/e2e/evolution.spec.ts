import { expect, test, type Page } from '@playwright/test';

async function sample(page: Page) {
  await page.goto('/?evaluate');
  await page.getByRole('button', { name: 'Explore the sample library' }).click();
  await expect(page.getByRole('heading', { name: 'The Left Hand of Darkness' })).toBeVisible();
}

test('moving selection remains within its control in both Collection themes', async ({ page }) => {
  await sample(page);
  await page.getByRole('button', { name: /Collection/ }).click();
  for (const theme of ['Dark', 'Light']) {
    const toggle = page.getByRole('button', { name: `${theme} theme`, exact: true });
    if (await toggle.isVisible()) await toggle.click();
    const selected = page.getByRole('radio', { name: 'All formats', exact: true });
    await expect
      .poll(async () => {
        const button = await selected.boundingBox();
        const highlight = await selected.locator('.room-selection').boundingBox();
        return (
          !!button &&
          !!highlight &&
          highlight.width <= button.width + 1 &&
          highlight.height <= button.height + 1
        );
      })
      .toBe(true);
  }
  await page.setViewportSize({ width: 820, height: 915 });
  const indicator = page.locator('.room-nav-indicator');
  await expect
    .poll(async () => {
      const box = await indicator.boundingBox();
      return !!box && box.height > box.width;
    })
    .toBe(true);
});

test('theme changes allow an immediate tap on the next destination', async ({ page }) => {
  await sample(page);
  const destination = await page
    .getByRole('button', { name: 'Wishlist', exact: true })
    .boundingBox();
  expect(destination).not.toBeNull();
  await page.getByRole('button', { name: 'Dark theme', exact: true }).click();
  await page.waitForFunction(() =>
    document.getAnimations().some((animation) => animation.playState === 'running'),
  );
  await page.mouse.click(
    destination!.x + destination!.width / 2,
    destination!.y + destination!.height / 2,
  );
  await expect(page.getByRole('heading', { name: 'Wishlist', exact: true })).toBeVisible();
});

test('local search keeps its query and keyboard destination after Detail and Back', async ({
  page,
}) => {
  await sample(page);
  await page.getByRole('button', { name: 'Search your library' }).click();
  const search = page.getByRole('searchbox', { name: 'Search your library' });
  await search.fill('Left Hand');
  const result = page.getByRole('button', { name: /The Left Hand of Darkness Ursula/ });
  await result.focus();
  await result.press('Enter');
  await expect(page.getByRole('heading', { name: 'The Left Hand of Darkness' })).toBeVisible();
  await page.goBack();
  await expect(search).toHaveValue('Left Hand');
  await expect(result).toBeFocused();
});

test('a work draft survives Escape and modal focus remains isolated through nested surfaces', async ({
  page,
}) => {
  await sample(page);
  await page.getByRole('button', { name: 'Open The Left Hand of Darkness', exact: true }).click();
  await page.getByRole('button', { name: 'Edit this work', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('A title still being corrected');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'A title still being corrected',
  );
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(
      true,
    );
  }
  expect(
    await page.locator('.room-stage').evaluate((element) => (element as HTMLElement).inert),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Discard changes' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(
    await page.locator('.room-stage').evaluate((element) => (element as HTMLElement).inert),
  ).toBe(false);
});

test('import Back walks the steps and preserves the original paste draft', async ({ page }) => {
  await sample(page);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: /^Backup and restore/ }).click();
  await page.getByRole('button', { name: /Paste a list of titles/ }).click();
  await page.getByLabel('Titles to import').fill('A title to inspect\nAnother title to inspect');
  await page.getByRole('button', { name: 'Review 2 titles' }).click();
  await expect(page.getByRole('heading', { name: 'Import preview' })).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel('Titles to import')).toHaveValue(
    'A title to inspect\nAnother title to inspect',
  );
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Backup', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Paste a list of titles/ }).click();
  await expect(page.getByLabel('Titles to import')).toHaveValue(
    'A title to inspect\nAnother title to inspect',
  );
  await page.goBack();
  await page.goBack();
  await expect(page.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByRole('heading', { name: 'Backup', exact: true })).toBeVisible();
});

test('catalogue candidate review returns to the same results without another history entry', async ({
  page,
}) => {
  await sample(page);
  await page.getByRole('button', { name: 'Add to the library', exact: true }).click();
  await page.getByRole('button', { name: /^Search the catalogue/ }).click();
  const query = page.getByRole('searchbox', { name: 'Search the catalogue' });
  await query.fill('A title with no network');
  await page.getByRole('button', { name: 'Add by hand', exact: true }).click();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('A title with no network');
  await page.getByRole('button', { name: 'Back to results' }).click();
  await expect(query).toHaveValue('A title with no network');
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'The Left Hand of Darkness' })).toBeVisible();
});

test('Detail attaches a new note directly and shows committed session history', async ({
  page,
}) => {
  await sample(page);
  await page.getByRole('button', { name: 'Open The Left Hand of Darkness', exact: true }).click();
  await page.getByRole('button', { name: 'Write a note', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'New note' });
  await expect(editor).toContainText('The Left Hand of Darkness');
  await editor.getByLabel('Note title').fill('A thought kept with this book');
  await editor.getByLabel('Note body').fill('The landscape changes the conversation.');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /Edit note: A thought kept with this book/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Log a session', exact: true }).click();
  await page.getByRole('button', { name: '+10', exact: true }).click();
  await page.getByRole('button', { name: 'Log it', exact: true }).click();
  await page.getByRole('button', { name: /^Reading history/ }).click();
  const history = page.locator('section[aria-label="Reading history"]');
  await expect(history).toContainText('+10 pages');
  await expect(history.locator('li')).toHaveCount(1);
  await expect(history.getByRole('button', { name: /Edit|Delete/ })).toHaveCount(0);
  await page.screenshot({ path: '.astra/review/evolution-detail-history-light.png' });
});

test('direct axis editing keeps the record and its scroll position underneath', async ({
  page,
}) => {
  await sample(page);
  await page.getByRole('button', { name: 'Open The Left Hand of Darkness', exact: true }).click();
  const profile = page.getByRole('button', { name: /^Reading profile/ });
  if ((await profile.getAttribute('aria-expanded')) !== 'true') await profile.click();
  const prose = page.getByRole('button', { name: /^Edit Prose/ });
  await prose.scrollIntoViewIfNeeded();
  const top = await page.locator('.room-detail').evaluate((node) => node.scrollTop);
  expect(top).toBeGreaterThan(200);
  await prose.click();
  await expect(page.getByRole('dialog', { name: 'Prose axis' })).toBeVisible();
  await expect
    .poll(() => page.locator('.room-detail').evaluate((node) => node.scrollTop))
    .toBe(top);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(profile).toHaveAttribute('aria-expanded', 'true');
  await expect
    .poll(() => page.locator('.room-detail').evaluate((node) => node.scrollTop))
    .toBe(top);
});

test('discarding a bookplate edit completes the requested tab navigation', async ({ page }) => {
  await sample(page);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: /^Settings/ }).click();
  await page.getByLabel('From the books of', { exact: true }).fill('A name still being corrected');
  await page.getByRole('button', { name: 'Stats', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeVisible();
  await page.getByRole('button', { name: 'Discard changes' }).click();
  await expect(page.getByRole('heading', { name: /so far$/ })).toBeVisible();
});

test('menu navigation protects the import draft and resumes the chosen screen', async ({
  page,
}) => {
  await sample(page);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: /^Backup and restore/ }).click();
  await page.getByRole('button', { name: /Paste a list of titles/ }).click();
  await page.getByLabel('Titles to import').fill('A title still being reviewed');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: /^Catalogue index/ }).click();
  const confirmation = page.getByRole('dialog', { name: 'Discard unsaved changes?' });
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByRole('button', { name: 'Keep editing' })).toBeFocused();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByLabel('Titles to import')).toHaveValue('A title still being reviewed');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: /^Catalogue index/ }).click();
  await page.getByRole('button', { name: 'Discard changes' }).click();
  await expect(
    page.getByRole('heading', { name: 'Download the search index', exact: true }),
  ).toBeVisible();
});
