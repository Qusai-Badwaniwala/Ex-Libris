import { expect, test, type Page } from '@playwright/test';

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
  await page.waitForFunction(() => Boolean(window.__EXL_PHASE7_TEST__));
}

async function settleMotion(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState === 'finished'),
  );
}

test.beforeEach(async ({ page }) => {
  await freshLibrary(page);
});

test('empty Notes and its blank editor keep their themed illustration states', async ({ page }) => {
  await page.getByLabel('Light theme').click();
  await page.evaluate(() => window.__EXL_PHASE7_TEST__!.openNotes());
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();
  await expect(page.getByText('A clear page')).toBeVisible();
  await expect(
    page.locator('img[src*="/illustrations/light/research-paper-amico.svg"]'),
  ).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/phase7-notes-empty-light.png' });

  await page.getByRole('button', { name: 'Write a note' }).click();
  const editor = page.getByRole('dialog', { name: 'New note' });
  await expect(editor.locator('img[src*="/illustrations/light/studying-bro.svg"]')).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Save' })).toBeDisabled();
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await expect(editor.locator('img[src*="/illustrations/dark/studying-bro.svg"]')).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/phase7-editor-blank-dark.png' });
});

test('a pinned tagged note attaches to two works, appears in three places, and keeps a failed draft', async ({
  page,
}) => {
  const fixture = await page.evaluate(() => window.__EXL_PHASE7_TEST__!.seed());
  await page.evaluate(() => window.__EXL_PHASE7_TEST__!.openNotes());
  await page.getByRole('button', { name: 'Write a note' }).click();
  const editor = page.getByRole('dialog', { name: 'New note' });
  await editor.getByLabel('Note title').fill('A route through both books');
  await editor.getByLabel('Note body').fill('The ending changes the opening.');
  await editor.getByRole('button', { name: 'Attach to a work' }).click();
  await editor.getByRole('button', { name: 'Attach The Glass Archive' }).click();
  await editor.getByRole('button', { name: 'Attach A River of Margins' }).click();

  await editor.getByRole('button', { name: /^Tags/ }).click();
  const tags = page.getByRole('dialog', { name: 'Note tags' });
  await tags.getByLabel('Search tags').fill('Memory');
  await tags.getByRole('button', { name: 'Memory', exact: true }).click();
  await tags.getByLabel('Search tags').fill('Reading route');
  await tags.getByRole('button', { name: 'New tag' }).click();
  await page.screenshot({ path: '.impeccable/review/phase7-tags-light.png' });
  await tags.getByRole('button', { name: 'Done' }).click();
  await editor.getByRole('switch', { name: 'Keep it at the top' }).click();
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(editor).toHaveCount(0);
  await settleMotion(page);

  const pinned = page.getByRole('button', { name: /Edit note: A route through both books/ });
  await expect(pinned).toContainText('Pinned');
  await expect(pinned).toContainText('The Glass Archive');
  await expect(pinned).toContainText('A River of Margins');
  const notes = page.getByRole('button', { name: /^Edit note:/ });
  await expect(notes.first()).toHaveAccessibleName(/A route through both books/);
  await page.screenshot({ path: '.impeccable/review/phase7-notes-feed-dark.png' });

  await page.evaluate((id) => window.__EXL_PHASE7_TEST__!.openDetail(id), fixture.firstWorkId);
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Edit note: A route through both books/ }),
  ).toBeVisible();
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await page.getByRole('heading', { name: 'Notes' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.impeccable/review/phase7-work-notes-light.png' });

  await page.evaluate(() => window.__EXL_PHASE7_TEST__!.openSearch());
  await page.getByLabel('Search your library').fill('Reading route');
  await expect(
    page.getByRole('button', { name: /Edit note: A route through both books/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Edit note: A route through both books/ }).click();
  const edit = page.getByRole('dialog', { name: 'Edit note' });
  await edit.getByLabel('Note body').fill('A failed rewrite remains in the editor.');
  // Wait for React's controlled draft to own the typed value before the
  // synthetic Dexie failure invalidates live queries in the same task.
  await expect(edit.getByLabel('Note body')).toHaveValue('A failed rewrite remains in the editor.');
  await page.evaluate(() => window.__EXL_PHASE7_TEST__!.failNextNoteUpdate());
  await edit.getByRole('button', { name: 'Save' }).click();
  await expect(edit.getByRole('alert')).toContainText('could not be saved');
  await expect(edit.getByLabel('Note body')).toHaveValue('A failed rewrite remains in the editor.');
});

test('deleting and restoring a note is reversible, while permanent work deletion only unlinks it', async ({
  page,
}) => {
  const fixture = await page.evaluate(() => window.__EXL_PHASE7_TEST__!.seed());
  await page.evaluate(async ({ firstWorkId, secondWorkId }) => {
    const bridge = window.__EXL_PHASE7_TEST__!;
    bridge.openNotes();
    // The preceding journey covers the full editor; this one isolates the
    // delete/restore/unlink lifecycle.
    await bridge.createLinkedNote([firstWorkId, secondWorkId]);
  }, fixture);

  await page.getByRole('button', { name: /Edit note: Surviving note/ }).click();
  await page
    .getByRole('dialog', { name: 'Edit note' })
    .getByRole('button', { name: 'Delete this note' })
    .click();
  await expect(page.getByRole('button', { name: /Edit note: Surviving note/ })).toHaveCount(0);
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.evaluate(() => window.__EXL_PHASE7_TEST__!.openTrash());
  await page.screenshot({ path: '.impeccable/review/phase7-note-trash-dark.png' });
  const row = page.getByText('Surviving note').locator('..').locator('..');
  await row.getByRole('button', { name: 'Restore' }).click();
  await page.evaluate(() => window.__EXL_PHASE7_TEST__!.openNotes());
  await expect(page.getByRole('button', { name: /Edit note: Surviving note/ })).toBeVisible();

  await page.evaluate((id) => window.__EXL_PHASE7_TEST__!.purgeWork(id), fixture.secondWorkId);
  const note = page.getByRole('button', { name: /Edit note: Surviving note/ });
  await expect(note).toBeVisible();
  await expect(note).toContainText('The Glass Archive');
  await expect(note).not.toContainText('A River of Margins');
});
