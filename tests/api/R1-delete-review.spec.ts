import { expect, test, type APIRequestContext } from '@playwright/test';

async function login(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const res = await request.post('/api/auth/login', { data: { email, password } });
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { token: string };
  return body.token;
}

test('R1 DELETE /api/reviews/{reviewId} — author-only delete', { tag: '@api' }, async ({
  request,
}) => {
  const benEmail = process.env.FERNLY_ALT_USER_EMAIL!;
  const benPassword = process.env.FERNLY_ALT_USER_PASSWORD!;
  const avaEmail = process.env.FERNLY_USER_EMAIL!;
  const avaPassword = process.env.FERNLY_USER_PASSWORD!;

  const benToken = await login(request, benEmail, benPassword);
  const avaToken = await login(request, avaEmail, avaPassword);

  // + author deletes own review → 204; subsequent GET no longer lists it
  const create = await request.post('/api/plants/pl-zz/reviews', {
    headers: { Authorization: `Bearer ${benToken}` },
    data: { rating: 4, text: 'Glossy leaves and easy care for my office.' },
  });
  expect(create.status()).toBe(201);
  const created = (await create.json()) as { id: string };
  const reviewId = created.id;

  const del = await request.delete(`/api/reviews/${reviewId}`, {
    headers: { Authorization: `Bearer ${benToken}` },
  });
  expect(del.status()).toBe(204);

  const after = await request.get('/api/plants/pl-zz/reviews');
  expect(after.status()).toBe(200);
  const list = (await after.json()) as { reviews: Array<{ id: string }> };
  expect(list.reviews.map((r) => r.id)).not.toContain(reviewId);

  // − signed-out → 401 auth_required
  const signedOut = await request.delete(`/api/reviews/${reviewId}`);
  expect(signedOut.status()).toBe(401);
  const signedOutBody = (await signedOut.json()) as { rule?: string };
  expect(signedOutBody.rule).toBe('auth_required');

  // − other signed-in customer → 404 (not their review)
  const otherPlant = await request.post('/api/plants/pl-aloe/reviews', {
    headers: { Authorization: `Bearer ${benToken}` },
    data: { rating: 5, text: 'Sun-loving and simple — perfect windowsill plant.' },
  });
  expect(otherPlant.status()).toBe(201);
  const bensReview = (await otherPlant.json()) as { id: string };

  const otherUser = await request.delete(`/api/reviews/${bensReview.id}`, {
    headers: { Authorization: `Bearer ${avaToken}` },
  });
  expect(otherUser.status()).toBe(404);
  const otherBody = (await otherUser.json()) as { detail?: string };
  expect(otherBody.detail?.toLowerCase()).toMatch(/not found/);

  // edge unknown reviewId → 404
  const unknown = await request.delete('/api/reviews/rv-does-not-exist', {
    headers: { Authorization: `Bearer ${avaToken}` },
  });
  expect(unknown.status()).toBe(404);
});
