import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

/**
 * Cart → checkout → order with the real API.
 * Amounts are the documented ones from docs/features/promo-codes.md.
 */

const PASSWORD = 'Fernly-Test-2026';
const MINUS = '\u2212';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function signIn(page: Page, request: APIRequestContext): Promise<void> {
  const email = `e2e-${crypto.randomUUID()}@fernly.test`;
  const registered = await request.post('/api/auth/register', {
    data: { name: 'Eden Fern', email, password: PASSWORD },
  });
  expect(registered.status()).toBe(201);

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Hi, Eden')).toBeVisible();
}

async function addSmallPothos(page: Page): Promise<void> {
  await page.goto('/plants/pl-pothos');
  await expect(page.getByRole('heading', { level: 1, name: "Pothos 'Golden'" })).toBeVisible();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByRole('status').filter({ hasText: "Added 1 × Pothos 'Golden' to your cart." })).toBeVisible();
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: 'Your cart' })).toBeVisible();
}

function summary(page: Page, name: string) {
  return page.getByRole('region', { name });
}

test('E1 applying leafy10 is the same discount from cart through the paid order, then the cart is empty', { tag: '@e2e' }, async ({ page, request }) => {
  test.setTimeout(60_000);
  await signIn(page, request);
  await addSmallPothos(page);

  const cartSummary = summary(page, 'Order summary');
  await expect.soft(cartSummary.getByText('$6.95')).toBeVisible();
  await expect.soft(cartSummary.getByText('$19.45')).toBeVisible();

  await page.getByRole('textbox').fill('leafy10');
  await page.getByRole('button', { name: 'Apply' }).click();

  await expect.soft(cartSummary.getByText('Discount (LEAFY10)')).toBeVisible();
  await expect.soft(cartSummary.getByText(`${MINUS}$1.25`)).toBeVisible();
  await expect.soft(cartSummary.getByText('$6.95')).toBeVisible();
  await expect.soft(cartSummary.getByText('$18.20')).toBeVisible();

  await page.getByRole('link', { name: 'Go to checkout' }).click();
  const checkoutSummary = summary(page, 'Order summary');
  await expect.soft(checkoutSummary.getByText('Discount (LEAFY10)')).toBeVisible();
  await expect.soft(checkoutSummary.getByText(`${MINUS}$1.25`)).toBeVisible();
  await expect.soft(checkoutSummary.getByText('$6.95')).toBeVisible();
  await expect.soft(checkoutSummary.getByText('$18.20')).toBeVisible();

  await page.getByLabel('Full name').fill('Eden Fern');
  await page.getByLabel('Street address').fill('1 Fern Lane');
  await page.getByLabel('City').fill('Portland');
  await page.getByLabel('Postal code').fill('97201');
  await page.getByRole('button', { name: 'Place order' }).click();

  const paid = summary(page, 'Paid');
  await expect(paid).toBeVisible();
  await expect.soft(paid.getByText('Discount (LEAFY10)')).toBeVisible();
  await expect.soft(paid.getByText(`${MINUS}$1.25`)).toBeVisible();
  await expect.soft(paid.getByText('$18.20')).toBeVisible();

  await page.goto('/orders');
  await expect.soft(page.getByText('$18.20')).toBeVisible();

  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();

  await addSmallPothos(page);
  const again = summary(page, 'Order summary');
  await expect(again.getByText(/Discount/)).toHaveCount(0);
  await expect.soft(again.getByText('$6.95')).toBeVisible();
  await expect.soft(again.getByText('$19.45')).toBeVisible();
});

test('E1 an expired code is announced and the no-code total stays', { tag: '@e2e' }, async ({ page, request }) => {
  await signIn(page, request);
  await addSmallPothos(page);
  const cartSummary = summary(page, 'Order summary');

  await page.getByRole('textbox').fill('SPRING5');
  await page.getByRole('button', { name: 'Apply' }).click();

  const announced = page.locator('[role="alert"], [aria-live="assertive"]').filter({ hasText: /expired/i });
  await expect(announced).toBeVisible();
  await expect(cartSummary.getByText('$19.45')).toBeVisible();
  await expect(cartSummary.getByText(/Discount/)).toHaveCount(0);
});

test('E1 an unknown code is refused and the cart total stays', { tag: '@e2e' }, async ({ page, request }) => {
  await signIn(page, request);
  await addSmallPothos(page);
  const cartSummary = summary(page, 'Order summary');

  await page.getByRole('textbox').fill('NO-SUCH-CODE');
  await page.getByRole('button', { name: 'Apply' }).click();

  await expect(cartSummary.getByText('$19.45')).toBeVisible();
  await expect(cartSummary.getByText('$6.95')).toBeVisible();
  await expect(cartSummary.getByText(/Discount/)).toHaveCount(0);
  await expect(page.getByText('NO-SUCH-CODE', { exact: false })).toHaveCount(0);
});

test('E1 FREESHIP replaces LEAFY10 and Remove restores paid shipping', { tag: '@e2e' }, async ({ page, request }) => {
  await signIn(page, request);
  await addSmallPothos(page);

  await page.getByRole('textbox').fill('LEAFY10');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('LEAFY10', { exact: true })).toBeVisible();

  const field = page.getByRole('textbox');
  await expect(field, 'the promo field stays available so a new code can replace the old one').toBeVisible();
  await field.fill('FREESHIP');
  await page.getByRole('button', { name: 'Apply' }).click();

  const cartSummary = summary(page, 'Order summary');
  await expect(cartSummary.getByText('Free')).toBeVisible();
  await expect(cartSummary.getByText(/Discount/)).toHaveCount(0);
  await expect(cartSummary.getByText('$12.50')).toBeVisible();

  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(cartSummary.getByText('$6.95')).toBeVisible();
  await expect(cartSummary.getByText('$19.45')).toBeVisible();
});

test('E1 the promo field has a visible Promo code label and Apply and Remove are keyboard reachable', { tag: '@e2e' }, async ({ page, request }) => {
  await signIn(page, request);
  await addSmallPothos(page);

  const named = page.getByRole('textbox', { name: 'Promo code' });
  await expect(named).toBeVisible();
  await expect(page.getByText('Promo code', { exact: true })).toBeVisible();

  await named.focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Apply' })).toBeFocused();

  const token = await page.evaluate(() => localStorage.getItem('fernly_token'));
  if (!token) throw new Error('Signed-in page has no fernly_token');
  const applied = await request.post('/api/cart/promo', {
    headers: { Authorization: `Bearer ${token}` },
    data: { code: 'LEAFY10' },
  });
  expect(applied.ok()).toBeTruthy();
  const body: unknown = await applied.json();
  if (!isRecord(body)) throw new Error('POST /api/cart/promo did not return an object');

  await page.reload();
  const remove = page.getByRole('button', { name: 'Remove' });
  await remove.focus();
  await expect(remove).toBeFocused();
});
