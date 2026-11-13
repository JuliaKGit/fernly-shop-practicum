import { expect, test, type Page } from '@playwright/test';
import { formatBlockingMessage, scanPage } from './helpers/scan';

function creds(): { email: string; password: string } {
  const email = process.env.FERNLY_USER_EMAIL;
  const password = process.env.FERNLY_USER_PASSWORD;
  if (!email?.length || !password?.length) {
    throw new Error('FERNLY_USER_EMAIL and FERNLY_USER_PASSWORD must be set (see .env.example)');
  }
  return { email, password };
}

async function signInFirstCustomer(page: Page): Promise<void> {
  const { email, password } = creds();
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test('P13: cart promo field, applied code, and checkout/order discount line pass axe', {
  tag: '@a11y',
}, async ({ page }, testInfo) => {
  await signInFirstCustomer(page);
  await page.goto('/plants/pl-snake');
  await expect(page.getByRole('button', { name: 'Add to cart' })).toBeEnabled();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await page.goto('/cart');
  await expect(page.getByRole('heading', { level: 1, name: 'Your cart' })).toBeVisible();
  await expect(page.getByRole('textbox')).toBeVisible();

  // Reuse baseline page names so known PriceTag contrast stays baselined; new label issues still block.
  const cartScan = await scanPage(page, testInfo, { name: 'cart' });
  expect(
    cartScan.blocking,
    `Blocking a11y violations (promo field):\n${formatBlockingMessage(cartScan.blocking)}`,
  ).toHaveLength(0);

  // Refused message must be announced (role=alert / aria-live)
  await page.getByRole('textbox').fill('NOPE');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText(/recogniz|don't recognize/i)).toBeVisible();
  await expect(page.getByRole('alert')).toContainText(/recogniz|don't recognize/i);

  const errorScan = await scanPage(page, testInfo, { name: 'cart' });
  expect(
    errorScan.blocking,
    `Blocking a11y violations (promo error):\n${formatBlockingMessage(errorScan.blocking)}`,
  ).toHaveLength(0);

  // Applied code state
  await page.getByRole('textbox').fill('FREESHIP');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible();

  const appliedScan = await scanPage(page, testInfo, { name: 'cart' });
  expect(
    appliedScan.blocking,
    `Blocking a11y violations (applied promo):\n${formatBlockingMessage(appliedScan.blocking)}`,
  ).toHaveLength(0);

  await page.getByRole('button', { name: 'Remove' }).click();
  await page.getByRole('textbox').fill('LEAFY10');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Discount (LEAFY10)')).toBeVisible();

  await page.goto('/checkout');
  await expect(page.getByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible();
  await expect(page.getByText('Discount (LEAFY10)')).toBeVisible();
  const checkoutScan = await scanPage(page, testInfo, { name: 'checkout' });
  expect(
    checkoutScan.blocking,
    `Blocking a11y violations (checkout discount):\n${formatBlockingMessage(checkoutScan.blocking)}`,
  ).toHaveLength(0);

  await page.getByLabel('Full name').fill('Ava Green');
  await page.getByLabel('Street address').fill('1 Fern Lane');
  await page.getByLabel('City').fill('Portland');
  await page.getByLabel('Postal code').fill('97201');
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page).toHaveURL(/\/orders\/.+\?placed=1/);
  await expect(page.getByRole('heading', { name: 'Paid' })).toBeVisible();
  await expect(page.getByText('Discount (LEAFY10)')).toBeVisible();

  const orderScan = await scanPage(page, testInfo, { name: 'order-promo-discount' });
  expect(
    orderScan.blocking,
    `Blocking a11y violations (order discount):\n${formatBlockingMessage(orderScan.blocking)}`,
  ).toHaveLength(0);

  // Visible accessible name required by PRODUCT / promo docs
  await page.goto('/plants/pl-pothos');
  await expect(page.getByRole('button', { name: 'Add to cart' })).toBeEnabled();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await page.goto('/cart');
  await expect(page.getByRole('heading', { level: 1, name: 'Your cart' })).toBeVisible();
  await expect(page.getByLabel(/promo code/i)).toBeVisible();
});
