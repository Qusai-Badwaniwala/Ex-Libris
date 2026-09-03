import { test, expect } from '@playwright/test';

/**
 * Phase 0's gate, run against the real build in a real browser.
 *
 * Every assertion here is about something a unit test structurally cannot
 * reach: whether IndexedDB actually opens in a browser, whether OPFS will hold
 * a file, and whether the hardware back gesture closes a sheet. All three were
 * "obviously fine" right up until they were checked.
 */

/** The diagnostics panel renders label/value pairs; read the value by label. */
async function valueOf(page: import('@playwright/test').Page, label: string) {
  const row = page
    .locator('div')
    .filter({ hasText: new RegExp(`^${label}`) })
    .last();
  return (await row.innerText()).replace(label, '').trim();
}

test('the foundations report themselves as working', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('phase 0 · foundations')).toBeVisible();

  // Not a capability sniff — the app writes a file, reads it back and deletes
  // it before reporting. "OPFS exists" and "OPFS can hold a cover" are
  // different claims.
  await expect.poll(() => valueOf(page, 'opfs round trip')).toBe('pass');
  await expect.poll(() => valueOf(page, 'indexeddb open')).toBe('yes');
  await expect.poll(() => valueOf(page, 'genres')).toBe('12');
  await expect.poll(() => valueOf(page, 'seeded tags')).toBe('242');
});

test('the library survives a reload', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => valueOf(page, 'indexeddb open')).toBe('yes');
  const stamped = await valueOf(page, 'first tracked');
  expect(stamped).not.toBe('—');

  await page.reload();
  // firstTrackedAt is the origin for "years tracked". If a reload re-stamped
  // it, that figure would reset to zero every time the app was opened.
  await expect.poll(() => valueOf(page, 'first tracked')).toBe(stamped);
});

test('back closes the open sheet before it changes screen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'push screen' }).click();
  await page.getByRole('button', { name: 'open sheet' }).click();

  await expect.poll(() => valueOf(page, 'overlay stack')).toBe('drawer');
  await expect.poll(() => valueOf(page, 'screen stack')).toContain('detail');

  await page.goBack();

  await expect.poll(() => valueOf(page, 'overlay stack')).toBe('none');
  // The screen must not have moved. A back gesture that skips the open sheet
  // is the defect this whole file exists to catch.
  await expect.poll(() => valueOf(page, 'screen stack')).toContain('detail');

  await page.goBack();
  await expect.poll(() => valueOf(page, 'screen stack')).toBe('home');
});

test('the theme choice is written to the store and survives a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'light', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.reload();
  // A theme that resets on reload means the settings write silently failed.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.getByRole('button', { name: 'dark', exact: true }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'light');
});

test('the app loads with a clean console and no missing resources', async ({ page }) => {
  // Added after a hand check found a 404 on /favicon.ico that every other test
  // in this file was happy to ignore. A page that asks for something it does
  // not ship is the class of defect a unit test structurally cannot see, and
  // the cheapest catch is to refuse to tolerate any console error at all.
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(m.text());
  });
  page.on('requestfailed', (r) => problems.push(`${r.url()} failed`));
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`${r.url()} -> ${r.status()}`);
  });

  await page.goto('/');
  await expect.poll(() => valueOf(page, 'indexeddb open')).toBe('yes');
  expect(problems).toEqual([]);
});

test('the service worker registers in the built app', async ({ page }) => {
  await page.goto('/');
  // Offline is the whole product promise. If registration silently fails, the
  // app still works today and is broken the first time it is opened on a train.
  const registered = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'unsupported';
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ? 'registered' : 'none';
  });
  expect(registered).toBe('registered');
});
