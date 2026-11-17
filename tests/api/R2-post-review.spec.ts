import { expect, test, type APIRequestContext } from '@playwright/test';
import { expectSchema } from '../helpers/schema';

async function login(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<{ token: string; name: string }> {
  const res = await request.post('/api/auth/login', { data: { email, password } });
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { token: string; user: { name: string } };
  return { token: body.token, name: body.user.name };
}

test('R2 POST /api/plants/{plantId}/reviews — create with auth and validation', { tag: '@api' }, async ({
  request,
}) => {
  const ava = await login(
    request,
    process.env.FERNLY_USER_EMAIL!,
    process.env.FERNLY_USER_PASSWORD!,
  );
  const ben = await login(
    request,
    process.env.FERNLY_ALT_USER_EMAIL!,
    process.env.FERNLY_ALT_USER_PASSWORD!,
  );

  // + signed-in user posts valid review → 201 Review schema; author = user name
  const created = await request.post('/api/plants/pl-zz/reviews', {
    headers: { Authorization: `Bearer ${ava.token}` },
    data: { rating: 5, text: '  Thriving in a shady corner of my flat.  ' },
  });
  expect(created.status()).toBe(201);
  const body = (await created.json()) as { author: string; rating: number; text: string };
  await expectSchema(request, body, 'Review');
  expect(body.author).toBe(ava.name);
  expect(body.rating).toBe(5);
  expect(body.text).toBe('Thriving in a shady corner of my flat.');

  // − no auth → 401 auth_required
  const noAuth = await request.post('/api/plants/pl-zz/reviews', {
    data: { rating: 4, text: 'Should not be accepted without a session.' },
  });
  expect(noAuth.status()).toBe(401);
  expect(((await noAuth.json()) as { rule?: string }).rule).toBe('auth_required');

  // − second review same user+plant → 409 already_reviewed (seed: Ben / pl-snake)
  const duplicate = await request.post('/api/plants/pl-snake/reviews', {
    headers: { Authorization: `Bearer ${ben.token}` },
    data: { rating: 3, text: 'Trying to post a second Snake Plant review.' },
  });
  expect(duplicate.status()).toBe(409);
  expect(((await duplicate.json()) as { rule?: string }).rule).toBe('already_reviewed');

  // − rating outside 1–5 or non-int → 400
  const badRating = await request.post('/api/plants/pl-rubber/reviews', {
    headers: { Authorization: `Bearer ${ava.token}` },
    data: { rating: 6, text: 'Rating six should be rejected by validation.' },
  });
  expect(badRating.status()).toBe(400);
  expect(((await badRating.json()) as { rule?: string }).rule).toBe('validation_error');

  const nonInt = await request.post('/api/plants/pl-rubber/reviews', {
    headers: { Authorization: `Bearer ${ava.token}` },
    data: { rating: 3.5, text: 'Non-integer rating should be rejected too.' },
  });
  expect(nonInt.status()).toBe(400);
  expect(((await nonInt.json()) as { rule?: string }).rule).toBe('validation_error');

  // − text <10 or >500 (after trim) → 400
  const shortText = await request.post('/api/plants/pl-rubber/reviews', {
    headers: { Authorization: `Bearer ${ava.token}` },
    data: { rating: 4, text: 'too short' },
  });
  expect(shortText.status()).toBe(400);
  expect(((await shortText.json()) as { rule?: string }).rule).toBe('validation_error');

  const longText = await request.post('/api/plants/pl-rubber/reviews', {
    headers: { Authorization: `Bearer ${ava.token}` },
    data: { rating: 4, text: 'x'.repeat(501) },
  });
  expect(longText.status()).toBe(400);
  expect(((await longText.json()) as { rule?: string }).rule).toBe('validation_error');

  // edge unknown plantId → 404
  const unknown = await request.post('/api/plants/pl-missing/reviews', {
    headers: { Authorization: `Bearer ${ava.token}` },
    data: { rating: 4, text: 'This plant id does not exist in the catalog.' },
  });
  expect(unknown.status()).toBe(404);
});
