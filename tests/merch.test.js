import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { launch } from './helpers.js';
import { validateProduct } from '../server/merch.js';
import { sampleProducts } from '../src/merch-data.js';

async function fixture(t, env = {}) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'nl-merch-'));
  const { child, url } = await launch(directory, env);
  t.after(async () => { await new Promise(resolve => { child.once('exit', resolve); child.kill(); }); rmSync(directory, { recursive: true, force: true }); });
  return async (route, { method = 'GET', body, cookie = '' } = {}) => {
    const response = await fetch(url + '/api' + route, { method, headers: { 'Content-Type': 'application/json', 'X-CMS-Request': '1', Cookie: cookie }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
}
test('merchandise catalog, customer isolation, and order lifecycle', async t => {
  const request = await fixture(t);
  let customer, otherCustomer, staff, product, order;
  const requestKey = 'test-checkout-request-0001';
  const items = [{ productId: 'after-dark-tee', variant: 'M', quantity: 2, unitPriceCents: 1 }];
  const checkout = { items, expectedTotalCents: 69800, requestKey };
  await t.test('public catalog contains only sample merchandise', async () => {
    const result = await request('/shop/catalog'); assert.equal(result.status, 200); assert.equal(result.body.products.length, 4); assert.equal(result.body.demo, true); product = result.body.products[0];
    assert.equal((await request('/admin/merch')).status, 401);
  });
  await t.test('customer registration validates input and cannot assign elevated roles', async () => {
    assert.equal((await request('/shop/register', { method: 'POST', body: { name: 'Test', email: 'bad', password: 'short' } })).status, 400);
    const result = await request('/shop/register', { method: 'POST', body: { name: 'Sample Guest', email: 'sample@example.com', password: 'UniqueTestPassword!1', role: 'owner' } });
    assert.equal(result.status, 201); assert.equal(result.body.user.role, 'customer'); customer = result.cookie;
    assert.equal((await request('/shop/register', { method: 'POST', body: { name: 'Sample Guest', email: 'SAMPLE@example.com', password: 'UniqueTestPassword!1' } })).status, 409);
  });
  await t.test('customers cannot reach any staff content or merchandise endpoint', async () => {
    for (const route of ['/admin/content', '/admin/merch']) assert.equal((await request(route, { cookie: customer })).status, 403);
    assert.equal((await request('/admin/draft', { method: 'PUT', cookie: customer, body: {} })).status, 403);
    assert.equal((await request('/admin/merch/products', { method: 'POST', cookie: customer, body: { product } })).status, 403);
  });
  await t.test('staff can manage merchandise but cannot use customer checkout', async () => {
    staff = (await request('/login', { method: 'POST', body: { email: 'staff@demo.local', password: 'NorthernDemo!Staff' } })).cookie;
    assert.equal((await request('/admin/merch', { cookie: staff })).status, 200);
    assert.equal((await request('/shop/checkout', { method: 'POST', cookie: staff, body: checkout })).status, 403);
    assert.equal((await request('/shop/checkout', { method: 'POST', body: checkout })).status, 401);
  });
  await t.test('hidden merchandise cannot be ordered, and staff can restore visibility', async () => {
    let result = await request(`/admin/merch/products/${product.id}`, { method: 'PUT', cookie: staff, body: { revision: product.revision, product: { ...product, hidden: true } } }); assert.equal(result.status, 200); product = result.body.product;
    assert.equal((await request('/shop/catalog')).body.products.length, 3);
    assert.equal((await request('/shop/checkout', { method: 'POST', cookie: customer, body: checkout })).status, 409);
    result = await request(`/admin/merch/products/${product.id}`, { method: 'PUT', cookie: staff, body: { revision: product.revision, product: { ...product, hidden: false } } }); product = result.body.product;
  });
  await t.test('invalid options, negative quantities, duplicate line limits, and stale totals fail', async () => {
    assert.equal((await request('/shop/checkout', { method: 'POST', cookie: customer, body: { ...checkout, items: [{ ...items[0], quantity: -1 }] } })).status, 400);
    assert.equal((await request('/shop/checkout', { method: 'POST', cookie: customer, body: { ...checkout, items: [{ ...items[0], variant: 'XX-invalid' }] } })).status, 409);
    assert.equal((await request('/shop/checkout', { method: 'POST', cookie: customer, body: { ...checkout, items: [{ ...items[0], quantity: 6 }, { ...items[0], quantity: 6 }] } })).status, 400);
    assert.equal((await request('/shop/checkout', { method: 'POST', cookie: customer, body: { ...checkout, expectedTotalCents: 1 } })).status, 409);
  });
  await t.test('server prices are authoritative and stock is decremented once', async () => {
    const result = await request('/shop/checkout', { method: 'POST', cookie: customer, body: checkout }); assert.equal(result.status, 201); assert.equal(result.body.order.totalCents, 69800); order = result.body.order;
    const catalog = (await request('/shop/catalog')).body.products; assert.equal(catalog.find(product => product.id === 'after-dark-tee').variants.find(variant => variant.label === 'M').stock, 10);
    const repeat = await request('/shop/checkout', { method: 'POST', cookie: customer, body: checkout }); assert.equal(repeat.status, 200); assert.equal(repeat.body.order.id, order.id);
    assert.equal((await request('/shop/orders', { cookie: customer })).body.orders.length, 1);
    assert.equal((await request('/shop/checkout', { method: 'POST', cookie: customer, body: { ...checkout, items: [{ ...items[0], quantity: 1 }] } })).status, 409);
  });
  await t.test('customer order history is scoped to its owner', async () => {
    otherCustomer = (await request('/shop/register', { method: 'POST', body: { name: 'Another Sample', email: 'another@example.com', password: 'UniqueTestPassword!2' } })).cookie;
    assert.equal((await request('/shop/orders', { cookie: otherCustomer })).body.orders.length, 0);
    const orders = (await request('/shop/orders', { cookie: customer })).body.orders; assert.equal(orders[0].items[0].unitPriceCents, 34900); assert.equal(orders[0].requestKey, undefined); assert.equal(orders[0].customerId, undefined);
  });
  await t.test('catalog revisions prevent stale stock overwrite after checkout', async () => {
    assert.equal((await request(`/admin/merch/products/${product.id}`, { method: 'PUT', cookie: staff, body: { revision: product.revision, product } })).status, 409);
    product = (await request('/admin/merch', { cookie: staff })).body.products.find(p => p.id === product.id);
    assert.equal((await request(`/admin/merch/products/${product.id}`, { method: 'PUT', cookie: staff, body: { revision: product.revision, product: { ...product, variants: product.variants.filter(v => v.label !== 'M') } } })).status, 409);
  });
  await t.test('orders can be packed, cancelled, and restocked only once', async () => {
    let result = await request(`/admin/merch/orders/${order.id}`, { method: 'PATCH', cookie: staff, body: { revision: 1, status: 'demo_packed' } }); assert.equal(result.status, 200); assert.equal(result.body.order.revision, 2);
    assert.equal((await request(`/admin/merch/orders/${order.id}`, { method: 'PATCH', cookie: staff, body: { revision: 1, status: 'cancelled' } })).status, 409);
    result = await request(`/admin/merch/orders/${order.id}`, { method: 'PATCH', cookie: staff, body: { revision: 2, status: 'cancelled' } }); assert.equal(result.status, 200);
    assert.equal((await request(`/admin/merch/orders/${order.id}`, { method: 'PATCH', cookie: staff, body: { revision: 3, status: 'cancelled' } })).status, 400);
    product = (await request('/admin/merch', { cookie: staff })).body.products.find(p => p.id === product.id); assert.equal(product.variants.find(v => v.label === 'M').stock, 12);
  });
  await t.test('staff can add merchandise with validated categories, prices, and options', async () => {
    assert.equal((await request('/admin/merch/products', { method: 'POST', cookie: staff, body: { product: { ...product, category: 'unsupported' } } })).status, 400);
    assert.equal((await request('/admin/merch/products', { method: 'POST', cookie: staff, body: { product: { ...product, priceCents: -1 } } })).status, 400);
    const result = await request('/admin/merch/products', { method: 'POST', cookie: staff, body: { product: { ...product, name: 'Another Shirt Concept', hidden: true } } }); assert.equal(result.status, 201); assert.notEqual(result.body.product.id, product.id);
  });
});
test('production has no sample inventory, customer registration, or payment/checkout', async t => {
  const request = await fixture(t, { NODE_ENV: 'production', CMS_DEMO: 'true', CMS_OWNER_EMAIL: 'owner@example.com', CMS_OWNER_PASSWORD: 'ProductionTestOnly!123' });
  const catalog = (await request('/shop/catalog')).body; assert.equal(catalog.demo, false); assert.equal(catalog.checkoutEnabled, false); assert.deepEqual(catalog.products, []);
  assert.equal((await request('/shop/register', { method: 'POST', body: {} })).status, 503);
  assert.equal((await request('/shop/checkout', { method: 'POST', body: {} })).status, 503);
});
test('merchandise validation rejects duplicate options and invalid art', () => {
  const product = structuredClone(sampleProducts[0]); product.variants.push({ label: 'm', stock: 1 }); assert.equal(validateProduct(product), false);
  product.variants.pop(); product.art = '../../private'; assert.equal(validateProduct(product), false);
});
