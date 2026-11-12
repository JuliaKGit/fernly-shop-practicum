import { expect, test } from '@playwright/test';
import { expectSchema } from '../helpers/schema';

const THAI_MONSTERA_NAME =
  "Variegated Thai Constellation Monstera (Collector's Edition, Limited Greenhouse Batch)";

test('a plant matches the Plant schema', { tag: '@api' }, async ({ request }) => {
  const res = await request.get('/api/plants/pl-snake');
  expect(res.status()).toBe(200);
  const body = await res.json();
  await expectSchema(request, body, 'Plant');
});

test('"price-desc" returns the most expensive first', { tag: '@api' }, async ({ request }) => {
  const res = await request.get('/api/plants?sort=price-desc');
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { items: Array<{ name: string; price: number }> };
  expect(body.items.length).toBeGreaterThan(1);

  const prices = body.items.map((plant) => plant.price);
  expect(body.items[0]?.price).toBe(Math.max(...prices));
  expect(body.items[0]?.name).toBe(THAI_MONSTERA_NAME);
});
