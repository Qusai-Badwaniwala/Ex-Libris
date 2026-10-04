import { expect, test, type Page } from '@playwright/test';
import { ILLUSTRATION_NAMES } from '../../src/ui/illustration-manifest';

async function sample(page: Page) {
  await page.goto('/?evaluate');
  await page.getByRole('button', { name: 'Explore the sample library' }).click();
  await expect(page.getByRole('heading', { name: 'The Left Hand of Darkness' })).toBeVisible();
}

test('manual choices have an explicit selected mark in both themes and support arrow keys', async ({
  page,
}) => {
  await sample(page);
  await page.setViewportSize({ width: 360, height: 640 });
  for (const theme of ['Light', 'Dark']) {
    const toggle = page.getByRole('button', { name: `${theme} theme`, exact: true });
    if (await toggle.count()) await toggle.click();
    await page.getByRole('button', { name: 'Add to the library', exact: true }).click();
    await page.getByRole('button', { name: /^Add by hand/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Add by hand' });
    for (const label of ['Shelf', 'Counted in', 'Where it goes']) {
      const group = sheet.getByRole('radiogroup', { name: label, exact: true });
      const choices = group.getByRole('radio');
      await choices.nth(1).click();
      await expect(choices.nth(1)).toBeChecked();
      await expect(group.locator('[data-selection-mark]')).toHaveCount(1);
      expect(await choices.nth(1).evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
        await choices.first().evaluate((el) => getComputedStyle(el).backgroundColor),
      );
      await choices.nth(1).press('ArrowLeft');
      await expect(choices.first()).toBeChecked();
      await expect(choices.first()).toBeFocused();
    }
    await sheet.getByRole('radiogroup', { name: 'Shelf', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `.astra/review/adoption-selected-${theme}.png` });
    await sheet.getByRole('button', { name: 'Cancel', exact: true }).click();
    const discard = page.getByRole('button', { name: 'Discard changes', exact: true });
    if (await discard.isVisible()) await discard.click();
  }
});

test('every replay-tour step keeps its controls inside a short phone viewport', async ({
  page,
}) => {
  await sample(page);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => (document.documentElement.style.fontSize = '20px'));
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Menu' })
    .getByRole('button', { name: /^Settings/ })
    .click();
  await page.getByRole('button', { name: 'Replay introduction' }).click();
  await page.getByRole('button', { name: 'Open the library' }).click();
  for (let step = 0; step < 6; step++) {
    const tour = page.getByRole('dialog');
    await expect(tour).toBeVisible();
    const skip = tour.getByRole('button', { name: 'Skip', exact: true });
    const next = tour.getByRole('button').last();
    for (const control of [skip, next]) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(640);
    }
    if (step === 5) await skip.click();
    else await next.click();
  }
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Codex responds to enlarged text and keeps every visible book actionable', async ({
  page,
}) => {
  await sample(page);
  await page.setViewportSize({ width: 360, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => (document.documentElement.style.fontSize = '32px'));
  await page.getByRole('button', { name: /Collection/ }).click();
  await page.getByRole('button', { name: 'Codex', exact: true }).click();
  const shelf = page.getByRole('region', { name: 'Codex bookcase' });
  await expect(shelf).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('[data-codex-row]')
        .first()
        .evaluate((row) => row.getBoundingClientRect().height),
    )
    .toBeGreaterThanOrEqual(344);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.astra/review/adoption-codex-large-text.png' });
  await shelf.getByRole('button', { name: 'A Wizard of Earthsea, Finished' }).click();
  await expect(page.getByRole('heading', { name: 'A Wizard of Earthsea' })).toBeVisible();
});

test('all thirteen art derivatives load in both adopted palettes', async ({ page }) => {
  await page.goto('/');
  await page.setViewportSize({ width: 1000, height: 1100 });
  for (const theme of ['light', 'dark'] as const) {
    await page.setContent(
      `<main style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:16px;background:${theme === 'light' ? '#f5f4ee' : '#111214'};color:${theme === 'light' ? '#18241d' : '#e7e5df'}">${ILLUSTRATION_NAMES.map((name) => `<figure style="margin:0"><img src="/illustrations/${theme}/${name}.svg" alt="${name}" style="width:220px;height:220px;object-fit:contain"><figcaption>${name}</figcaption></figure>`).join('')}</main>`,
    );
    await expect
      .poll(() =>
        page
          .locator('img')
          .evaluateAll(
            (images) =>
              images.filter((image) => (image as HTMLImageElement).naturalWidth > 0).length,
          ),
      )
      .toBe(13);
    await page.screenshot({ path: `.astra/review/adoption-art-${theme}.png`, fullPage: true });
  }
});

test('the organiser protects drafts, previews membership and preserves books on group deletion', async ({
  page,
}) => {
  await sample(page);
  await page.getByRole('button', { name: /Collection/ }).click();
  await page.getByRole('button', { name: 'Codex', exact: true }).click();
  await page.getByRole('button', { name: 'Earthsea', exact: true }).click();
  await page.getByRole('button', { name: 'Organise', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Earthsea cycle');
  await page.goBack();
  await expect(page.getByRole('dialog', { name: 'Discard unsaved organisation?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Earthsea cycle');
  await page.getByRole('button', { name: 'Review changes', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Review membership' })).toContainText(
    'The Farthest Shore',
  );
  await page.getByRole('button', { name: 'Confirm changes' }).click();
  await expect(page.getByRole('heading', { name: 'Earthsea cycle', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Organise', exact: true }).click();
  await page.getByRole('dialog').getByText('Merge or remove this group', { exact: true }).click();
  await page.getByRole('button', { name: 'Review group deletion' }).click();
  await page.getByRole('button', { name: 'Confirm changes' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Your collection' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Collection 10' })).toBeVisible();
  await page.getByRole('button', { name: 'Index', exact: true }).click();
  await expect(page.getByRole('button', { name: /A Wizard of Earthsea Ursula/ })).toBeVisible();
});

test('replaying the introduction leaves the library and completed onboarding intact', async ({
  page,
}) => {
  await sample(page);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Menu' })
    .getByRole('button', { name: /^Settings/ })
    .click();
  await page.getByRole('button', { name: 'Replay introduction' }).click();
  await expect(page.getByRole('heading', { name: 'Ex Libris', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open the library' }).click();
  await expect(page.getByText('Search only what you own', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Collection 10' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'The Left Hand of Darkness' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip', exact: true })).toHaveCount(0);
});

test('a note draft survives browser Back and only discards after an explicit choice', async ({
  page,
}) => {
  await sample(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Notes' }).click();
  await page.getByRole('button', { name: 'Write a note' }).click();
  await page.getByLabel('Note title').fill('A thought to keep');
  await page.getByLabel('Note body').fill('The journey changes the meaning of home.');
  await page.goBack();
  await expect(page.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByLabel('Note title')).toHaveValue('A thought to keep');
  await expect(page.getByLabel('Note body')).toHaveValue(
    'The journey changes the meaning of home.',
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit note: A thought to keep' })).toBeVisible();
  await page.getByRole('button', { name: 'Write a note' }).click();
  await page.getByLabel('Note body').fill('A second, disposable draft.');
  await page.goBack();
  await page.getByRole('button', { name: 'Discard changes' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('A second, disposable draft.')).toHaveCount(0);
});

test('a directly typed session destination persists through the existing session workflow', async ({
  page,
}) => {
  await sample(page);
  await page.getByRole('button', { name: 'Log a session', exact: true }).click();
  await page.getByLabel('Session destination').fill('190');
  await page.getByRole('button', { name: 'Log it', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Page 190 / 304', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Page 190 / 304', { exact: true })).toBeVisible();
});

test('collection filters and position survive a trip into a work', async ({ page }) => {
  await sample(page);
  await page.getByRole('button', { name: /Collection/ }).click();
  await page.getByRole('radio', { name: 'Books', exact: true }).click();
  await page.getByRole('button', { name: 'Finished', exact: true }).click();
  await page.getByRole('button', { name: /A Wizard of Earthsea Ursula/ }).click();
  await expect(page.getByRole('heading', { name: 'A Wizard of Earthsea' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('radio', { name: 'Books', exact: true })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Finished', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: /The Left Hand of Darkness Ursula/ })).toHaveCount(
    0,
  );
});

test('the sample cannot overwrite an existing preview library', async ({ page }) => {
  await sample(page);
  await page.goto('/?evaluate');
  await page.getByRole('button', { name: 'Explore the sample library' }).click();
  await expect(page.getByRole('alert')).toContainText('already has data');
  await page.getByRole('button', { name: /Open existing library/ }).click();
  await expect(page.getByRole('button', { name: 'Collection 10' })).toBeVisible();
});

test('major layouts are evaluable at narrow phone, phone, tablet and desktop sizes in both themes', async ({
  page,
}) => {
  await sample(page);
  for (const width of [360, 412, 820, 1440]) {
    await page.setViewportSize({ width, height: 915 });
    for (const theme of ['Light', 'Dark']) {
      const toggle = page.getByRole('button', { name: `${theme} theme`, exact: true });
      if (await toggle.isVisible()) await toggle.click();
      for (const section of ['Library', 'Wishlist', 'Notes', 'Stats']) {
        await page
          .getByRole('navigation')
          .getByRole('button', { name: section, exact: true })
          .click();
        await expect(page.locator('h1')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({ path: `.astra/review/astra-${section}-${width}-${theme}.png` });
      }
    }
  }
});
