import { sampleProducts, money, categories } from './merch-data.js';
const BASE = import.meta.env.BASE_URL;
const $ = selector => document.querySelector(selector);
const el = (tag, text, className) => { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element; };
const image = (product, className) => { const img = el('img', undefined, className); img.src = `${BASE}images/merch/${product.art}.svg`; img.alt = `${product.name} — illustrative merchandise concept`; img.width = 640; img.height = 740; img.loading = 'lazy'; return img; };
let products = [], connected = false, checkoutEnabled = false, user = null, category = 'all', registering = false, pendingCheckout = false, orderBusy = false;
let cart = [];
const CART_KEY = 'nl-merch-cart-v1';
const REQUEST_KEY = 'nl-merch-checkout-v1';
function storageGet(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function storageSet(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { notify('Browser storage is unavailable. Your bag will only last while this page is open.'); } }
let pendingRequest = storageGet(REQUEST_KEY);
const stored = storageGet(CART_KEY);
if (Array.isArray(stored)) {
  const seen = new Set();
  cart = stored.filter(item => {
    if (!item || typeof item.productId !== 'string' || typeof item.variant !== 'string' || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) return false;
    const key = JSON.stringify([item.productId, item.variant]); if (seen.has(key)) return false; seen.add(key); return true;
  }).slice(0, 20);
}
function notify(text, error = false, target = '#shop-message') { $(target).textContent = text; $(target).classList.toggle('error', error); }
async function api(route, method = 'GET', body) {
  const response = await fetch(`/api${route}`, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CMS-Request': '1' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The store backend is unavailable here. Use the live development preview for demo accounts and orders.');
  const result = await response.json();
  if (!response.ok) { if (response.status === 401) user = null; throw new Error(result.error || 'That request could not be completed.'); }
  return result;
}
function closeAll() { document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close()); }
function openDialog(id) { closeAll(); $(id).showModal(); }
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.close).close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
}));
function cartLines() { return cart.map(item => { const product = products.find(product => product.id === item.productId); const variant = product?.variants.find(variant => variant.label === item.variant); return { ...item, product, available: Boolean(product && variant && variant.stock >= item.quantity), stock: variant?.stock || 0 }; }); }
function total() { return cartLines().reduce((sum, item) => sum + (item.product?.priceCents || 0) * item.quantity, 0); }
function saveCart() { storageSet(CART_KEY, cart); renderCart(); }
function renderProducts() {
  const query = $('#product-search').value.trim().toLowerCase();
  let selected = products.filter(product => (category === 'all' || product.category === category) && `${product.name} ${product.description}`.toLowerCase().includes(query));
  const sort = $('#sort-products').value;
  if (sort === 'price-asc') selected.sort((a, b) => a.priceCents - b.priceCents);
  if (sort === 'price-desc') selected.sort((a, b) => b.priceCents - a.priceCents);
  if (sort === 'name') selected.sort((a, b) => a.name.localeCompare(b.name));
  const grid = $('#product-grid'); grid.replaceChildren();
  selected.forEach(product => {
    const card = el('article', undefined, 'product-card');
    const art = el('button', undefined, 'product-art'); art.type = 'button'; art.setAttribute('aria-label', `View ${product.name}`);
    const inStock = product.variants.some(variant => variant.stock > 0);
    art.append(image(product), el('span', inStock ? 'DESIGN CONCEPT' : 'SAMPLE STOCK EMPTY', 'product-badge'), el('span', '↗', 'product-arrow'));
    art.addEventListener('click', () => showProduct(product.id));
    const meta = el('div', undefined, 'product-meta'); meta.append(el('h3', product.name), el('span', money(product.priceCents)));
    const subline = el('div', undefined, 'product-subline'); subline.append(el('span', categories[product.category]), el('span', 'Sample price'));
    const add = el('button', undefined, 'quick-add'); add.append(el('span', product.variants.length > 1 ? 'Choose your size' : 'Explore this design'), el('span', '+'));
    add.addEventListener('click', () => showProduct(product.id));
    card.append(art, meta, subline, add); grid.append(card);
  });
  $('#results-count').textContent = `${selected.length} ${selected.length === 1 ? 'design' : 'designs'}`;
  if (!selected.length) grid.append(el('p', 'No designs match. Try another category or clear your search.', 'empty-results'));
}
function showProduct(id) {
  const product = products.find(product => product.id === id);
  if (!product) { notify('That design is no longer available.', true); return; }
  const grid = el('div', undefined, 'detail-grid'); const art = el('div', undefined, 'detail-art'); art.append(image(product));
  const copy = el('div', undefined, 'detail-copy');
  copy.append(el('p', `${categories[product.category].toUpperCase()} / ORIGINAL DESIGN STUDY`, 'shop-eyebrow'), el('h2', product.name), el('p', money(product.priceCents), 'detail-price'), el('p', product.description, 'detail-description'));
  const label = el('label', product.category === 'apparel' ? 'Choose your size' : 'Choose your option');
  const select = el('select'); select.id = 'detail-option';
  product.variants.forEach(variant => { const option = el('option', `${variant.label}${variant.stock ? '' : ' — sample stock empty'}`); option.value = variant.label; option.disabled = variant.stock === 0; select.append(option); });
  const first = product.variants.find(variant => variant.stock > 0); if (first) select.value = first.label;
  label.append(select); const availability = el('p', undefined, 'stock-note');
  const add = el('button', undefined, 'shop-primary'); add.id = 'detail-add'; add.append(el('span', 'Add to demo bag'), el('span', '+'));
  const feedback = el('p', undefined, 'detail-message'); feedback.setAttribute('role', 'status');
  function updateOption() { const option = product.variants.find(variant => variant.label === select.value); availability.textContent = option?.stock ? `${option.stock} in sample inventory · not real stock` : 'No sample stock available'; add.disabled = !option?.stock; }
  select.addEventListener('change', updateOption); updateOption();
  add.addEventListener('click', () => {
    const variant = product.variants.find(variant => variant.label === select.value);
    const existing = cart.find(item => item.productId === id && item.variant === select.value);
    if (!variant || (existing?.quantity || 0) + 1 > Math.min(variant.stock, 10)) { feedback.textContent = 'You’ve reached the available sample quantity or the 10-item limit.'; return; }
    if (!existing && cart.length >= 20) { feedback.textContent = 'The demo supports up to 20 bag lines.'; return; }
    if (existing) existing.quantity++; else cart.push({ productId: id, variant: variant.label, quantity: 1 });
    saveCart(); feedback.textContent = 'Added to your demo bag.';
    const view = el('button', 'View bag ↗', 'plain-button'); view.addEventListener('click', () => { renderCart(); openDialog('#cart-dialog'); }); feedback.append(view);
  });
  copy.append(label, availability, add, feedback, el('p', 'Sample pricing and artwork. Materials and fit are unconfirmed. No real order or payment.', 'product-details-readonly'));
  if (user && ['owner', 'staff'].includes(user.role)) {
    const edit = el('a', 'Staff shortcut: edit this design ↗', 'staff-product-shortcut');
    edit.href = `${BASE}merch-admin.html?edit=${encodeURIComponent(product.id)}`;
    copy.append(edit);
  }
  grid.append(art, copy); $('#product-details').replaceChildren(grid); openDialog('#product-dialog');
}
function renderCart() {
  $('#cart-count').textContent = String(cart.reduce((count, item) => count + item.quantity, 0));
  const parent = $('#cart-items'); parent.replaceChildren();
  cartLines().forEach(item => {
    const row = el('div', undefined, 'cart-line');
    if (item.product) row.append(image(item.product)); else row.append(el('div', '—', 'empty-cart'));
    const details = el('div'); details.append(el('h3', item.product?.name || 'Unavailable design'), el('small', item.variant), el('p', item.product ? money(item.product.priceCents * item.quantity) : 'Remove to continue', 'line-price'));
    if (!item.available) details.append(el('p', 'This quantity is unavailable. Reduce it or remove the item.', 'line-warning'));
    const quantity = el('div', undefined, 'quantity-control');
    const minus = el('button', '−'); minus.setAttribute('aria-label', `Decrease ${item.product?.name || 'item'} quantity`); minus.disabled = item.quantity <= 1;
    minus.addEventListener('click', () => { cart.find(line => line.productId === item.productId && line.variant === item.variant).quantity--; saveCart(); });
    const plus = el('button', '+'); plus.setAttribute('aria-label', `Increase ${item.product?.name || 'item'} quantity`); plus.disabled = item.quantity >= Math.min(item.stock, 10);
    plus.addEventListener('click', () => { cart.find(line => line.productId === item.productId && line.variant === item.variant).quantity++; saveCart(); });
    const remove = el('button', 'Remove', 'remove-item'); remove.setAttribute('aria-label', `Remove ${item.product?.name || 'unavailable item'} ${item.variant}`); remove.addEventListener('click', () => { cart = cart.filter(line => !(line.productId === item.productId && line.variant === item.variant)); saveCart(); });
    quantity.append(minus, el('span', String(item.quantity)), plus, remove); details.append(quantity); row.append(details); parent.append(row);
  });
  if (!cart.length) parent.append(el('p', 'Your bag is taking the night off. Explore the collection to add your first design.', 'empty-cart'));
  $('#cart-total').textContent = money(total());
  $('#checkout-button').disabled = !checkoutEnabled || !cart.length || cartLines().some(item => !item.available);
  $('#refresh-cart').disabled = !connected;
  if (!connected) notify('Catalog preview only. Demo checkout needs the connected store backend.', false, '#cart-message');
  else if (!checkoutEnabled) notify('Checkout is not enabled. No orders or payments can be submitted.', false, '#cart-message');
  else notify('Demo checkout is available. No payment details are collected.', false, '#cart-message');
}
async function refreshCatalog() {
  const result = await api('/shop/catalog'); products = result.products; checkoutEnabled = result.checkoutEnabled; connected = true; renderProducts(); renderCart();
}
$('#refresh-cart').addEventListener('click', async () => { try { await refreshCatalog(); notify('Availability and prices refreshed.', false, '#cart-message'); } catch (error) { notify(error.message, true, '#cart-message'); } });
$('#cart-button').addEventListener('click', () => { renderCart(); openDialog('#cart-dialog'); });
document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => {
  category = button.dataset.category; document.querySelectorAll('[data-category]').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', String(item === button)); }); renderProducts();
}));
$('#sort-products').addEventListener('change', renderProducts); $('#product-search').addEventListener('input', renderProducts);
function accountMode(register) {
  registering = register; $('#customer-name-label').hidden = !register; $('#customer-name').required = register;
  $('#customer-password').minLength = register ? 12 : 1; $('#customer-password').autocomplete = register ? 'new-password' : 'current-password';
  $('#sign-in-tab').classList.toggle('active', !register); $('#register-tab').classList.toggle('active', register); $('#sign-in-tab').setAttribute('aria-pressed', String(!register)); $('#register-tab').setAttribute('aria-pressed', String(register));
  $('#customer-submit').replaceChildren(el('span', register ? 'Create demo account' : 'Sign in'), el('span', '↗'));
}
$('#sign-in-tab').addEventListener('click', () => accountMode(false)); $('#register-tab').addEventListener('click', () => accountMode(true));
async function showAccount() {
  $('#account-guest').hidden = Boolean(user); $('#account-signed-in').hidden = !user;
  $('#customer-submit').disabled = !connected;
  notify(connected ? '' : 'Accounts require the local backend. This static preview is browse-only.', !connected, '#account-message');
  if (user) {
    $('#customer-greeting').textContent = `Hi, ${user.name}.`;
    $('#customer-role-note').textContent = user.role === 'customer' ? 'Sample customer account · demo orders only.' : `You’re signed in as ${user.role}. Use a separate sample customer account to test checkout.`;
    $('#customer-orders').replaceChildren(el('p', 'Loading…'));
  }
  openDialog('#account-dialog');
  if (user?.role === 'customer') {
    try { const result = await api('/shop/orders'); renderOrders(result.orders); } catch (error) { $('#customer-orders').replaceChildren(el('p', error.message)); }
  } else if (user) $('#customer-orders').replaceChildren(el('p', 'Customer order history is not available for staff identities.'));
}
function renderOrders(orders) {
  const list = $('#customer-orders'); list.replaceChildren();
  orders.forEach(order => {
    const block = el('div', undefined, 'customer-order'); block.append(el('strong', order.id), el('span', order.status.replaceAll('_', ' '), 'order-status'));
    block.append(el('p', `${new Date(order.createdAt).toLocaleString()}\n${order.items.map(item => `${item.quantity} × ${item.name} / ${item.variant}`).join('\n')}\n${money(order.totalCents)} · No payment taken`)); list.append(block);
  });
  if (!orders.length) list.append(el('p', 'No demo orders yet. Your first practice order will appear here.'));
}
$('#account-button').addEventListener('click', () => { pendingCheckout = false; showAccount(); });
$('#customer-form').addEventListener('submit', async event => {
  event.preventDefault(); $('#customer-submit').disabled = true;
  try {
    const data = { name: $('#customer-name').value, email: $('#customer-email').value, password: $('#customer-password').value };
    const result = await api(registering ? '/shop/register' : '/login', 'POST', data); user = result.user; $('#customer-password').value = '';
    if (pendingCheckout && user.role === 'customer') await beginCheckout(); else await showAccount();
  } catch (error) { notify(error.message, true, '#account-message'); }
  finally { $('#customer-submit').disabled = !connected; }
});
$('#customer-logout').addEventListener('click', async () => {
  try { await api('/logout', 'POST'); user = null; accountMode(false); await showAccount(); } catch (error) { notify(error.message, true, '#account-message'); }
});
async function beginCheckout() {
  pendingCheckout = true;
  try {
    await refreshCatalog();
    if (!checkoutEnabled || !cart.length || cartLines().some(item => !item.available)) { renderCart(); openDialog('#cart-dialog'); notify('Review the updated bag before continuing.', true, '#cart-message'); return; }
    if (!user || user.role !== 'customer') { if (!user) accountMode(true); await showAccount(); return; }
    const lines = $('#checkout-lines'); lines.replaceChildren();
    cartLines().forEach(item => { const line = el('div', undefined, 'checkout-line'); line.append(el('span', `${item.quantity} × ${item.product.name} / ${item.variant}`), el('span', money(item.product.priceCents * item.quantity))); lines.append(line); });
    $('#checkout-total').textContent = money(total()); $('#checkout-consent').checked = false; $('#place-demo-order').disabled = true; notify('', false, '#checkout-message'); openDialog('#checkout-dialog');
  } catch (error) { openDialog('#cart-dialog'); notify(error.message, true, '#cart-message'); }
}
$('#checkout-button').addEventListener('click', beginCheckout);
$('#checkout-consent').addEventListener('change', () => { $('#place-demo-order').disabled = !$('#checkout-consent').checked || orderBusy; });
$('#place-demo-order').addEventListener('click', async () => {
  if (orderBusy || !$('#checkout-consent').checked) return;
  orderBusy = true; $('#place-demo-order').disabled = true;
  // Retain a retry key per cart/account so retries after a lost response cannot duplicate an order.
  const fingerprint = JSON.stringify({ cart, total: total() });
  const previous = pendingRequest;
  const requestKey = previous?.fingerprint === fingerprint && typeof previous.key === 'string' ? previous.key : crypto.randomUUID();
  pendingRequest = { fingerprint, key: requestKey };
  storageSet(REQUEST_KEY, pendingRequest);
  try {
    const result = await api('/shop/checkout', 'POST', { items: cart, expectedTotalCents: total(), requestKey });
    cart = []; saveCart(); pendingCheckout = false; pendingRequest = null; storageSet(REQUEST_KEY, null);
    $('#order-confirmation').textContent = `${result.order.id} · ${money(result.order.totalCents)} sample total`;
    openDialog('#success-dialog');
    refreshCatalog().catch(() => {});
  } catch (error) { notify(error.message, true, '#checkout-message'); }
  finally { orderBusy = false; $('#place-demo-order').disabled = !$('#checkout-consent').checked; }
});
$('#view-orders').addEventListener('click', () => { pendingCheckout = false; showAccount(); });
async function initialize() {
  try {
    await refreshCatalog();
    notify('Connected demo store. Products, stock, and prices are illustrative. No payments or real fulfilment.');
    try { const result = await api('/me'); user = result.user; } catch { user = null; }
  } catch {
    products = structuredClone(sampleProducts); connected = false; checkoutEnabled = false;
    notify('You’re viewing the sample collection. The connected live preview enables demo accounts and orders.');
    renderProducts(); renderCart();
  }
  const id = new URL(location.href).searchParams.get('product'); if (id) showProduct(id);
}
initialize();
