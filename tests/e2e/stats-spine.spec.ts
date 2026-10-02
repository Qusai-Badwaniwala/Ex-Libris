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
  await expect(skip).toBeVisible();
  await skip.click();
  await expect(skip).toHaveCount(0);
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
  await page.screenshot({ path: '.astra/review/phase9-stats-top-light.png' });

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await expect(
    page.locator('img[data-illustration-theme="dark"][src$="knowledge-rafiki.svg"]'),
  ).toBeVisible();
  await page.screenshot({ path: '.astra/review/phase9-stats-top-dark.png' });

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
  await page.screenshot({ path: '.astra/review/phase9-stats-history-dark.png' });

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await expect(
    page.locator('img[data-illustration-theme="light"][src$="cherry-tree-amico.svg"]'),
  ).toBeVisible();
  await page.screenshot({ path: '.astra/review/phase9-stats-history-light.png' });
});

test('500-work Codex stays windowed, rests when idle and survives GPU loss', async ({ page }) => {
  await page.evaluate(async () => {
    await window.__EXL_PHASE9_TEST__!.seedSpines(500);
    window.__EXL_PHASE9_TEST__!.openSpine();
    document.documentElement.setAttribute('data-theme', 'light');
  });
  await page.getByRole('button', { name: 'Codex', exact: true }).click();
  const shelf = page.getByRole('region', { name: 'Codex bookcase' });
  const canvas = page.locator('.codex-cabinet');
  await expect(shelf).toBeVisible();
  await expect(canvas).toHaveAttribute('data-frames', /[1-9]/);
  expect(await page.locator('[data-codex-row]').count()).toBeLessThanOrEqual(8);
  await page.screenshot({ path: '.astra/review/adoption-codex-light.png' });
  const before = await canvas.getAttribute('data-frames');
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let count = 0;
        const tick = () => (++count < 12 ? requestAnimationFrame(tick) : resolve());
        requestAnimationFrame(tick);
      }),
  );
  expect(await canvas.getAttribute('data-frames')).toBe(before);
  const measurement = await page.evaluate(async () => {
    const scroll = document.querySelector<HTMLElement>('.codex-scroll')!;
    const frameTimes: number[] = [];
    let maxMounted = 0,
      prior = 0,
      step = 0;
    await new Promise<void>((resolve) => {
      const tick = (time: number) => {
        if (prior) frameTimes.push(time - prior);
        prior = time;
        scroll.scrollTop = ((scroll.scrollHeight - scroll.clientHeight) * step) / 90;
        maxMounted = Math.max(maxMounted, document.querySelectorAll('[data-codex-row]').length);
        if (++step <= 90) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    return {
      fps: (frameTimes.length * 1000) / frameTimes.reduce((a, b) => a + b, 0),
      maxMounted,
      top: scroll.scrollTop,
    };
  });
  expect(measurement.maxMounted).toBeLessThanOrEqual(8);
  expect(measurement.fps).toBeGreaterThanOrEqual(55);
  expect(measurement.top).toBeGreaterThan(0);
  console.log('Codex 500-work desktop emulation:', JSON.stringify(measurement));
  await shelf
    .getByRole('button', { name: /Volume/ })
    .last()
    .click();
  await expect(page.getByRole('heading', { level: 1, name: /Volume/ })).toBeVisible();
  await page.goBack();
  await expect(shelf).toBeVisible();
  await expect
    .poll(() => shelf.evaluate((element) => element.scrollTop))
    .toBeCloseTo(measurement.top, 0);
  await page.getByRole('button', { name: 'Index', exact: true }).click();
  await page.getByRole('button', { name: 'Codex', exact: true }).click();
  await expect
    .poll(() => shelf.evaluate((element) => element.scrollTop))
    .toBeCloseTo(measurement.top, 0);
  test.info().annotations.push({ type: 'measurement', description: JSON.stringify(measurement) });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.screenshot({ path: '.astra/review/adoption-codex-dark.png' });
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.codex-cabinet')!;
    canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
  });
  await expect(page.getByText('Two-dimensional bookcase · 3D unavailable')).toBeVisible();
  await expect(shelf.getByRole('button', { name: /Volume/ }).first()).toBeVisible();
});

test('empty Stats stays honest and obsolete spine routes open the index', async ({ page }) => {
  await page.evaluate(() => window.__EXL_PHASE9_TEST__!.openStats());
  await expect(page.getByRole('heading', { name: /so far/ })).toBeVisible();
  const figures = page.getByLabel("This year's reading figures");
  await expect(figures.getByText('0')).toHaveCount(2);
  await expect(figures.getByText('1')).toHaveCount(1);
  await expect(
    page.getByText(
      'Genre counts appear when works have genres. You can add them on a work’s record.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('img', { name: /Fantasy/ })).toHaveCount(0);

  await page.evaluate(async () => {
    await window.__EXL_PHASE9_TEST__!.seedSpines(39);
    window.__EXL_PHASE9_TEST__!.openSpine();
  });
  await expect(page.getByRole('button', { name: 'Index', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByText('Fixed logarithmic scale')).toHaveCount(0);
});
