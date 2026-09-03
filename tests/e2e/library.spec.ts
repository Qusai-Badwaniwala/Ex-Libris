import { test, expect, type Page } from '@playwright/test';

/**
 * The Phase 1 gate, as a journey rather than a checklist: add a book by hand,
 * see it on the shelf, change everything about it, log a session, delete it,
 * restore it. If a person cannot do that, the app is not usable, and every one
 * of those steps except the first was missing from the design package.
 *
 * Runs against a production build. Each test starts from a genuinely empty
 * device — no seeded data anywhere in this project.
 */

async function freshStart(page: Page) {
  await page.goto('/');
  await page.evaluate(async () => {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
    await new Promise((res) => {
      const req = indexedDB.deleteDatabase('ex-libris');
      req.onsuccess = req.onerror = req.onblocked = () => res(null);
    });
  });
  await page.reload();
}

/** The four bottom tabs. Scoped to the nav landmark because a status pill on
 *  the screen behind can carry the same word — "Wishlist" is both. */
function tab(page: Page, name: string) {
  return page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name });
}

async function openLibrary(page: Page, name = 'Qusai') {
  await page.getByRole('button', { name: 'Open the library' }).click();
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: 'Open the library' }).click();
  await expect(page.getByText('Shelves')).toBeVisible();
}

async function addByHand(page: Page, title: string) {
  await page.getByRole('button', { name: 'Add to the library' }).click();
  await page.getByRole('button', { name: 'Add by hand' }).click();
  await page.getByLabel('Title').fill(title);
  await page.getByRole('button', { name: 'Put it on the shelf' }).click();
  await expect(
    page.getByRole('heading', { level: 1 }).or(page.getByText(title).first()),
  ).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test('first run asks for a name and will not open without one', async ({ page }) => {
  await page.getByRole('button', { name: 'Open the library' }).click();
  // D-042 closed Q-003: the name is required, the button stays inert rather
  // than hidden, and the line under it says why.
  await expect(page.getByText('The bookplate needs a name before the library opens')).toBeVisible();
  await page.getByRole('button', { name: 'Open the library' }).click();
  await expect(page.getByText('From the books of')).toBeVisible();

  await page.getByLabel('Your name').fill('Qusai');
  await expect(page.getByText('It goes on the bookplate, and nowhere else.')).toBeVisible();
  await page.getByRole('button', { name: 'Open the library' }).click();
  await expect(page.getByText('Shelves')).toBeVisible();
});

test('the library opens empty, and says so honestly', async ({ page }) => {
  await openLibrary(page);
  // Never inflate: no sample data, and the three figures are all zero rather
  // than absent.
  await expect(page.getByText('Continue')).toHaveCount(0);
  await expect(page.getByText('in the library')).toBeVisible();
});

test('a work added by hand can then have everything about it changed', async ({ page }) => {
  await openLibrary(page);
  await addByHand(page, 'Reverend Insanity');

  // A1 — the status. The design package has no control for this anywhere, so
  // without it nothing could ever be marked finished, dropped or caught up.
  await page.getByRole('button', { name: /Reading/ }).click();
  await expect(page.getByText('Where are you with this')).toBeVisible();
  // Publication is unknown for a hand-added work, so caught up is not offered:
  // nothing that has finished publishing can be caught up with.
  await expect(page.getByRole('button', { name: /Caught up/ })).toHaveCount(0);
  await page.getByRole('button', { name: /Dropped/ }).click();
  await expect(page.getByRole('button', { name: /Dropped/ })).toBeVisible();

  // A2, A3, A4 — the edit sheet.
  await page.getByRole('button', { name: 'Edit this work' }).click();
  await page.getByLabel('Title').fill('Reverend Insanity 蛊真人');
  await page.getByLabel('Author or translator').fill('Gu Zhen Ren');
  await page.getByRole('radio', { name: 'Novels' }).click();
  await page.getByRole('radio', { name: 'Chapters' }).click();
  await page.getByLabel('You are on').fill('2334');
  await page.getByRole('button', { name: 'Ongoing' }).click();
  await page.getByLabel('Released so far').fill('2334');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Reverend Insanity 蛊真人')).toBeVisible();
  await expect(page.getByText('Gu Zhen Ren')).toBeVisible();

  // Now that it is ongoing, caught up IS offered — the two facts are
  // orthogonal and one is never derived from the other.
  await page.getByRole('button', { name: /Dropped/ }).click();
  await expect(page.getByRole('button', { name: /Caught up/ })).toBeVisible();
  await page.getByRole('button', { name: /^Reading/ }).click();

  // D-105: for an ongoing work the total is what has been RELEASED, so
  // reaching it reads as caught up and never as finished.
  await expect(page.getByText('Chapter 2,334 published')).toBeVisible();
});

test('a session moves the work and cannot record going backwards', async ({ page }) => {
  await openLibrary(page);
  await addByHand(page, 'Shadow Slave');

  await page.getByRole('button', { name: 'Edit this work' }).click();
  await page.getByLabel('You are on').fill('100');
  await page.getByLabel('Out of').fill('2000');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Chapter 100 / 2,000')).toBeVisible();

  await page.getByRole('button', { name: 'Log a session' }).click();
  await expect(page.getByText('You were on chapter 100 of 2,000')).toBeVisible();
  // Floors at the current position: a session asks where you got to, and you
  // cannot get to somewhere behind where you already are. The control is
  // disabled at the floor rather than silently doing nothing, so the reason is
  // visible before the tap rather than inferred after it.
  await expect(page.getByRole('button', { name: 'Back one chapter' })).toBeDisabled();
  await expect(page.getByText('Nothing logged yet')).toBeVisible();

  await page.getByRole('button', { name: '+10' }).click();
  await page.getByRole('button', { name: '+5' }).click();
  await expect(page.getByText('15 chapters this session')).toBeVisible();
  await page.getByRole('button', { name: 'Log it' }).click();

  await expect(page.getByText('Chapter 115 / 2,000')).toBeVisible();
});

test('removing a work sends it to the trash, and it comes back whole', async ({ page }) => {
  await openLibrary(page);
  await addByHand(page, 'Kill the Sun');

  await page.getByRole('button', { name: 'Remove from the library' }).click();
  await expect(page.getByText('Shelves')).toBeVisible();

  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Trash' }).click();
  await expect(page.getByText('Kill the Sun')).toBeVisible();
  await expect(page.getByText('30 days left')).toBeVisible();

  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByText('Trash is empty')).toBeVisible();

  await tab(page, 'Library').click();
  await page.getByRole('button', { name: /^Novels/ }).click();
  await expect(page.getByText('Kill the Sun')).toBeVisible();
});

test('the back gesture closes a sheet before it changes screen', async ({ page }) => {
  await openLibrary(page);
  await addByHand(page, 'The Verdigris Ledger');

  await page.getByRole('button', { name: 'Edit this work' }).click();
  await expect(page.getByText('Edit this work')).toBeVisible();

  await page.goBack();
  await expect(page.getByText('Edit this work')).toHaveCount(0);
  // Still on the work. A back gesture that skipped the open sheet would read
  // as the app losing your place.
  await expect(page.getByText('The Verdigris Ledger')).toBeVisible();
});

test('the whole app loads with a clean console', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(m.text());
  });
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`${r.url()} -> ${r.status()}`);
  });

  await openLibrary(page);
  await addByHand(page, 'A Cartography of Debts');
  await page.getByRole('button', { name: 'Add a genre' }).click();
  await page.getByRole('button', { name: 'Fantasy' }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  expect(problems).toEqual([]);
});

test('the surprise card is dismissible by the back gesture, like every sheet', async ({ page }) => {
  // Built first as local state, which quietly exempted it from the one rule the
  // router exists to enforce. A scrim the hardware back button cannot dismiss
  // traps the reader on the screen.
  await openLibrary(page);
  await page.getByRole('button', { name: 'Add to the library' }).click();
  await page.getByRole('button', { name: 'Add by hand' }).click();
  await page.getByLabel('Title').fill('Lord of the Mysteries');
  await page.getByRole('radio', { name: 'Wishlist' }).click();
  await page.getByRole('button', { name: 'Put it on the shelf' }).click();

  await tab(page, 'Wishlist').click();
  await expect(page.getByText('1 waiting')).toBeVisible();

  await page.getByRole('button', { name: 'Surprise me' }).click();
  await expect(page.getByRole('button', { name: 'Start reading it' })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('button', { name: 'Start reading it' })).toHaveCount(0);
  // And the wishlist underneath is still there, not navigated away from.
  await expect(page.getByText('1 waiting')).toBeVisible();
});

test('Surprise me is inert with an empty wishlist rather than dealing nothing', async ({
  page,
}) => {
  await openLibrary(page);
  await tab(page, 'Wishlist').click();
  // The design uses the phrase twice on this screen: the counter reads
  // "nothing waiting" (D-090 — a zero rendered as a numeral looks like a bug)
  // and the empty state's headline is "Nothing waiting". Both are its copy, so
  // the locator has to be exact rather than the copy changed.
  await expect(page.getByText('Nothing waiting', { exact: true })).toBeVisible();
  await expect(page.getByText('nothing waiting', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Surprise me' })).toBeDisabled();
});

test('adding from the Wishlist adds to the wishlist', async ({ page }) => {
  // The screen you were on says what you meant. Defaulting to Reading here
  // makes the reader change it every single time.
  await openLibrary(page);
  await tab(page, 'Wishlist').click();
  await page.getByRole('button', { name: 'Add to the library' }).click();
  await page.getByRole('button', { name: 'Add by hand' }).click();
  await expect(page.getByRole('radio', { name: 'Wishlist' })).toBeChecked();

  await page.getByLabel('Title').fill('Kill the Sun');
  await page.getByRole('button', { name: 'Put it on the shelf' }).click();
  await expect(page.getByRole('button', { name: /Wishlist/ }).first()).toBeVisible();

  await tab(page, 'Wishlist').click();
  await expect(page.getByText('Kill the Sun')).toBeVisible();
});

test('adding from a shelf adds to that shelf, with its unit', async ({ page }) => {
  await openLibrary(page);
  await page.getByRole('button', { name: /^Books/ }).click();
  await page.getByRole('button', { name: 'Add to the library' }).click();
  await page.getByRole('button', { name: 'Add by hand' }).click();
  await expect(page.getByRole('radio', { name: 'Books' })).toBeChecked();
  // A book is counted in pages. Carrying the chapter default onto the Books
  // shelf is the same quiet mismatch as changing the unit on a shelf move.
  await expect(page.getByRole('radio', { name: 'Pages' })).toBeChecked();
});
