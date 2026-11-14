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

async function signIn(page: Page): Promise<void> {
  const { email, password } = creds();
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test('R9 Plant page Reviews axe scan signed out and signed in', { tag: '@a11y' }, async ({
  page,
}, testInfo) => {
  const reviewsSection = 'section[aria-labelledby="reviews-title"]';

  // Signed out — Reviews loaded on a seeded plant
  await page.goto('/plants/pl-monstera');
  await expect(page.getByRole('heading', { level: 2, name: 'Reviews' })).toBeVisible();
  await expect(page.getByText(/out of 5 · \d+ reviews?/)).toBeVisible();
  const signedOut = await scanPage(page, testInfo, {
    name: 'plant-reviews-signed-out',
    include: reviewsSection,
  });
  expect(
    signedOut.blocking,
    `Blocking a11y violations (signed out):\n${formatBlockingMessage(signedOut.blocking)}`,
  ).toHaveLength(0);

  // Signed in — Write a review form visible
  await signIn(page);
  await page.goto('/plants/pl-monstera');
  await expect(page.getByRole('heading', { name: 'Write a review' })).toBeVisible();
  await expect(page.getByLabel('Your review')).toBeVisible();
  const signedIn = await scanPage(page, testInfo, {
    name: 'plant-reviews-signed-in',
    include: reviewsSection,
  });
  expect(
    signedIn.blocking,
    `Blocking a11y violations (signed in):\n${formatBlockingMessage(signedIn.blocking)}`,
  ).toHaveLength(0);
});
