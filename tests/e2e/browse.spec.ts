import { expect, test } from '@playwright/test';

const MOST_EXPENSIVE_NAME =
  "Variegated Thai Constellation Monstera (Collector's Edition, Limited Greenhouse Batch)";

test('Price: high to low shows the most expensive plant first', { tag: '@e2e' }, async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Sort by').selectOption('price-desc');
  await expect(page.getByRole('heading', { level: 2, name: /\d+ plants/ })).toBeVisible();
  const firstCard = page.getByRole('article').first();
  await expect(firstCard.getByRole('heading', { level: 3 })).toContainText(MOST_EXPENSIVE_NAME);
});
