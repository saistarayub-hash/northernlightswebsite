import crypto from 'node:crypto';
import { sampleProducts } from '../src/merch-data.js';

const allowedArt = { apparel: ['tee', 'hoodie'], prints: ['print'], stickers: ['stickers'] };
export function validateProduct(value) {
  if (!value || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 90) return false;
  if (typeof value.description !== 'string' || !value.description.trim() || value.description.length > 1600) return false;
  if (!Object.hasOwn(allowedArt, value.category) || !allowedArt[value.category].includes(value.art)) return false;
  if (!Number.isSafeInteger(value.priceCents) || value.priceCents < 100 || value.priceCents > 1000000 || typeof value.hidden !== 'boolean') return false;
  if (!Array.isArray(value.variants) || !value.variants.length || value.variants.length > 12) return false;
  const labels = new Set();
  for (const variant of value.variants) {
    if (!variant || typeof variant.label !== 'string' || !variant.label.trim() || variant.label.length > 40 || labels.has(variant.label.trim().toLowerCase()) || !Number.isInteger(variant.stock) || variant.stock < 0 || variant.stock > 100000) return false;
    labels.add(variant.label.trim().toLowerCase());
  }
  return true;
}
export function mountMerch(app, { store, demo, auth, audit }) {
  if (!store.get().merch) store.update(state => { state.merch = { products: demo ? structuredClone(sampleProducts) : [], orders: [] }; });
  function customer(req, res, next) {
    if (req.user.role !== 'customer') return res.status(403).json({ error: 'Use a customer account for merchandise checkout and order history.' });
    next();
  }
  function demoOnly(req, res, next) {
    if (!demo) return res.status(503).json({ error: 'Real checkout is not enabled. Payment processing and fulfilment must be configured first.' });
    next();
  }
  app.get('/api/shop/catalog', (req, res) => res.json({ demo, checkoutEnabled: demo, products: store.get().merch.products.filter(product => !product.hidden) }));
  app.get('/api/shop/orders', auth, customer, (req, res) => res.json({ orders: store.get().merch.orders.filter(order => order.customerId === req.user.id).map(({ customerId, requestKey, fingerprint, ...order }) => order) }));
  app.post('/api/shop/checkout', demoOnly, auth, customer, (req, res) => {
    const { items, requestKey, expectedTotalCents } = req.body || {};
    if (typeof requestKey !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(requestKey) || !Array.isArray(items) || !items.length || items.length > 20 || !Number.isSafeInteger(expectedTotalCents)) return res.status(400).json({ error: 'Check the cart before trying again.' });
    const combined = new Map();
    for (const item of items) {
      if (!item || typeof item.productId !== 'string' || typeof item.variant !== 'string' || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) return res.status(400).json({ error: 'Choose a valid item, option, and quantity from 1 to 10.' });
      const key = JSON.stringify([item.productId, item.variant]);
      const quantity = (combined.get(key)?.quantity || 0) + item.quantity;
      if (quantity > 10) return res.status(400).json({ error: 'The demo allows at most 10 of each item.' });
      combined.set(key, { productId: item.productId, variant: item.variant, quantity });
    }
    const normalized = [...combined.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify({ items: normalized, expectedTotalCents })).digest('hex');
    const existing = store.get().merch.orders.find(order => order.customerId === req.user.id && order.requestKey === requestKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) return res.status(409).json({ error: 'This checkout attempt belongs to a different cart. Start a new checkout.' });
      return res.json({ order: { id: existing.id, totalCents: existing.totalCents, status: existing.status, demo: true } });
    }
    const products = store.get().merch.products;
    const lines = [];
    for (const item of normalized) {
      const product = products.find(product => product.id === item.productId && !product.hidden);
      const variant = product?.variants.find(variant => variant.label === item.variant);
      if (!product || !variant || variant.stock < item.quantity) return res.status(409).json({ error: 'An item is hidden, unavailable, or has insufficient stock. Refresh the cart.' });
      lines.push({ productId: product.id, name: product.name, art: product.art, variant: variant.label, quantity: item.quantity, unitPriceCents: product.priceCents });
    }
    const totalCents = lines.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
    if (totalCents !== expectedTotalCents) return res.status(409).json({ error: 'Prices changed. Refresh the cart and review the new total.' });
    const order = { id: `NL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, customerId: req.user.id, customerName: req.user.name, createdAt: new Date().toISOString(), items: lines, totalCents, status: 'demo_pending', revision: 1, demo: true, requestKey, fingerprint };
    store.update(state => {
      for (const line of lines) {
        const product = state.merch.products.find(product => product.id === line.productId);
        product.variants.find(variant => variant.label === line.variant).stock -= line.quantity;
        product.revision++;
      }
      state.merch.orders.unshift(order);
      audit(state, req.user, `Placed demo merchandise order ${order.id}`);
    });
    res.status(201).json({ order: { id: order.id, totalCents, status: order.status, demo: true } });
  });
  // /api/admin is protected by the staff/owner guard installed by the main server.
  app.get('/api/admin/merch', (req, res) => res.json({ demo, products: store.get().merch.products, orders: store.get().merch.orders.map(({ customerId, requestKey, fingerprint, ...order }) => order) }));
  app.post('/api/admin/merch/products', (req, res) => {
    if (!validateProduct(req.body?.product)) return res.status(400).json({ error: 'Check name, description, merchandise category, price, and stock options.' });
    if (store.get().merch.products.length >= 100) return res.status(400).json({ error: 'This prototype supports up to 100 merchandise products.' });
    const value = req.body.product;
    const product = cleanProduct(value, crypto.randomUUID(), 1);
    store.update(state => { state.merch.products.push(product); audit(state, req.user, `Added merchandise: ${product.name}`); });
    res.status(201).json({ product });
  });
  app.put('/api/admin/merch/products/:id', (req, res) => {
    const current = store.get().merch.products.find(product => product.id === req.params.id);
    if (!current) return res.status(404).json({ error: 'Product not found.' });
    if (req.body?.revision !== current.revision) return res.status(409).json({ error: 'This item changed, possibly after an order. Reload before editing stock or price.' });
    if (!validateProduct(req.body?.product)) return res.status(400).json({ error: 'Check name, description, merchandise category, price, and stock options.' });
    // Preserve variant identities used by orders so cancellation can restore their stock.
    const value = req.body.product;
    const orderedOptions = new Set(store.get().merch.orders.filter(order => order.status !== 'cancelled').flatMap(order => order.items.filter(item => item.productId === current.id).map(item => item.variant)));
    if ([...orderedOptions].some(label => !value.variants.some(variant => variant.label.trim() === label))) return res.status(409).json({ error: 'Keep options referenced by existing orders. Set their stock to zero instead of renaming/removing them.' });
    const product = cleanProduct(value, current.id, current.revision + 1);
    store.update(state => { state.merch.products[state.merch.products.findIndex(product => product.id === current.id)] = product; audit(state, req.user, `${product.hidden ? 'Saved / hid' : 'Updated'} merchandise: ${product.name}`); });
    res.json({ product });
  });
  app.patch('/api/admin/merch/orders/:id', demoOnly, (req, res) => {
    const current = store.get().merch.orders.find(order => order.id === req.params.id);
    if (!current) return res.status(404).json({ error: 'Order not found.' });
    if (req.body?.revision !== current.revision) return res.status(409).json({ error: 'This order changed. Reload the order list.' });
    const transitions = { demo_pending: ['demo_packed', 'cancelled'], demo_packed: ['demo_complete', 'cancelled'], demo_complete: [], cancelled: [] };
    if (!transitions[current.status]?.includes(req.body.status)) return res.status(400).json({ error: 'That order status change is not allowed.' });
    const result = store.update(state => {
      const order = state.merch.orders.find(order => order.id === current.id);
      if (req.body.status === 'cancelled') for (const item of order.items) {
        const product = state.merch.products.find(product => product.id === item.productId);
        product.variants.find(variant => variant.label === item.variant).stock += item.quantity;
        product.revision++;
      }
      order.status = req.body.status; order.revision++;
      audit(state, req.user, `${order.status}: ${order.id}`);
    });
    const { customerId, requestKey, fingerprint, ...order } = result.merch.orders.find(order => order.id === current.id);
    res.json({ order });
  });
}
function cleanProduct(value, id, revision) {
  return { id, revision, name: value.name.trim(), description: value.description.trim(), category: value.category, art: value.art, priceCents: value.priceCents, hidden: value.hidden, variants: value.variants.map(variant => ({ label: variant.label.trim(), stock: variant.stock })) };
}
