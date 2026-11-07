import { expect, test } from '@playwright/test';

const THAI_MONSTERA_NAME =
  "Variegated Thai Constellation Monstera (Collector's Edition, Limited Greenhouse Batch)";

test('choosing "Price: high to low" shows the most expensive plant first', { tag: '@e2e' }, async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 2, name: /\d+ plants/ })).toBeVisible();

  await page.getByLabel('Sort by').selectOption('price-desc');

  const firstCard = page.getByRole('article').first();
  await expect(firstCard.getByRole('heading', { level: 3 })).toHaveText(THAI_MONSTERA_NAME);
});
