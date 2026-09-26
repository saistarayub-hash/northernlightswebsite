import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launch } from './helpers.js';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStore, initialContent, validateContent } from '../server/store.js';

test('staff CMS workflow and API protections', async t => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'northern-cms-'));
  const { child, url } = await launch(directory);
  t.after(async () => { await new Promise(resolve => { child.once('exit', resolve); child.kill(); }); rmSync(directory, { recursive: true, force: true }); });
  async function request(route, { method = 'GET', body, cookie = '', protectedHeader = true } = {}) {
    const response = await fetch(url + '/api' + route, { method, headers: { 'Content-Type': 'application/json', ...(protectedHeader ? { 'X-CMS-Request': '1' } : {}), Cookie: cookie }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
  }
  let owner, staff, revision, savedHistoryId;
  await t.test('anonymous visitors only see public content', async () => {
    assert.equal((await request('/admin/content')).status, 401);
    const publicContent = await request('/content'); assert.equal(publicContent.status, 200); assert.equal(publicContent.body.hours, initialContent.hours); assert.equal(publicContent.headers.get('cache-control'), 'no-store');
  });
  await t.test('mutations need the request protection header', async () => {
    assert.equal((await request('/login', { method: 'POST', body: {}, protectedHeader: false })).status, 403);
  });
  await t.test('separate owner and staff sessions use HttpOnly cookies', async () => {
    const a = await request('/login', { method: 'POST', body: { email: 'owner@demo.local', password: 'NorthernDemo!Owner' } });
    const b = await request('/login', { method: 'POST', body: { email: 'staff@demo.local', password: 'NorthernDemo!Staff' } });
    assert.equal(a.status, 200); assert.equal(b.status, 200); assert.match(a.headers.get('set-cookie'), /HttpOnly/); assert.match(a.headers.get('set-cookie'), /SameSite=Strict/);
    owner = a.cookie; staff = b.cookie; assert.notEqual(owner, staff);
    revision = (await request('/admin/content', { cookie: staff })).body.revision;
  });
  await t.test('invalid content is rejected', async () => {
    const r = await request('/admin/draft', { method: 'PUT', cookie: staff, body: { revision, content: { ...initialContent, hours: '' } } }); assert.equal(r.status, 400);
  });
  await t.test('staff can save drafts but cannot publish them', async () => {
    const draft = structuredClone(initialContent); draft.hours = 'Closed this Sunday for maintenance.'; draft.announcement = { text: 'A notice that already expired', visible: true, expiresAt: '2000-01-01T00:00:00.000Z' }; draft.faqs[1].visible = false;
    const result = await request('/admin/draft', { method: 'PUT', cookie: staff, body: { revision, content: draft } }); assert.equal(result.status, 200); revision = result.body.revision;
    assert.equal((await request('/content')).body.hours, initialContent.hours);
    assert.equal((await request('/admin/publish', { method: 'POST', cookie: staff, body: { revision } })).status, 403);
  });
  await t.test('stale revisions cannot overwrite another person’s work', async () => {
    const result = await request('/admin/draft', { method: 'PUT', cookie: staff, body: { revision: revision - 1, content: initialContent } }); assert.equal(result.status, 409);
  });
  await t.test('staff submit and owner publishes', async () => {
    const review = await request('/admin/submit', { method: 'POST', cookie: staff, body: { revision } }); assert.equal(review.body.status, 'review'); revision = review.body.revision;
    const result = await request('/admin/publish', { method: 'POST', cookie: owner, body: { revision } }); assert.equal(result.status, 200); revision = result.body.revision; savedHistoryId = result.body.history[0].id;
    const publicContent = (await request('/content')).body;
    assert.equal(publicContent.hours, 'Closed this Sunday for maintenance.'); assert.equal(publicContent.announcement.visible, false); assert.equal(publicContent.faqs.length, 1);
    assert.equal(result.body.audit[0].action, 'Published the draft');
  });
  await t.test('restore is owner-only and does not immediately change the public site', async () => {
    assert.equal((await request('/admin/restore', { method: 'POST', cookie: staff, body: { revision, id: savedHistoryId } })).status, 403);
    const result = await request('/admin/restore', { method: 'POST', cookie: owner, body: { revision, id: savedHistoryId } }); assert.equal(result.status, 200); assert.equal(result.body.draft.hours, initialContent.hours); revision = result.body.revision;
    assert.equal((await request('/content')).body.hours, 'Closed this Sunday for maintenance.');
    assert.equal((await request('/admin/publish', { method: 'POST', cookie: owner, body: { revision } })).status, 200);
    assert.equal((await request('/content')).body.hours, initialContent.hours);
  });
  await t.test('content persists to disk, and demo data is refused in production', () => {
    const store = createStore(directory, { demo: true }); assert.equal(store.get().history.length, 2);
    assert.throws(() => createStore(directory, { demo: false }), /Demo data cannot be used in production/);
  });
  await t.test('logout invalidates the session', async () => {
    assert.equal((await request('/logout', { method: 'POST', cookie: owner })).status, 200);
    assert.equal((await request('/admin/content', { cookie: owner })).status, 401);
  });
  await t.test('login attempts are rate limited', async () => {
    for (let i = 0; i < 10; i++) assert.equal((await request('/login', { method: 'POST', body: { email: 'unknown', password: 'wrong' } })).status, 401);
    assert.equal((await request('/login', { method: 'POST', body: { email: 'unknown', password: 'wrong' } })).status, 429);
  });
});
test('validation rejects duplicate FAQs and invalid dates', () => {
  const content = structuredClone(initialContent); content.faqs.push(content.faqs[0]); assert.equal(validateContent(content), false);
  content.faqs.pop(); content.announcement.expiresAt = 'not a date'; assert.equal(validateContent(content), false);
});
