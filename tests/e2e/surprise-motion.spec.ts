import { expect, test } from '@playwright/test';

test('Surprise rerolls change the pick while keeping keyboard focus on Pick another', async ({
  page,
}) => {
  await page.goto('/?evaluate');
  await page.getByRole('button', { name: 'Explore the sample library' }).click();
  await expect(page.getByRole('heading', { name: 'The Left Hand of Darkness' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('button', { name: 'Wishlist', exact: true })
    .click();
  await expect(page.getByText('3 waiting', { exact: true })).toBeVisible();
  const surprise = page.getByRole('button', { name: 'Surprise me ↗', exact: true });
  await surprise.click();
  const dialog = page.getByRole('dialog', { name: 'A pick from your wishlist' });
  await expect(dialog).toBeVisible();
  const title = dialog.getByRole('heading', { level: 2 });
  const reroll = dialog.getByRole('button', { name: 'Pick another', exact: true });
  await reroll.focus();
  for (let turn = 0; turn < 3; turn++) {
    const previous = await title.innerText();
    await expect(reroll).toBeFocused();
    await reroll.press('Enter');
    await expect(title).not.toHaveText(previous);
    await expect(reroll).toBeFocused();
  }
  await page.goBack();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Wishlist', exact: true })).toBeVisible();
});
