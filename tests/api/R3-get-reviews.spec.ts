import { expect, test } from '@playwright/test';
import { expectSchema } from '../helpers/schema';

test('R3 GET /api/plants/{plantId}/reviews — list, average, newest first', { tag: '@api' }, async ({
  request,
}) => {
  // + seeded plant → 200 ReviewList; count matches length; newest-first by createdAt
  const res = await request.get('/api/plants/pl-snake/reviews');
  expect(res.status()).toBe(200);
  const body = (await res.json()) as {
    plantId: string;
    average: number;
    count: number;
    reviews: Array<{ id: string; rating: number; createdAt: string }>;
  };
  await expectSchema(request, body, 'ReviewList');
  expect(body.plantId).toBe('pl-snake');
  expect(body.count).toBe(body.reviews.length);
  expect(body.reviews.length).toBeGreaterThan(0);

  for (let i = 0; i < body.reviews.length - 1; i++) {
    const newer = body.reviews[i]!.createdAt;
    const older = body.reviews[i + 1]!.createdAt;
    expect(newer >= older, `reviews newest-first: ${newer} before ${older}`).toBe(true);
  }

  // + average for ratings 5, 4, 5 → 4.7 (one decimal, halves up)
  expect(body.reviews.map((r) => r.rating).sort()).toEqual([4, 5, 5]);
  expect(body.average).toBe(4.7);

  // edge plant with no reviews → average 0, count 0, reviews []
  // pl-cutting has no seed reviews and is unused by other review write tests
  const empty = await request.get('/api/plants/pl-cutting/reviews');
  expect(empty.status()).toBe(200);
  const emptyBody = (await empty.json()) as {
    average: number;
    count: number;
    reviews: unknown[];
  };
  await expectSchema(request, emptyBody, 'ReviewList');
  expect(emptyBody.average).toBe(0);
  expect(emptyBody.count).toBe(0);
  expect(emptyBody.reviews).toEqual([]);

  // − unknown plant → 404
  const missing = await request.get('/api/plants/pl-missing/reviews');
  expect(missing.status()).toBe(404);
});
