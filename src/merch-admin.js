import { money, categories } from './merch-data.js';
const BASE = import.meta.env.BASE_URL;
const $ = selector => document.querySelector(selector);
const el = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
let user = null, data = { products: [], orders: [] }, editing = null, variants = [], busy = false, editorDirty = false;
let requestedEdit = new URL(location.href).searchParams.get('edit');
function message(text, error = false) { $('#message').textContent = text; $('#message').classList.toggle('error', error); }
async function api(route, method = 'GET', body) {
  const response = await fetch(`/api${route}`, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CMS-Request': '1' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Merchandise tools require the connected backend.');
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401) { user = null; $('#merch-workspace').hidden = true; $('#login-panel').hidden = false; $('#account').hidden = true; }
    throw new Error(result.error || 'Unable to complete that action.');
  }
  return result;
}
async function load() {
  data = await api('/admin/merch');
  $('#merch-workspace').hidden = false; $('#login-panel').hidden = true; $('#account').hidden = false; $('#account-name').textContent = `${user.name} · ${user.role}`;
  render();
  if (requestedEdit) {
    const selected = data.products.find(product => product.id === requestedEdit); requestedEdit = null;
    if (selected) showEditor(selected); else message('That design is no longer available.', true);
  }
}
function render() {
  $('#stat-designs').textContent = String(data.products.length);
  $('#stat-visible').textContent = String(data.products.filter(product => !product.hidden).length);
  $('#stat-units').textContent = String(data.products.reduce((sum, product) => sum + product.variants.reduce((count, variant) => count + variant.stock, 0), 0));
  $('#stat-orders').textContent = String(data.orders.length);
  renderProducts(); renderOrders();
}
function renderProducts() {
  const search = $('#inventory-search').value.trim().toLowerCase(); const filter = $('#inventory-filter').value;
  const list = $('#inventory-list'); list.replaceChildren();
  data.products.filter(product => product.name.toLowerCase().includes(search) && (filter === 'all' || product.hidden === (filter === 'hidden'))).forEach(product => {
    const card = el('article', undefined, `inventory-card${product.hidden ? ' hidden-product' : ''}`);
    const img = el('img'); img.src = `${BASE}images/merch/${product.art}.svg`; img.alt = `${product.name} — concept illustration`; img.width = 640; img.height = 740;
    const body = el('div', undefined, 'inventory-card-body'); body.append(el('span', product.hidden ? 'HIDDEN · SAFE TO RESTORE' : 'VISIBLE IN DEMO STORE', 'inventory-badge'), el('h3', product.name));
    body.append(el('p', `${categories[product.category]} · ${money(product.priceCents)}\n${product.variants.reduce((sum, variant) => sum + variant.stock, 0)} sample units / ${product.variants.length} options`));
    const actions = el('div', undefined, 'inventory-card-actions');
    const edit = el('button', 'Edit design ↗', 'secondary'); edit.disabled = busy; edit.addEventListener('click', () => showEditor(product));
    const hide = el('button', product.hidden ? 'Show again' : 'Hide from store', 'visibility-button'); hide.disabled = busy;
    hide.addEventListener('click', () => {
      if (!confirm(product.hidden ? 'Make this design visible in the demo store again?' : 'Hide this design from the store? Its details and order history will be kept.')) return;
      changeVisibility(product);
    }); actions.append(edit, hide); body.append(actions); card.append(img, body); list.append(card);
  });
  if (!list.children.length) list.append(el('p', 'No matching designs. Change the filter or add merchandise.', 'inventory-empty'));
}
async function changeVisibility(product) {
  if (busy) return; busy = true; renderProducts();
  try {
    await api(`/admin/merch/products/${product.id}`, 'PUT', { revision: product.revision, product: { ...product, hidden: !product.hidden } });
    await load(); message(product.hidden ? 'Design restored to the demo store.' : 'Design hidden. Use “Show again” to restore it.');
  } catch (error) { message(error.message, true); }
  finally { busy = false; render(); }
}
function renderOrders() {
  const list = $('#merch-orders'); list.replaceChildren();
  data.orders.forEach(order => {
    const card = el('article', undefined, 'merch-order'); const header = el('div', undefined, 'merch-order-header'); const text = el('div');
    text.append(el('h3', order.id), el('p', `${order.customerName} · ${new Date(order.createdAt).toLocaleString()}`)); header.append(text, el('span', order.status.replaceAll('_', ' ').toUpperCase()));
    const lines = el('p', order.items.map(item => `${item.quantity} × ${item.name} · ${item.variant}`).join('\n'), 'merch-order-lines');
    const footer = el('div', undefined, 'merch-order-footer'); footer.append(el('strong', `${money(order.totalCents)} · NO PAYMENT`)); const actions = el('div');
    const statuses = order.status === 'demo_pending' ? [['demo_packed', 'Mark demo packed'], ['cancelled', 'Cancel & restock']] : order.status === 'demo_packed' ? [['demo_complete', 'Complete demo'], ['cancelled', 'Cancel & restock']] : [];
    statuses.forEach(([status, label]) => {
      const button = el('button', label, 'secondary'); button.disabled = busy;
      button.addEventListener('click', async () => {
        if (busy || !confirm(status === 'cancelled' ? 'Cancel this demo order and return its sample stock? This cannot be reversed.' : `${label}? This does not trigger real fulfilment.`)) return;
        busy = true; renderOrders();
        try { await api(`/admin/merch/orders/${order.id}`, 'PATCH', { revision: order.revision, status }); await load(); message('Demo order updated. No real fulfilment was triggered.'); }
        catch (error) { message(error.message, true); }
        finally { busy = false; render(); }
      }); actions.append(button);
    }); footer.append(actions); card.append(header, lines, footer); list.append(card);
  });
  if (!data.orders.length) list.append(el('p', 'Demo customer orders will appear here. Open the store to run a practice checkout.', 'inventory-empty'));
}
const illustrations = { apparel: [['tee', 'Black tee concept'], ['hoodie', 'Green hoodie concept']], prints: [['print', 'Aurora print concept']], stickers: [['stickers', 'Sticker set concept']] };
function renderArt(selected) {
  const select = $('#edit-art'); select.replaceChildren();
  illustrations[$('#edit-category').value].forEach(([value, label]) => { const option = el('option', label); option.value = value; select.append(option); });
  if ([...select.options].some(option => option.value === selected)) select.value = selected;
}
function showEditor(product = null) {
  editing = product ? structuredClone(product) : null; editorDirty = false;
  $('#editor-title').textContent = product ? 'Edit merchandise' : 'Add a new design';
  $('#edit-name').value = product?.name || ''; $('#edit-description').value = product?.description || '';
  $('#edit-category').value = product?.category || 'apparel'; renderArt(product?.art);
  $('#edit-price').value = product ? (product.priceCents / 100).toFixed(2) : '';
  $('#edit-hidden').checked = product ? product.hidden : true;
  variants = product ? structuredClone(product.variants) : [{ label: 'One size', stock: 0 }];
  renderVariants(); $('#editor-message').textContent = ''; $('#product-editor').showModal();
}
function renderVariants() {
  const list = $('#variant-fields'); list.replaceChildren();
  variants.forEach((variant, index) => {
    const row = el('div', undefined, 'variant-row'); const label = el('label', 'Option'); const input = el('input'); input.value = variant.label; input.maxLength = 40; input.required = true;
    input.addEventListener('input', () => { variant.label = input.value; editorDirty = true; }); label.append(input);
    const stockLabel = el('label', 'Sample stock'); const stock = el('input'); stock.type = 'number'; stock.min = 0; stock.max = 100000; stock.step = 1; stock.required = true; stock.value = variant.stock;
    stock.addEventListener('input', () => { variant.stock = stock.value === '' ? NaN : Number(stock.value); editorDirty = true; }); stockLabel.append(stock);
    const remove = el('button', '×'); remove.type = 'button'; remove.setAttribute('aria-label', `Remove option ${index + 1}`); remove.disabled = variants.length === 1;
    remove.addEventListener('click', () => { variants.splice(index, 1); editorDirty = true; renderVariants(); }); row.append(label, stockLabel, remove); list.append(row);
  });
  $('#add-variant').disabled = variants.length >= 12;
}
$('#add-variant').addEventListener('click', () => { if (variants.length >= 12) return; variants.push({ label: '', stock: 0 }); editorDirty = true; renderVariants(); $('#variant-fields').lastElementChild.querySelector('input').focus(); });
$('#edit-category').addEventListener('change', () => { renderArt(); editorDirty = true; });
$('#product-form').addEventListener('input', () => { editorDirty = true; });
function closeEditor() { if (busy) return; if (editorDirty && !confirm('Discard unsaved merchandise changes?')) return; editorDirty = false; $('#product-editor').close(); }
$('#close-editor').addEventListener('click', closeEditor); $('#cancel-editor').addEventListener('click', closeEditor);
$('#product-editor').addEventListener('cancel', event => { event.preventDefault(); closeEditor(); });
$('#product-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return;
  const price = $('#edit-price').value;
  if (!/^\d+(\.\d{1,2})?$/.test(price)) { $('#editor-message').textContent = 'Use a positive rand amount with no more than two decimal places.'; return; }
  const product = { name: $('#edit-name').value, description: $('#edit-description').value, category: $('#edit-category').value, art: $('#edit-art').value, priceCents: Math.round(Number(price) * 100), hidden: $('#edit-hidden').checked, variants };
  busy = true; $('#product-form').setAttribute('inert', '');
  try {
    if (editing) await api(`/admin/merch/products/${editing.id}`, 'PUT', { revision: editing.revision, product });
    else await api('/admin/merch/products', 'POST', { product });
    editorDirty = false; $('#product-editor').close(); await load(); message('Merchandise saved. The demo store will show the change on its next refresh.');
  } catch (error) { $('#editor-message').textContent = error.message; }
  finally { busy = false; $('#product-form').removeAttribute('inert'); render(); }
});
$('#add-product').addEventListener('click', () => showEditor());
$('#inventory-search').addEventListener('input', renderProducts); $('#inventory-filter').addEventListener('change', renderProducts);
$('#reload-merch').addEventListener('click', async () => { try { await load(); message('Latest merchandise and orders loaded.'); } catch (error) { message(error.message, true); } });
$('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); $('#login-form button').disabled = true;
  try { const result = await api('/login', 'POST', { email: $('#email').value, password: $('#password').value }); user = result.user; $('#password').value = ''; await load(); message(`Signed in as ${user.role}.`); }
  catch (error) { message(error.message, true); }
  finally { $('#login-form button').disabled = false; }
});
$('#logout').addEventListener('click', async () => { try { await api('/logout', 'POST'); user = null; $('#merch-workspace').hidden = true; $('#login-panel').hidden = false; $('#account').hidden = true; message('Signed out.'); } catch (error) { message(error.message, true); } });
document.querySelectorAll('[data-demo]').forEach(button => button.addEventListener('click', () => { const owner = button.dataset.demo === 'owner'; $('#email').value = owner ? 'owner@demo.local' : 'staff@demo.local'; $('#password').value = owner ? 'NorthernDemo!Owner' : 'NorthernDemo!Staff'; $('#login-form').requestSubmit(); }));
window.addEventListener('beforeunload', event => { if (editorDirty) { event.preventDefault(); event.returnValue = ''; } });
async function initialize() {
  try {
    const health = await api('/health'); $('#demo-accounts').hidden = !health.demo; $('#environment').textContent = health.demo ? 'LOCAL DEMO · MERCHANDISE' : 'CONNECTED · CHECKOUT DISABLED';
    try { const result = await api('/me'); user = result.user; await load(); } catch (error) { if (user) message(error.message, true); }
  } catch (error) { $('#environment').textContent = 'BACKEND OFFLINE'; message(error.message, true); $('#login-form').querySelectorAll('input,button').forEach(element => { element.disabled = true; }); }
}
initialize();
