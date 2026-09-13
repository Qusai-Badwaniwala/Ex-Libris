import { expect, test, type Page } from '@playwright/test';

test.setTimeout(45_000);

async function freshLibrary(page: Page) {
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
  await page.getByRole('button', { name: 'Open the library' }).click();
  await page.getByLabel('Your name').fill('Qusai');
  await page.getByRole('button', { name: 'Open the library' }).click();
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.waitForFunction(() => Boolean(window.__EXL_PHASE6_TEST__));
}

test.beforeEach(async ({ page }) => {
  await freshLibrary(page);
});

test('finishing offers the moment, seven optional axes, and explained local matches', async ({
  page,
}) => {
  await page.getByLabel('Dark theme').click();
  const fixture = await page.evaluate(() => window.__EXL_PHASE6_TEST__!.seed());
  await page.evaluate((id) => window.__EXL_PHASE6_TEST__!.openDetail(id), fixture.targetId);

  await page.getByRole('button', { name: /Reading/ }).click();
  await page.getByRole('button', { name: /Finished/ }).click();
  await expect(page.getByRole('heading', { name: 'Finished' })).toBeVisible();
  await expect(page.getByText('The Night Archive', { exact: true })).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/phase6-finish-dark.png' });

  await page.getByRole('button', { name: 'Set the axes' }).click();
  const slider = page.getByRole('slider');
  await expect(page.getByRole('dialog', { name: 'Protagonist axis' })).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/phase6-axis-dark.png' });
  await slider.press('End');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('dialog', { name: 'Power system axis' })).toBeVisible();
  await slider.press('End');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('dialog', { name: 'World axis' })).toBeVisible();
  await slider.press('End');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('dialog', { name: 'Pacing axis' })).toBeVisible();
  await slider.press('Home');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('dialog', { name: 'Prose axis' })).toBeVisible();
  await slider.press('Home');
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByRole('dialog', { name: 'Ending axis' })).toBeVisible();
  await page.getByRole('button', { name: 'Unfinished' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('dialog', { name: 'Translation axis' })).toBeVisible();
  await slider.press('End');
  await page.getByRole('button', { name: 'Done' }).click();

  await expect(page.getByText('Monstrous', { exact: true })).toBeVisible();
  await expect(page.getByText('Unfinished', { exact: true })).toBeVisible();
  await expect(page.getByText('Fluent', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'More like this' })).toBeVisible();
  await expect(page.getByText('A Compass of Salt', { exact: true })).toBeVisible();
  await expect(page.getByText('Matched on Monstrous, Rigorous and Merciless.')).toBeVisible();

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await page.screenshot({ path: '.impeccable/review/phase6-profile-light.png', fullPage: true });
  await page.getByRole('button', { name: 'Edit translation axis: Fluent' }).click();
  await expect(page.getByRole('dialog', { name: 'Translation axis' })).toBeVisible();
});

test('the ending stays locked before Finished and a failed write keeps the draft visible', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const fixture = await page.evaluate(() => window.__EXL_PHASE6_TEST__!.seed());
  await page.evaluate((id) => window.__EXL_PHASE6_TEST__!.openDetail(id), fixture.targetId);
  await page.getByRole('button', { name: 'Set axes' }).click();

  const protagonist = page.getByRole('slider');
  const bounds = await protagonist.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.click(bounds!.x + bounds!.width * 0.75, bounds!.y + bounds!.height / 2);
  await expect(protagonist).toHaveAttribute('aria-valuetext', 'Ruthless');
  await protagonist.press('End');
  expect(
    await page.locator('.exl-axis-word').evaluate((word) => getComputedStyle(word).animationName),
  ).toBe('none');
  await page.evaluate(() => window.__EXL_PHASE6_TEST__!.failNextAxisWrite());
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('alert')).toContainText('could not be saved');
  await expect(
    page
      .getByRole('dialog', { name: 'Protagonist axis' })
      .getByText('Monstrous', { exact: true })
      .first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  for (let step = 0; step < 4; step += 1) {
    await page.getByRole('button', { name: 'Next' }).click();
  }
  await expect(page.getByRole('dialog', { name: 'Ending axis' })).toBeVisible();
  await expect(page.getByText('Finish it first')).toBeVisible();
  await expect(page.getByRole('slider')).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('dialog', { name: 'Translation axis' })).toBeVisible();
});

test('reaching a complete work end through a session opens the same finish moment', async ({
  page,
}) => {
  const id = await page.evaluate(() => window.__EXL_PHASE6_TEST__!.seedSessionFinish());
  await page.evaluate((workId) => window.__EXL_PHASE6_TEST__!.openDetail(workId), id);
  await page.getByRole('button', { name: 'Log a session' }).click();
  await page.getByRole('button', { name: 'Forward one page' }).click();
  await page.getByRole('button', { name: 'Finish it' }).click();
  await expect(page.getByRole('heading', { name: 'Finished' })).toBeVisible();
  await expect(page.getByText('8 pages,', { exact: false })).toBeVisible();
});
