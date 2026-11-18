import { expect, test } from '@playwright/test';
import { BrowsePage } from '../pages/BrowsePage';

const THAI_MONSTERA_NAME =
  "Variegated Thai Constellation Monstera (Collector's Edition, Limited Greenhouse Batch)";

test('choosing "Price: high to low" shows the most expensive plant first', { tag: '@e2e' }, async ({
  page,
}) => {
  const browse = await new BrowsePage(page).goto();
  await expect(browse.plantsCountHeading).toBeVisible();

  await browse.selectSort('price-desc');

  const firstCard = browse.firstPlantCard();
  await expect(browse.plantCardTitle(firstCard)).toHaveText(THAI_MONSTERA_NAME);
});
