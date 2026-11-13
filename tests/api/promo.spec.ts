import { expect, test, type APIRequestContext } from '@playwright/test';
import { expectSchema } from '../helpers/schema';

const SHIPPING = 6.95;

type CartBody = {
  subtotal: number;
  discount: number;
  promoCode: string | null;
  shipping: number;
  total: number;
  lines: unknown[];
};

async function registerFreshUser(request: APIRequestContext): Promise<string> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await request.post('/api/auth/register', {
    data: {
      name: `Promo Tester ${suffix}`,
      email: `promo-${suffix}@fernly.test`,
      password: 'Promo-Test-2026',
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  const body = (await res.json()) as { token: string };
  return body.token;
}

function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

async function addPlant(
  request: APIRequestContext,
  token: string,
  plantId: string,
  quantity = 1,
): Promise<CartBody> {
  const res = await request.post('/api/cart/lines', {
    headers: auth(token),
    data: { plantId, size: 'S', quantity },
  });
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()) as CartBody;
}

async function clearCart(request: APIRequestContext, token: string): Promise<void> {
  const res = await request.get('/api/cart', { headers: auth(token) });
  expect(res.status()).toBe(200);
  const cart = (await res.json()) as CartBody;
  for (const line of cart.lines as Array<{ id: string }>) {
    const del = await request.delete(`/api/cart/lines/${line.id}`, { headers: auth(token) });
    expect(del.status()).toBe(200);
  }
}

async function applyPromo(
  request: APIRequestContext,
  token: string,
  code: string,
): Promise<{ status: number; body: CartBody & { detail?: string; rule?: string } }> {
  const res = await request.post('/api/cart/promo', {
    headers: auth(token),
    data: { code },
  });
  return { status: res.status(), body: (await res.json()) as CartBody & { detail?: string; rule?: string } };
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

test('P01: LEAFY10 takes 10% off plant subtotal only, never shipping', { tag: '@api' }, async ({
  request,
}) => {
  const token = await registerFreshUser(request);

  // Positive: under $50 — Snake Plant $22
  const under = await addPlant(request, token, 'pl-snake');
  expect(under.subtotal).toBe(22);
  expect(under.shipping).toBe(SHIPPING);

  const leafyUnder = await applyPromo(request, token, 'LEAFY10');
  expect(leafyUnder.status).toBe(200);
  await expectSchema(request, leafyUnder.body, 'Cart');
  expect(leafyUnder.body.promoCode).toBe('LEAFY10');
  expect(leafyUnder.body.discount).toBe(roundCents(under.subtotal * 0.1));
  expect(leafyUnder.body.shipping).toBe(SHIPPING);
  expect(leafyUnder.body.total).toBe(
    roundCents(under.subtotal - leafyUnder.body.discount + SHIPPING),
  );
  // Discount must not be 10% of subtotal+shipping
  expect(leafyUnder.body.discount).not.toBe(roundCents((under.subtotal + SHIPPING) * 0.1));

  await clearCart(request, token);

  // Edge: cent rounding — Monstera $34.99 → 10% = $3.499 → $3.50
  const odd = await addPlant(request, token, 'pl-monstera');
  expect(odd.subtotal).toBe(34.99);
  const leafyOdd = await applyPromo(request, token, 'LEAFY10');
  expect(leafyOdd.status).toBe(200);
  expect(leafyOdd.body.discount).toBe(3.5);
  expect(leafyOdd.body.shipping).toBe(SHIPPING);
  expect(leafyOdd.body.total).toBe(roundCents(34.99 - 3.5 + SHIPPING));

  await clearCart(request, token);

  // Edge: already free-shipping by $50+ subtotal (3× Snake Plant = $66)
  const freeShipCart = await addPlant(request, token, 'pl-snake', 3);
  expect(freeShipCart.subtotal).toBe(66);
  expect(freeShipCart.shipping).toBe(0);

  const leafyFree = await applyPromo(request, token, 'LEAFY10');
  expect(leafyFree.status).toBe(200);
  expect(leafyFree.body.discount).toBe(roundCents(66 * 0.1));
  expect(leafyFree.body.shipping).toBe(0);
  expect(leafyFree.body.total).toBe(roundCents(66 - leafyFree.body.discount));
});

test('P02: FREESHIP makes shipping $0 with no plant discount', { tag: '@api' }, async ({
  request,
}) => {
  const token = await registerFreshUser(request);

  const under = await addPlant(request, token, 'pl-snake');
  expect(under.shipping).toBe(SHIPPING);

  const free = await applyPromo(request, token, 'FREESHIP');
  expect(free.status).toBe(200);
  await expectSchema(request, free.body, 'Cart');
  expect(free.body.promoCode).toBe('FREESHIP');
  expect(free.body.discount).toBe(0);
  expect(free.body.shipping).toBe(0);
  expect(free.body.total).toBe(under.subtotal);

  await clearCart(request, token);

  const over = await addPlant(request, token, 'pl-snake', 3);
  expect(over.subtotal).toBe(66);
  expect(over.shipping).toBe(0);

  const freeOver = await applyPromo(request, token, 'FREESHIP');
  expect(freeOver.status).toBe(200);
  expect(freeOver.body.shipping).toBe(0);
  expect(freeOver.body.discount).toBe(0);
  expect(freeOver.body.promoCode).toBe('FREESHIP');
  expect(freeOver.body.total).toBe(66);
});

test('P03: free shipping from $50 uses subtotal before the percent discount', { tag: '@api' }, async ({
  request,
}) => {
  const token = await registerFreshUser(request);

  // Just over $50: Rubber $29.99 + Parlor Palm $24 = $53.99; after 10% ≈ $48.59
  await addPlant(request, token, 'pl-rubber');
  const over = await addPlant(request, token, 'pl-parlor');
  expect(over.subtotal).toBe(53.99);
  expect(over.shipping).toBe(0);

  const leafyOver = await applyPromo(request, token, 'LEAFY10');
  expect(leafyOver.status).toBe(200);
  expect(leafyOver.body.discount).toBe(5.4);
  expect(leafyOver.body.shipping).toBe(0);
  expect(leafyOver.body.total).toBe(48.59);

  await clearCart(request, token);

  // Just under $50: Fiddle Leaf Fig $49
  const under = await addPlant(request, token, 'pl-fiddle');
  expect(under.subtotal).toBe(49);
  expect(under.shipping).toBe(SHIPPING);

  const leafyUnder = await applyPromo(request, token, 'LEAFY10');
  expect(leafyUnder.status).toBe(200);
  expect(leafyUnder.body.discount).toBe(4.9);
  expect(leafyUnder.body.shipping).toBe(SHIPPING);
  expect(leafyUnder.body.total).toBe(roundCents(49 - 4.9 + SHIPPING));
});

test('P04: apply and remove promo require a signed-in customer', { tag: '@api' }, async ({
  request,
}) => {
  const post = await request.post('/api/cart/promo', { data: { code: 'LEAFY10' } });
  expect(post.status()).toBe(401);
  const postBody = (await post.json()) as { rule?: string };
  expect(postBody.rule).toBe('auth_required');

  const del = await request.delete('/api/cart/promo');
  expect(del.status()).toBe(401);
  const delBody = (await del.json()) as { rule?: string };
  expect(delBody.rule).toBe('auth_required');
});

test('P05: unknown, expired, empty cart, and empty code are refused', { tag: '@api' }, async ({
  request,
}) => {
  const token = await registerFreshUser(request);

  // Empty cart
  const empty = await applyPromo(request, token, 'LEAFY10');
  expect(empty.status).toBe(400);
  expect(empty.body.rule).toBe('empty_cart');

  const cart = await addPlant(request, token, 'pl-snake');
  expect(cart.promoCode).toBeNull();
  expect(cart.discount).toBe(0);

  const unknown = await applyPromo(request, token, 'NOTAREALCODE');
  expect(unknown.status).toBe(400);
  expect(unknown.body.rule).toBe('promo_invalid');
  expect(unknown.body.detail).toMatch(/recogniz/i);

  const afterUnknown = await request.get('/api/cart', { headers: auth(token) });
  const afterUnknownBody = (await afterUnknown.json()) as CartBody;
  expect(afterUnknownBody.promoCode).toBeNull();
  expect(afterUnknownBody.discount).toBe(0);

  const expired = await applyPromo(request, token, 'SPRING5');
  expect(expired.status).toBe(400);
  expect(expired.body.rule).toBe('promo_invalid');
  expect(expired.body.detail ?? '').toMatch(/expir/i);

  const afterExpired = await request.get('/api/cart', { headers: auth(token) });
  const afterExpiredBody = (await afterExpired.json()) as CartBody;
  expect(afterExpiredBody.promoCode).toBeNull();
  expect(afterExpiredBody.discount).toBe(0);

  const blank = await applyPromo(request, token, '');
  expect(blank.status).toBe(400);
  expect(blank.body.rule).toBe('validation_error');

  const afterBlank = await request.get('/api/cart', { headers: auth(token) });
  const afterBlankBody = (await afterBlank.json()) as CartBody;
  expect(afterBlankBody.promoCode).toBeNull();
  expect(afterBlankBody.discount).toBe(0);
});

test('P06: codes are case-insensitive; replace and DELETE clear correctly', { tag: '@api' }, async ({
  request,
}) => {
  const token = await registerFreshUser(request);
  const cart = await addPlant(request, token, 'pl-snake');
  expect(cart.shipping).toBe(SHIPPING);

  const lower = await applyPromo(request, token, 'leafy10');
  expect(lower.status).toBe(200);
  expect(lower.body.promoCode).toBe('LEAFY10');
  expect(lower.body.discount).toBe(roundCents(cart.subtotal * 0.1));

  const replaced = await applyPromo(request, token, 'FREESHIP');
  expect(replaced.status).toBe(200);
  expect(replaced.body.promoCode).toBe('FREESHIP');
  expect(replaced.body.discount).toBe(0);
  expect(replaced.body.shipping).toBe(0);
  expect(replaced.body.total).toBe(cart.subtotal);

  const cleared = await request.delete('/api/cart/promo', { headers: auth(token) });
  expect(cleared.status()).toBe(200);
  const clearedBody = (await cleared.json()) as CartBody;
  await expectSchema(request, clearedBody, 'Cart');
  expect(clearedBody.promoCode).toBeNull();
  expect(clearedBody.discount).toBe(0);
  expect(clearedBody.shipping).toBe(SHIPPING);
});

test('P07: placing an order keeps promo on the order and clears the cart', { tag: '@api' }, async ({
  request,
}) => {
  const token = await registerFreshUser(request);
  const cart = await addPlant(request, token, 'pl-snake');
  const promo = await applyPromo(request, token, 'LEAFY10');
  expect(promo.status).toBe(200);
  const expectedDiscount = roundCents(cart.subtotal * 0.1);
  expect(promo.body.discount).toBe(expectedDiscount);
  expect(promo.body.promoCode).toBe('LEAFY10');

  const orderRes = await request.post('/api/orders', {
    headers: auth(token),
    data: {
      shippingAddress: {
        fullName: 'Ava Green',
        address: '1 Fern Lane',
        city: 'Portland',
        postalCode: '97201',
      },
    },
  });
  expect(orderRes.status()).toBe(201);
  const order = (await orderRes.json()) as CartBody & { id: string };
  await expectSchema(request, order, 'Order');
  expect(order.promoCode).toBe('LEAFY10');
  expect(order.discount).toBe(expectedDiscount);
  expect(order.subtotal).toBe(promo.body.subtotal);
  expect(order.shipping).toBe(promo.body.shipping);
  expect(order.total).toBe(promo.body.total);

  const emptyCartRes = await request.get('/api/cart', { headers: auth(token) });
  expect(emptyCartRes.status()).toBe(200);
  const emptyCart = (await emptyCartRes.json()) as CartBody;
  await expectSchema(request, emptyCart, 'Cart');
  expect(emptyCart.lines).toEqual([]);
  expect(emptyCart.promoCode).toBeNull();
  expect(emptyCart.discount).toBe(0);
});
