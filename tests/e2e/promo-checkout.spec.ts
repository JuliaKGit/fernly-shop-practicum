import { expect, test } from '@playwright/test';
import { CartPage } from '../pages/CartPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { LoginPage } from '../pages/LoginPage';
import { OrderPage } from '../pages/OrderPage';
import { PlantPage } from '../pages/PlantPage';

function creds(): { email: string; password: string } {
  const email = process.env.FERNLY_USER_EMAIL;
  const password = process.env.FERNLY_USER_PASSWORD;
  if (!email?.length || !password?.length) {
    throw new Error('FERNLY_USER_EMAIL and FERNLY_USER_PASSWORD must be set');
  }
  return { email, password };
}

test('P12: cart promo → checkout → order keeps discount; refusals still allow checkout', {
  tag: '@e2e',
}, async ({ page }) => {
  const { email, password } = creds();
  const login = await new LoginPage(page).goto();
  await login.signIn(email, password);
  await expect(page).not.toHaveURL(/\/login/);

  const plant = await new PlantPage(page).goto('pl-snake');
  await expect(plant.addToCartButton).toBeEnabled();
  await plant.addToCart();

  const cart = await new CartPage(page).goto();
  await expect(cart.heading).toBeVisible();

  // Negative: unknown / expired refused
  await cart.applyPromo('NOTAREALCODE');
  await expect(page.getByText(/recogniz|don't recognize/i)).toBeVisible();
  await expect(cart.discountRow()).toHaveCount(0);

  await cart.applyPromo('SPRING5');
  await expect(page.getByText(/expir/i)).toBeVisible();
  await expect(cart.discountRow()).toHaveCount(0);

  // Positive: LEAFY10 — 10% of $22 plants only
  await cart.applyPromo('LEAFY10');
  await expect(page.getByText('Discount (LEAFY10)')).toBeVisible();
  await expect(page.getByText('−$2.20')).toBeVisible();
  await expect(page.getByText('$26.75')).toBeVisible();

  await cart.checkoutLink.click();
  const checkout = new CheckoutPage(page);
  await expect(checkout.heading).toBeVisible();
  await expect(page.getByText('Discount (LEAFY10)')).toBeVisible();
  await expect(page.getByText('$26.75')).toBeVisible();

  await checkout.fillShipping({
    fullName: 'Ava Green',
    address: '1 Fern Lane',
    city: 'Portland',
    postalCode: '97201',
  });
  await checkout.placeOrder();

  const order = new OrderPage(page);
  await expect(page).toHaveURL(/\/orders\/.+\?placed=1/);
  await expect(order.paidHeading).toBeVisible();
  await expect(page.getByText('Discount (LEAFY10)')).toBeVisible();
  await expect(page.getByText('$26.75')).toBeVisible();

  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
});
