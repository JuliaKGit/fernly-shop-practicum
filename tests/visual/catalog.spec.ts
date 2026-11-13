import { expect, test, type Locator } from '@playwright/test';
import { BrowsePage } from '../pages/BrowsePage';

/** Waits until the card and its plant photo have finished loading. */
async function waitForPlantCardReady(card: Locator): Promise<void> {
  await expect(card).toBeVisible();
  const image = card.getByRole('img');
  await expect(image).toBeVisible();
  await image.evaluate((el) => {
    const img = el as HTMLImageElement;
    if (img.complete) {
      return;
    }
    return new Promise<void>((resolve, reject) => {
      img.addEventListener('load', () => resolve(), { once: true });
      img.addEventListener('error', () => reject(new Error('Plant image failed to load')), { once: true });
    });
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('fernly_token');
    localStorage.removeItem('fernly_saved');
  });
});

test('catalog first screen', { tag: '@visual' }, async ({ page }) => {
  const browse = await new BrowsePage(page).goto();
  await expect(browse.plantsCountHeading).toHaveText(/\d+ plants/);
  await expect(browse.plantCards).toHaveCount(12);

  for (const card of await browse.plantCards.all()) {
    await waitForPlantCardReady(card);
  }

  await expect(page).toHaveScreenshot('catalog-first-screen.png');
});

test('Monstera Deliciosa card (plenty in stock)', { tag: '@visual' }, async ({ page }) => {
  const browse = await new BrowsePage(page).goto();
  await expect(browse.plantsCountHeading).toHaveText(/\d+ plants/);

  const card = browse.plantCardByName('Monstera Deliciosa');
  await waitForPlantCardReady(card);

  await expect(card).toHaveScreenshot('monstera-deliciosa-card.png');
});

test('Hoya Carnosa card (low stock)', { tag: '@visual' }, async ({ page }) => {
  const browse = await new BrowsePage(page).goto();
  await expect(browse.plantsCountHeading).toHaveText(/\d+ plants/);

  await browse.goToNextPage();
  await expect(browse.plantCardByName('Hoya Carnosa')).toBeVisible();

  const card = browse.plantCardByName('Hoya Carnosa');
  await waitForPlantCardReady(card);

  await expect(card).toHaveScreenshot('hoya-carnosa-card.png');
});
