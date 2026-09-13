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
    if (navigator.storage.getDirectory) {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry('catalogue', { recursive: true }).catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error;
      });
    }
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
  await expect(page.getByRole('dialog', { name: 'Search only what you own' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();
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

test('first run requires a name, then teaches the real Home and install controls in place', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Open the library' }).click();
  // D-042 closed Q-003: the name is required, the button stays inert rather
  // than hidden, and the line under it says why.
  await expect(page.getByText('The bookplate needs a name before the library opens')).toBeVisible();
  await page.getByRole('button', { name: 'Open the library' }).click();
  await expect(page.getByText('From the books of')).toBeVisible();

  await page.getByLabel('Your name').fill('Qusai');
  await expect(page.getByText('It goes on the bookplate, and nowhere else.')).toBeVisible();
  await page.getByRole('button', { name: 'Open the library' }).click();

  const tour = page.getByRole('dialog');
  await expect(tour).toHaveAccessibleName('Search only what you own');
  await expect(tour.getByRole('button', { name: 'Next' })).toBeFocused();
  const measuredSearch = await page.evaluate(() => {
    const target = document.querySelector<HTMLElement>('[data-tour="search"]')!;
    const spotlight = document.querySelector<HTMLElement>('[data-tour-spotlight="search"]')!;
    const a = target.getBoundingClientRect();
    const b = spotlight.getBoundingClientRect();
    return {
      left: Math.abs(b.left - (a.left - 6)),
      top: Math.abs(b.top - (a.top - 6)),
      width: Math.abs(b.width - (a.width + 12)),
      height: Math.abs(b.height - (a.height + 12)),
    };
  });
  expect(Math.max(...Object.values(measuredSearch))).toBeLessThan(1);

  // The empty first-run library gets truthful copy rather than pretending a
  // Continue record already exists. The target itself remains the real empty
  // Home action, not a hardcoded rectangle or a dummy book.
  await tour.getByRole('button', { name: 'Next' }).click();
  await expect(tour).toHaveAccessibleName('Begin with anything');
  await tour.getByRole('button', { name: 'Next' }).click();
  await expect(tour).toHaveAccessibleName('Notes, trash and backups');
  await tour.getByRole('button', { name: 'Next' }).click();
  await expect(tour).toHaveAccessibleName('Everything, filtered');
  await tour.getByRole('button', { name: 'Next' }).click();
  await expect(tour).toHaveAccessibleName('Add anything');
  await page.evaluate(() => {
    const browser = window as typeof window & { __EXL_INSTALL_PROMPTED__?: boolean };
    const prompt = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(prompt, {
      prompt: async () => {
        browser.__EXL_INSTALL_PROMPTED__ = true;
      },
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });
    window.dispatchEvent(prompt);
  });
  await tour.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(tour).toHaveAccessibleName('Keep Ex Libris on this phone');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await page.screenshot({ path: '.impeccable/review/release-install-tour-light.png' });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.screenshot({ path: '.impeccable/review/release-install-tour-dark.png' });
  await tour.getByRole('button', { name: 'Install Ex Libris' }).click();
  await expect(tour).toHaveCount(0);
  await expect(page.getByText('Installed', { exact: true })).toBeVisible();
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.screenshot({ path: '.impeccable/review/release-installed-settings-dark.png' });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { __EXL_INSTALL_PROMPTED__?: boolean })
            .__EXL_INSTALL_PROMPTED__,
      ),
    )
    .toBe(true);

  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Shelves')).toBeVisible();
});

test('the library opens empty, and says so honestly', async ({ page }) => {
  await openLibrary(page);
  // Skip means "do not show this again", not "ask on the next launch".
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
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

test('a device cover is previewed, stored in OPFS, rendered, and removable', async ({ page }) => {
  await openLibrary(page);
  await addByHand(page, 'The Cover Test');

  await page.getByRole('button', { name: 'Add a cover' }).click();
  const picker = page.getByRole('dialog', { name: 'Cover' });
  await picker.getByLabel('Choose a cover image').setInputFiles('public/icons/icon-192.png');
  await expect(picker.getByAltText('Selected cover preview')).toBeVisible();
  await picker.getByRole('button', { name: 'Use this cover' }).click();

  await expect(page.getByRole('button', { name: 'Change cover' })).toBeVisible();
  await expect(page.locator('[data-cover] img')).toBeVisible();

  await page.getByRole('button', { name: 'Change cover' }).click();
  await page.getByRole('button', { name: 'Remove cover' }).click();
  await page.getByRole('button', { name: 'Remove cover' }).click();
  await expect(page.getByRole('button', { name: 'Add a cover' })).toBeVisible();
  await expect(page.locator('[data-cover] img')).toHaveCount(0);
});

test('a session moves the work and cannot record going backwards', async ({ page }) => {
  await openLibrary(page);
  await addByHand(page, 'Shadow Slave');

  await page.getByRole('button', { name: 'Edit this work' }).click();
  const current = page.getByLabel('You are on');
  const total = page.getByLabel('Out of');
  await current.click();
  await current.press('Control+A');
  await current.pressSequentially('100');
  await expect(current).toHaveValue('100');
  await total.pressSequentially('2000');
  // Both controlled values must survive React's render before Save reads the
  // draft. This also guards the rapid-two-field regression in EditWork.
  await expect(current).toHaveValue('100');
  await expect(total).toHaveValue('2000');
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

test('the real catalogue installs into OPFS and answers through the worker', async ({ page }) => {
  await openLibrary(page);
  await page.waitForFunction(() => Boolean(window.__EXL_CATALOGUE_TEST__));
  const ranges: Array<string | undefined> = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/corpus/corpus.sqlite')) {
      ranges.push(request.headers()['range']);
    }
  });

  const result = await page.evaluate(async () => {
    const bridge = window.__EXL_CATALOGUE_TEST__!;
    const installed = await bridge.install();
    if (installed.phase !== 'ready') return { installed, matches: [], elapsedMs: -1, timings: [] };
    const found = await bridge.search('sol');
    const timings = [found.elapsedMs];
    const concurrent = await Promise.all(
      ['soloist', 'dragon', 'soloist'].map((q) => bridge.search(q)),
    );
    if (
      !concurrent[0]!.matches.some((m) => m.title === 'Soloist in a Cage') ||
      !concurrent[2]!.matches.some((m) => m.title === 'Soloist in a Cage')
    ) {
      throw new Error('Concurrent catalogue searches mixed their statement state.');
    }
    for (let run = 0; run < 4; run++) timings.push((await bridge.search('sol')).elapsedMs);
    await bridge.close();
    await Promise.all([bridge.open(installed.path), bridge.open(installed.path)]);
    await bridge.close();
    return { installed, ...found, timings };
  });

  expect(result.installed, JSON.stringify(result.installed)).toMatchObject({
    phase: 'ready',
    works: 3722,
  });
  expect(result.matches.map((match) => match.title)).toContain('Soloist in a Cage');
  expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  // Pixel emulation changes the viewport and UA, not the desktop CPU. Keep a
  // broad cold-query regression alarm here; the contract's strict 50 ms check
  // is measured separately on physical Android hardware. Once the first FTS
  // pages are resident, every subsequent keystroke must already meet it.
  expect(result.elapsedMs).toBeLessThan(100);
  expect(result.timings.slice(1).every((elapsed) => elapsed < 50)).toBe(true);
  expect(ranges).toEqual(['bytes=0-4194303', 'bytes=4194304-4825087']);
});

test('an interrupted catalogue download resumes at the next verified chunk', async ({ page }) => {
  await openLibrary(page);
  await page.waitForFunction(() => Boolean(window.__EXL_CATALOGUE_TEST__));

  const firstAttempt: Array<string | undefined> = [];
  let requests = 0;
  await page.route('**/corpus/corpus.sqlite', async (route) => {
    firstAttempt.push(route.request().headers()['range']);
    requests++;
    if (requests === 2) await route.abort('failed');
    else await route.continue();
  });
  const interrupted = await page.evaluate(() => window.__EXL_CATALOGUE_TEST__!.install());
  expect(interrupted.phase).toBe('error');
  expect(firstAttempt).toEqual(['bytes=0-4194303', 'bytes=4194304-4825087']);

  await page.unroute('**/corpus/corpus.sqlite');
  const resumedRanges: Array<string | undefined> = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/corpus/corpus.sqlite')) {
      resumedRanges.push(request.headers()['range']);
    }
  });
  const resumed = await page.evaluate(() => window.__EXL_CATALOGUE_TEST__!.install());
  expect(resumed, JSON.stringify(resumed)).toMatchObject({ phase: 'ready', works: 3722 });
  expect(resumedRanges).toEqual(['bytes=4194304-4825087']);
  await page.evaluate(() => window.__EXL_CATALOGUE_TEST__!.close());
});

test('a catalogue network failure leaves manual entry usable', async ({ page, context }) => {
  await openLibrary(page);
  await page.waitForFunction(() => Boolean(window.__EXL_CATALOGUE_TEST__));
  await context.setOffline(true);
  const unavailable = await page.evaluate(() => window.__EXL_CATALOGUE_TEST__!.install());
  expect(unavailable.phase).toBe('error');

  await addByHand(page, 'Written without a network');
  await expect(page.getByText('Written without a network').first()).toBeVisible();
  await context.setOffline(false);
});

test('Phase 3 library search stays local and opens its matching work', async ({ page }) => {
  await openLibrary(page);
  await addByHand(page, 'A searchable private title');
  await tab(page, 'Library').click();
  const remote: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== 'http://localhost:4173') remote.push(request.url());
  });
  await page.getByRole('button', { name: 'Search your library' }).click();
  await page.getByRole('searchbox', { name: 'Search your library' }).fill('private');
  await page.getByRole('button', { name: /A searchable private title/ }).click();
  await expect(page.getByText('A searchable private title').first()).toBeVisible();
  expect(remote).toEqual([]);
});

test('the FAB stays above its menu and becomes the acquisition sheet', async ({ page }) => {
  await openLibrary(page);
  await page.getByRole('button', { name: 'Add to the library' }).click();
  const closeMenu = page.getByRole('button', { name: 'Close add menu' });
  await expect(closeMenu).toBeVisible();
  await expect(closeMenu).toHaveAttribute('aria-expanded', 'true');
  const layers = await page.evaluate(() => {
    const fab = document.querySelector<HTMLElement>('[aria-label="Close add menu"]');
    const menu = document.querySelector<HTMLElement>('[aria-label="Close"]')?.parentElement;
    return {
      fab: fab ? Number(getComputedStyle(fab).zIndex) : 0,
      menu: menu ? Number(getComputedStyle(menu).zIndex) : 0,
    };
  });
  expect(layers.fab).toBeGreaterThan(layers.menu);

  await page.getByRole('button', { name: 'Search the catalogue' }).click();
  const dialog = page.getByRole('dialog', { name: 'The catalogue' });
  await expect(dialog).toBeVisible();
  expect(
    await dialog
      .locator(':scope > div')
      .evaluate((panel) => getComputedStyle(panel).viewTransitionName),
  ).toBe('add-surface');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Add to the library' })).toBeVisible();
  await expect(page.locator('html')).not.toHaveAttribute('data-closing');
});

test('an interrupted FAB transition still navigates without an unhandled rejection', async ({
  page,
}) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  await openLibrary(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: (update: () => Promise<void>) => {
        const updated = Promise.resolve().then(update);
        const aborted = () => Promise.reject(new DOMException('interrupted probe', 'AbortError'));
        return {
          ready: aborted(),
          updateCallbackDone: updated.then(() => aborted()),
          finished: updated.then(() => aborted()),
        };
      },
    });
  });

  await page.getByRole('button', { name: 'Add to the library' }).click();
  await page.getByRole('button', { name: 'Search the catalogue' }).click();
  await expect(page.getByRole('dialog', { name: 'The catalogue' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Add to the library' })).toBeVisible();
  await expect(page.locator('html')).not.toHaveAttribute('data-closing');
  expect(problems).toEqual([]);
});

test('Phase 3 catalogue UI installs, confirms format and status, and survives offline restart', async ({
  page,
  context,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openLibrary(page);
  await page.getByRole('button', { name: 'Add to the library' }).click();
  await page.getByRole('button', { name: 'Search the catalogue' }).click();
  await page.getByRole('button', { name: 'Download the index' }).click();
  await page.getByRole('button', { name: 'Download the index' }).click();
  const readyFacts = page.getByText(/3,722 works/);
  await expect(readyFacts).toBeVisible({ timeout: 30_000 });
  await expect(readyFacts).not.toContainText('·');
  await page.getByRole('button', { name: 'Check for an updated index' }).click();
  await expect(page.getByRole('button', { name: 'Search the catalogue' })).toBeVisible();
  await page.getByRole('button', { name: 'Search the catalogue' }).click();
  const cataloguePaintMs = await page.evaluate(
    ({ query, expectedTitle }) =>
      new Promise<number>((resolve, reject) => {
        const field = document.querySelector<HTMLInputElement>(
          'input[aria-label="Search the catalogue"]',
        );
        if (!field) {
          reject(new Error('Catalogue search field is missing.'));
          return;
        }
        const started = performance.now();
        const timeout = window.setTimeout(() => {
          observer.disconnect();
          reject(new Error('Catalogue results were not painted in time.'));
        }, 2_000);
        const observer = new MutationObserver(() => {
          const found = [...document.querySelectorAll('[data-candidate]')].some((candidate) =>
            candidate.textContent?.includes(expectedTitle),
          );
          if (!found) return;
          observer.disconnect();
          window.clearTimeout(timeout);
          requestAnimationFrame(() => resolve(performance.now() - started));
        });
        observer.observe(document.body, { childList: true, subtree: true });
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(field, query);
        field.dispatchEvent(new Event('input', { bubbles: true }));
      }),
    { query: 'soloist', expectedTitle: 'Soloist in a Cage' },
  );
  // This includes React state work and the next painted frame, not only the
  // worker's SQL timer. Desktop emulation is a regression alarm; the binding
  // 50 ms acceptance result still has to come from physical Android hardware.
  expect(cataloguePaintMs).toBeLessThan(100);
  await expect(
    page.locator('[data-candidate]').filter({ hasText: 'Soloist in a Cage' }),
  ).toContainText('Comic');
  await expect(
    page.locator('[data-candidate]').filter({ hasText: 'Soloist in a Cage' }),
  ).not.toContainText('·');
  await page.getByRole('button', { name: 'Add Soloist in a Cage' }).click();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Soloist in a Cage');
  await expect(page.getByRole('radio', { name: 'Manhwa' })).toBeChecked();
  await expect(page.getByLabel('Cover reference')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Put it on the shelf' })).toBeDisabled();
  await page.getByRole('radio', { name: 'Wishlist' }).click();
  await page.getByRole('button', { name: 'Put it on the shelf' }).click();
  await expect(page.getByText('Soloist in a Cage').first()).toBeVisible();
  // Wait for actual precaching, then cold-load the shell and WASM with no network.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect(page.getByText('Shelves')).toBeVisible();
  // Chromium's emulated network can stay offline while a new SW-controlled
  // document reports navigator.onLine=true (observed in this test). Pin the
  // status input separately; context.setOffline still proves real fetch failure.
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true }),
  );
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('You are offline. Your library is still available.')).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss connection message' }).click();
  await page.getByRole('button', { name: 'Add to the library' }).click();
  await page.getByRole('button', { name: 'Search the catalogue' }).click();
  await page.getByRole('searchbox', { name: 'Search the catalogue' }).fill('soloist');
  await page.getByRole('button', { name: 'Open Soloist in a Cage' }).click();
  await expect(page.getByText('Soloist in a Cage').first()).toBeVisible();
});

test('Phase 3 online search only sends an explicit lookup and cancels stale results', async ({
  page,
}) => {
  await openLibrary(page);
  let calls = 0;
  await page.route('https://api.mangadex.org/manga?*', async (route) => {
    calls++;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'synthetic-comic',
            attributes: {
              title: { en: 'A synthetic comic' },
              status: 'ongoing',
              lastChapter: '96',
            },
            relationships: [],
          },
        ],
      }),
    });
  });
  await page.getByRole('button', { name: 'Add to the library' }).click();
  await page.getByRole('button', { name: 'Search the catalogue' }).click();
  const field = page.getByRole('searchbox', { name: 'Search the catalogue' });
  await field.fill('synthetic');
  expect(calls).toBe(0);
  await page.getByRole('button', { name: 'Search online', exact: true }).click();
  await expect(page.getByText('A synthetic comic')).toBeVisible();
  expect(calls).toBe(1);
  await expect(
    page.getByRole('link', { name: 'Online manga results from MangaDex.' }),
  ).toBeVisible();
  await field.fill('different');
  await expect(page.getByText('A synthetic comic')).toHaveCount(0);
  expect(calls).toBe(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Phase 3 connection notices distinguish offline from reconnecting', async ({
  page,
  context,
}) => {
  await openLibrary(page);
  await context.setOffline(true);
  await expect(page.getByRole('status')).toContainText('You are offline');
  await context.setOffline(false);
  await expect(page.getByRole('status')).toContainText('Connection restored');
  await page.getByRole('button', { name: 'Dismiss connection message' }).click();
  await expect(page.getByText('Connection restored.')).toHaveCount(0);
});

test('a service-worker upgrade preserves local data and the downloaded catalogue', async ({
  page,
  context,
}) => {
  await openLibrary(page);
  await addByHand(page, 'Still here after the upgrade');
  await page.waitForFunction(() => Boolean(window.__EXL_CATALOGUE_TEST__));
  const installed = await page.evaluate(() => window.__EXL_CATALOGUE_TEST__!.install());
  expect(installed, JSON.stringify(installed)).toMatchObject({ phase: 'ready', works: 3722 });

  // The first load installs the worker; this reload makes the page a real
  // controlled client so its successor must wait rather than taking over in
  // the middle of a reading session.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect(page.getByText('Still here after the upgrade').first()).toBeVisible();
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const key of await caches.keys()) {
      const cache = await caches.open(key);
      urls.push(...(await cache.keys()).map((request) => request.url));
    }
    return urls;
  });
  expect(cached.some((url) => url.endsWith('.wasm'))).toBe(true);
  expect(cached.some((url) => new URL(url).pathname.startsWith('/corpus/'))).toBe(false);

  // Supply the same generated worker with one changed byte. This reproduces a
  // real release without maintaining a second fake worker in the product.
  await context.route('**/sw.js?phase3-upgrade=1', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\n// phase-3 upgrade probe` });
  });
  const waitingUrl = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.register('/sw.js?phase3-upgrade=1', {
      scope: '/',
    });
    if (!registration.waiting) {
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(
          () => reject(new Error('The replacement service worker never reached installed.')),
          15_000,
        );
        const watch = (worker: ServiceWorker) => {
          const finish = () => {
            if (worker.state === 'installed') {
              window.clearTimeout(timeout);
              resolve();
            }
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
  expect(waitingUrl).toContain('phase3-upgrade=1');

  await page.close();
  const relaunched = await context.newPage();
  await relaunched.goto('/');
  await relaunched.waitForFunction(() =>
    navigator.serviceWorker.controller?.scriptURL.includes('phase3-upgrade=1'),
  );
  await expect(relaunched.getByText('Still here after the upgrade').first()).toBeVisible();

  await context.setOffline(true);
  await relaunched.reload();
  await expect(relaunched.getByText('Still here after the upgrade').first()).toBeVisible();
  await relaunched.getByRole('button', { name: 'Add to the library' }).click();
  await relaunched.getByRole('button', { name: 'Search the catalogue' }).click();
  await relaunched.getByRole('searchbox', { name: 'Search the catalogue' }).fill('soloist');
  await expect(
    relaunched.locator('[data-candidate]').filter({ hasText: 'Soloist in a Cage' }),
  ).toBeVisible();
});
