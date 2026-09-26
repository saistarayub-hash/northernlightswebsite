import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { createStore, verifyPassword, validateContent } from './store.js';

const production = process.env.NODE_ENV === 'production';
const demo = !production && process.env.CMS_DEMO === 'true';
const store = createStore(process.env.CMS_DATA_DIR || path.resolve('.cms-data'), {
  demo, ownerEmail: process.env.CMS_OWNER_EMAIL, ownerPassword: process.env.CMS_OWNER_PASSWORD,
  staffEmail: process.env.CMS_STAFF_EMAIL, staffPassword: process.env.CMS_STAFF_PASSWORD,
});
const app = express();
if (production) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'HEAD'].includes(req.method) && req.get('X-CMS-Request') !== '1') return res.status(403).json({ error: 'Missing request protection header.' });
  next();
});
app.use(express.json({ limit: '64kb' }));
const sessions = new Map();
const attempts = new Map();
const sessionDuration = 8 * 60 * 60 * 1000;
const cookieName = production ? '__Host-nl_session' : 'nl_session';
function tokenFrom(req) {
  return req.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
}
function setCookie(res, token, clear = false) {
  res.set('Set-Cookie', `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${clear ? 0 : sessionDuration / 1000}${production ? '; Secure' : ''}`);
}
function auth(req, res, next) {
  const session = sessions.get(tokenFrom(req));
  if (!session || session.expires < Date.now()) return res.status(401).json({ error: 'Please sign in again.' });
  req.user = store.get().users.find(user => user.id === session.userId);
  if (!req.user) return res.status(401).json({ error: 'Account not found.' });
  next();
}
function owner(req, res, next) {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Only the owner can publish or restore.' });
  next();
}
function summary(state) {
  return { draft: state.draft, published: state.published, revision: state.revision, publishedRevision: state.publishedRevision, status: state.status, history: state.history.map(({ content, ...entry }) => entry), audit: state.audit };
}
function audit(state, user, action) {
  state.audit.unshift({ id: crypto.randomUUID(), name: user.name, role: user.role, action, at: new Date().toISOString() });
  state.audit = state.audit.slice(0, 100);
}
function revision(req, res, next) {
  if (req.body?.revision !== store.get().revision) return res.status(409).json({ error: 'Someone else changed this draft. Reload the editor before saving.' });
  next();
}
app.get('/api/health', (req, res) => res.json({ ok: true, demo }));
app.get('/api/content', (req, res) => {
  const content = store.get().published;
  content.faqs = content.faqs.filter(faq => faq.visible);
  if (!content.announcement.visible || (content.announcement.expiresAt && Date.parse(content.announcement.expiresAt) <= Date.now())) content.announcement = { text: '', expiresAt: '', visible: false };
  res.json(content);
});
app.post('/api/login', (req, res) => {
  const now = Date.now();
  const prior = attempts.get(req.ip);
  const entry = prior && prior.until > now ? prior : { count: 0, until: now + 15 * 60 * 1000 };
  if (entry.count >= 10) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  entry.count++;
  attempts.set(req.ip, entry);
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = req.body?.password;
  const users = store.get().users;
  const user = users.find(user => user.email === email);
  if (typeof password !== 'string' || password.length > 256) return res.status(401).json({ error: 'Email or password is incorrect.' });
  const valid = verifyPassword(password, (user || users[0]).passwordHash);
  if (!user || !valid) return res.status(401).json({ error: 'Email or password is incorrect.' });
  attempts.delete(req.ip);
  sessions.delete(tokenFrom(req));
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId: user.id, expires: now + sessionDuration });
  setCookie(res, token);
  res.json({ user: { name: user.name, role: user.role, email: user.email } });
});
app.post('/api/logout', (req, res) => { sessions.delete(tokenFrom(req)); setCookie(res, '', true); res.json({ ok: true }); });
app.get('/api/me', auth, (req, res) => res.json({ user: { name: req.user.name, role: req.user.role, email: req.user.email }, demo }));
app.use('/api/admin', auth, (req, res, next) => {
  if (!['owner', 'staff'].includes(req.user.role)) return res.status(403).json({ error: 'Staff access is required.' });
  next();
});
app.get('/api/admin/content', auth, (req, res) => res.json(summary(store.get())));
app.put('/api/admin/draft', auth, revision, (req, res) => {
  if (!validateContent(req.body.content)) return res.status(400).json({ error: 'Check the content fields, lengths, and expiry date.' });
  const input = req.body.content;
  const content = { hours: input.hours.trim(), announcement: { text: input.announcement.text.trim(), expiresAt: input.announcement.expiresAt, visible: input.announcement.visible }, faqs: input.faqs.map(faq => ({ id: faq.id, question: faq.question.trim(), answer: faq.answer.trim(), visible: faq.visible })) };
  res.json(summary(store.update(state => { state.draft = content; state.status = 'draft'; state.revision++; audit(state, req.user, 'Saved a draft'); })));
});
app.post('/api/admin/submit', auth, revision, (req, res) => {
  res.json(summary(store.update(state => { state.status = 'review'; state.revision++; audit(state, req.user, 'Requested owner review'); })));
});
app.post('/api/admin/publish', auth, owner, revision, (req, res) => {
  res.json(summary(store.update(state => {
    state.history.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), name: req.user.name, content: state.published });
    state.history = state.history.slice(0, 30);
    state.published = structuredClone(state.draft); state.revision++; state.publishedRevision = state.revision; state.status = 'published';
    audit(state, req.user, 'Published the draft');
  })));
});
app.post('/api/admin/restore', auth, owner, revision, (req, res) => {
  const snapshot = store.get().history.find(item => item.id === req.body.id);
  if (!snapshot) return res.status(404).json({ error: 'That saved version is no longer available.' });
  res.json(summary(store.update(state => { state.draft = snapshot.content; state.status = 'draft'; state.revision++; audit(state, req.user, 'Restored a previous version to draft'); })));
});
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of sessions) if (value.expires < now) sessions.delete(key);
  for (const [key, value] of attempts) if (value.until < now) attempts.delete(key);
}, 60000).unref();
app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));
if (demo) app.get('/', (req, res) => res.redirect('/staff.html'));
app.use(express.static(path.resolve('dist')));
app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
  console.error(error.message);
  res.status(500).json({ error: 'Unable to save changes. Please try again.' });
});
const port = process.env.PORT || 3001;
const server = app.listen(port, '0.0.0.0', () => console.log(`Northern Lights CMS listening on ${server.address().port}${demo ? ' (LOCAL DEMO — not for production)' : ''}`));
