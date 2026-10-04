import { expect, test, type Page } from '@playwright/test';

async function waitForReplacement(page: Page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.register('/sw.js?cross-client-upgrade=1', {
      scope: '/',
    });
    if (!registration.waiting) {
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(
          () => reject(new Error('The replacement worker never reached installed.')),
          15_000,
        );
        const watch = (worker: ServiceWorker) => {
          const finish = () => {
            if (worker.state !== 'installed') return;
            window.clearTimeout(timeout);
            resolve();
          };
          worker.addEventListener('statechange', finish);
          finish();
        };
        if (registration.installing) watch(registration.installing);
        else registration.addEventListener('updatefound', () => watch(registration.installing!));
      });
    }
    return registration.waiting?.scriptURL ?? '';
  });
}

test('two catalogue readers protect a draft in another window before a real worker update', async ({
  page,
  context,
}) => {
  test.setTimeout(60_000);
  const savedTitle = 'Kept across two reading windows';
  await page.goto('/');
  await page.getByRole('button', { name: 'Open the library' }).click();
  await page.getByLabel('Your name').fill('Two-window reader');
  await page.getByRole('button', { name: 'Open the library' }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.getByRole('button', { name: 'Add to the library' }).click();
  await page.getByRole('button', { name: /^Add by hand/ }).click();
  await page.getByLabel('Title', { exact: true }).fill(savedTitle);
  await page.getByRole('button', { name: 'Put it on the shelf' }).click();
  await expect(page.getByRole('heading', { level: 1, name: savedTitle })).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__EXL_CATALOGUE_TEST__));
  const installed = await page.evaluate(() => window.__EXL_CATALOGUE_TEST__!.install());
  expect(installed, JSON.stringify(installed)).toMatchObject({ phase: 'ready', works: 3_722 });
  if (installed.phase !== 'ready') throw new Error('The shared catalogue did not install.');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect(page.getByText(savedTitle).first()).toBeVisible();

  const idle = await context.newPage();
  await idle.goto('/');
  const readers = [page, idle];
  for (const reader of readers) {
    await reader.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await reader.waitForFunction(() => Boolean(window.__EXL_CATALOGUE_TEST__));
  }
  // Both handles stay open at the same time; an exclusive OPFS lock makes the
  // second open fail, even if sequential single-window searches work.
  const opened = await Promise.all(
    readers.map((reader) =>
      reader.evaluate((path) => window.__EXL_CATALOGUE_TEST__!.open(path), installed.path),
    ),
  );
  expect(opened).toEqual([3_722, 3_722]);
  const simultaneous = await Promise.all([
    page.evaluate(() => window.__EXL_CATALOGUE_TEST__!.search('solstice')),
    idle.evaluate(() => window.__EXL_CATALOGUE_TEST__!.search('dragon')),
  ]);
  expect(simultaneous[0]!.matches.map((match) => match.title)).toContain('Solstice in a Lantern');
  expect(
    simultaneous[1]!.matches.some((match) => match.title.startsWith('The Dragon Archive')),
  ).toBe(true);

  await page.getByRole('button', { name: 'Add to the library' }).click();
  await page.getByRole('button', { name: /^Add by hand/ }).click();
  const draftTitle = 'This draft must survive the other window';
  await page.getByLabel('Title', { exact: true }).fill(draftTitle);
  // Change only the generated release worker. This exercises its real waiting
  // and controller lifecycle, rather than replacing it with a fake worker.
  await context.route('**/sw.js?cross-client-upgrade=1', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: `${await response.text()}\n// cross-client update probe`,
    });
  });
  expect(await waitForReplacement(idle)).toContain('cross-client-upgrade=1');
  const offer = idle.getByRole('complementary', { name: 'App update' });
  await expect(offer).toBeVisible();
  const update = offer.getByRole('button', { name: 'Update', exact: true });
  await expect(update).toBeEnabled();
  await update.click();
  await expect(offer.getByRole('alert')).toHaveText(
    'Finish your current task in the other Ex Libris window before updating.',
  );
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(draftTitle);
  for (const reader of readers) {
    expect(
      await reader.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? ''),
    ).not.toContain('cross-client-upgrade=1');
  }

  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(update).toBeEnabled();
  await update.click();
  for (const reader of readers) {
    await reader.waitForFunction(() =>
      navigator.serviceWorker.controller?.scriptURL.includes('cross-client-upgrade=1'),
    );
    await expect(reader.getByText(savedTitle).first()).toBeVisible();
    await reader.waitForFunction(() => Boolean(window.__EXL_CATALOGUE_TEST__));
    expect(
      await reader.evaluate((path) => window.__EXL_CATALOGUE_TEST__!.open(path), installed.path),
    ).toBe(3_722);
    const retained = await reader.evaluate(() => window.__EXL_CATALOGUE_TEST__!.search('solstice'));
    expect(retained.matches.map((match) => match.title)).toContain('Solstice in a Lantern');
  }
});
