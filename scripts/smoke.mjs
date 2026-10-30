const api = process.env.API_URL ?? 'http://localhost:8100';
let token = '';

async function call(method, path, body, expected = 200) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  console.log(`${response.status === expected ? 'ok  ' : 'FAIL'} ${method} ${path} -> ${response.status}`);
  if (response.status !== expected) {
    console.log(JSON.stringify(data, null, 2));
    process.exit(1);
  }
  return data;
}

await call('POST', '/api/admin/reset');
await call('GET', '/api/health');
const page = await call('GET', '/api/plants?sort=name');
const plant = page.items.find((item) => item.stock > 2);
await call('GET', `/api/plants/${plant.id}`);
const login = await call('POST', '/api/auth/login', { email: 'ava@fernly.test', password: 'Fernly-Ava-2026' });
token = login.token;
await call('POST', '/api/cart/lines', { plantId: plant.id, size: 'S', quantity: 2 });
const cart = await call('GET', '/api/cart');
const order = await call(
  'POST',
  '/api/orders',
  { shippingAddress: { fullName: 'Ava Green', address: '1 Fern Street', city: 'Toronto', postalCode: 'M5V 1A1' } },
  201,
);
await call('GET', `/api/orders/${order.id}`);
const orders = await call('GET', '/api/orders');

console.log(`\nHappy path passed: ${cart.itemCount} × ${plant.name}, order ${order.id} for ${order.total}, ${orders.length} order(s).`);
