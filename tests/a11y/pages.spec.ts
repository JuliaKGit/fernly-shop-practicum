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

test('Browse', { tag: '@a11y' }, async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /windowsill/i })).toBeVisible();
  const { blocking } = await scanPage(page, testInfo, { name: 'browse' });
  expect(blocking, `Blocking a11y violations:\n${formatBlockingMessage(blocking)}`).toHaveLength(0);
});

test('Plant', { tag: '@a11y' }, async ({ page }, testInfo) => {
  await page.goto('/plants/pl-monstera');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const { blocking } = await scanPage(page, testInfo, { name: 'plant' });
  expect(blocking, `Blocking a11y violations:\n${formatBlockingMessage(blocking)}`).toHaveLength(0);
});

test('Sign in', { tag: '@a11y' }, async ({ page }, testInfo) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  const { blocking } = await scanPage(page, testInfo, { name: 'sign-in' });
  expect(blocking, `Blocking a11y violations:\n${formatBlockingMessage(blocking)}`).toHaveLength(0);
});

test('Cart — signed in with one plant', { tag: '@a11y' }, async ({ page }, testInfo) => {
  await signInFirstCustomer(page);
  await page.goto('/plants/pl-monstera');
  await expect(page.getByRole('button', { name: 'Add to cart' })).toBeEnabled();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await page.goto('/cart');
  await expect(page.getByRole('heading', { level: 1, name: 'Your cart' })).toBeVisible();
  const { blocking } = await scanPage(page, testInfo, { name: 'cart' });
  expect(blocking, `Blocking a11y violations:\n${formatBlockingMessage(blocking)}`).toHaveLength(0);
});

test('Checkout — signed in with one plant', { tag: '@a11y' }, async ({ page }, testInfo) => {
  await signInFirstCustomer(page);
  await page.goto('/plants/pl-monstera');
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible();
  const { blocking } = await scanPage(page, testInfo, { name: 'checkout' });
  expect(blocking, `Blocking a11y violations:\n${formatBlockingMessage(blocking)}`).toHaveLength(0);
});
