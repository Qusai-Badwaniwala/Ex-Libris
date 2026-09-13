import { expect, test, type Page } from '@playwright/test';

async function clearDevice(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__EXL_PHASE9_TEST__));
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
}

async function openLibrary(page: Page) {
  await page.getByRole('button', { name: 'Open the library' }).click();
  await page.getByLabel('Your name').fill('Qusai');
  await page.getByRole('button', { name: 'Open the library' }).click();
  const skip = page.getByRole('button', { name: 'Skip' });
  if (await skip.isVisible()) await skip.click();
  await page.waitForFunction(() => Boolean(window.__EXL_PHASE9_TEST__));
}

test.beforeEach(async ({ page }) => {
  await clearDevice(page);
  await openLibrary(page);
});

test('Stats is a truthful live ledger with both approved illustrations and genre scopes', async ({
  page,
}) => {
  await page.evaluate(async () => {
    await window.__EXL_PHASE9_TEST__!.seedStats();
    window.__EXL_PHASE9_TEST__!.openStats();
    document.documentElement.setAttribute('data-theme', 'light');
  });

  await expect(page.getByRole('heading', { name: /so far/ })).toBeVisible();
  await expect(page.getByText('502', { exact: true })).toBeVisible();
  await expect(page.getByText('7', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('For Later')).toHaveCount(0);
  await expect(
    page.locator('img[data-illustration-theme="light"][src$="knowledge-rafiki.svg"]'),
  ).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/phase9-stats-top-light.png' });

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await expect(
    page.locator('img[data-illustration-theme="dark"][src$="knowledge-rafiki.svg"]'),
  ).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/phase9-stats-top-dark.png' });

  await page.getByRole('button', { name: 'Finished' }).click();
  await expect(page.getByRole('button', { name: 'Finished' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('heading', { name: 'Before this year' }).scrollIntoViewIfNeeded();
  await expect(page.getByText('2025')).toBeVisible();
  await expect(page.getByText('2024')).toBeVisible();
  await expect(
    page.locator('img[data-illustration-theme="dark"][src$="cherry-tree-amico.svg"]'),
  ).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/phase9-stats-history-dark.png' });

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await expect(
    page.locator('img[data-illustration-theme="light"][src$="cherry-tree-amico.svg"]'),
  ).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/phase9-stats-history-light.png' });
});

test('500-work spine view stays windowed and sustains the Pixel 7 scroll budget', async ({
  page,
}) => {
  await page.evaluate(async () => {
    await window.__EXL_PHASE9_TEST__!.seedSpines(500);
    window.__EXL_PHASE9_TEST__!.openSpine();
    document.documentElement.setAttribute('data-theme', 'light');
  });
  await expect(page.getByRole('heading', { name: 'Novels' })).toBeVisible();
  await expect(page.getByLabel('All novels').getByText('500', { exact: true })).toBeVisible();

  const shelf = page.locator('[data-spine-row-count]');
  await expect(shelf).toBeVisible();
  const rowCount = Number(await shelf.getAttribute('data-spine-row-count'));
  const mountedAtTop = Number(await shelf.getAttribute('data-spine-mounted-rows'));
  expect(rowCount).toBeGreaterThan(30);
  expect(mountedAtTop).toBeLessThanOrEqual(12);
  expect(await page.locator('[data-spine-row]').count()).toBe(mountedAtTop);
  await page.screenshot({ path: '.impeccable/review/phase9-spines-light.png' });

  const measurement = await page.evaluate(async () => {
    const scroll = document.querySelector<HTMLElement>('.exl-scroll');
    if (!scroll) throw new Error('Spine scroller is missing.');
    const frameTimes: number[] = [];
    let maxMounted = 0;
    let prior = 0;
    const frames = 90;
    await new Promise<void>((resolve) => {
      let step = 0;
      const tick = (time: number) => {
        if (prior) frameTimes.push(time - prior);
        prior = time;
        scroll.scrollTop = ((scroll.scrollHeight - scroll.clientHeight) * step) / frames;
        const shelf = document.querySelector<HTMLElement>('[data-spine-mounted-rows]');
        maxMounted = Math.max(maxMounted, Number(shelf?.dataset['spineMountedRows'] ?? 0));
        step += 1;
        if (step <= frames) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    const elapsed = frameTimes.reduce((sum, value) => sum + value, 0);
    return {
      fps: (frameTimes.length * 1000) / elapsed,
      worstFrameMs: Math.max(...frameTimes),
      maxMounted,
      scrollTop: scroll.scrollTop,
    };
  });

  expect(measurement.fps).toBeGreaterThanOrEqual(55);
  expect(measurement.maxMounted).toBeLessThanOrEqual(13);
  expect(measurement.scrollTop).toBeGreaterThan(0);
  await expect.poll(() => page.locator('[data-spine-row="0"]').count()).toBe(0);
  test.info().annotations.push({
    type: 'measurement',
    description: `${measurement.fps.toFixed(1)} fps; ${measurement.worstFrameMs.toFixed(1)} ms worst frame; ${measurement.maxMounted} max mounted rows`,
  });
  await expect(page.getByText("Based on this library's chapter lengths.")).toBeVisible();

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.screenshot({ path: '.impeccable/review/phase9-spines-dark.png' });
});

test('empty Stats stays honest and a small shelf keeps the fixed width key', async ({ page }) => {
  await page.evaluate(() => window.__EXL_PHASE9_TEST__!.openStats());
  await expect(page.getByRole('heading', { name: /so far/ })).toBeVisible();
  const figures = page.getByLabel("This year's reading figures");
  await expect(figures.getByText('0')).toHaveCount(2);
  await expect(figures.getByText('1')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Genres' })).toHaveCount(0);

  await page.evaluate(async () => {
    await window.__EXL_PHASE9_TEST__!.seedSpines(39);
    window.__EXL_PHASE9_TEST__!.openSpine();
  });
  await expect(page.getByText('Fixed logarithmic scale')).toBeVisible();
  await expect(page.getByText('<40')).toBeVisible();
});
