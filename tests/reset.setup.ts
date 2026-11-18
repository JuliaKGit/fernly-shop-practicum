import { expect, test as setup } from '@playwright/test';

setup('reset data to seed state', async ({ request }) => {
  const res = await request.post('/api/admin/reset');
  expect(res.status()).toBe(200);
});
