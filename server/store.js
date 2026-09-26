import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const initialContent = {
  hours: 'Opening hours are awaiting confirmation from Northern Lights.',
  announcement: { text: '', expiresAt: '', visible: false },
  faqs: [
    { id: 'preview', question: 'Is this the official Northern Lights website?', answer: 'This is a design preview. Business approval is still pending.', visible: true },
    { id: 'hours', question: 'What are the opening hours?', answer: 'Opening hours and holiday schedules have not yet been confirmed.', visible: true },
  ],
};
export function passwordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password, hash) {
  const [salt, value] = hash.split(':');
  return crypto.timingSafeEqual(crypto.scryptSync(password, salt, 64), Buffer.from(value, 'hex'));
}
export function createStore(directory, { demo, ownerEmail, ownerPassword, staffEmail, staffPassword }) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, 'cms.json');
  let state;
  if (fs.existsSync(file)) {
    state = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!demo && state.demo) throw new Error('Demo data cannot be used in production. Choose a fresh CMS_DATA_DIR.');
  } else {
    if (!demo && (!ownerEmail || !ownerPassword || ownerPassword.length < 12)) {
      throw new Error('Production requires CMS_OWNER_EMAIL and CMS_OWNER_PASSWORD (at least 12 characters) on initial setup.');
    }
    if (!demo && staffEmail && (!staffPassword || staffPassword.length < 12)) throw new Error('Staff password must contain at least 12 characters.');
    const users = [{ id: 'owner', name: 'Owner', role: 'owner', email: demo ? 'owner@demo.local' : ownerEmail.toLowerCase(), passwordHash: passwordHash(demo ? 'NorthernDemo!Owner' : ownerPassword) }];
    if (demo || staffEmail) users.push({ id: 'staff', name: 'Staff', role: 'staff', email: demo ? 'staff@demo.local' : staffEmail.toLowerCase(), passwordHash: passwordHash(demo ? 'NorthernDemo!Staff' : staffPassword) });
    if (new Set(users.map(user => user.email)).size !== users.length) throw new Error('Owner and staff must have different email addresses.');
    state = { demo, users, published: structuredClone(initialContent), draft: structuredClone(initialContent), revision: 1, publishedRevision: 1, status: 'published', history: [], audit: [] };
    fs.writeFileSync(file, JSON.stringify(state, null, 2), { mode: 0o600 });
  }
  return {
    get: () => structuredClone(state),
    update: callback => {
      const next = structuredClone(state);
      callback(next);
      const temporary = `${file}.tmp`;
      fs.writeFileSync(temporary, JSON.stringify(next, null, 2), { mode: 0o600 });
      fs.renameSync(temporary, file);
      state = next;
      return structuredClone(state);
    },
  };
}
export function validateContent(value) {
  const text = (v, max) => typeof v === 'string' && v.length <= max;
  if (!value || !text(value.hours, 600) || !value.hours.trim()) return false;
  const announcement = value.announcement;
  if (!announcement || !text(announcement.text, 300) || typeof announcement.visible !== 'boolean' || !text(announcement.expiresAt, 40)) return false;
  if (announcement.visible && !announcement.text.trim()) return false;
  if (announcement.expiresAt && !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(announcement.expiresAt)) return false;
  if (announcement.expiresAt && !Number.isFinite(Date.parse(announcement.expiresAt))) return false;
  if (!Array.isArray(value.faqs) || value.faqs.length > 20) return false;
  const ids = new Set();
  for (const faq of value.faqs) {
    if (!faq || !text(faq.id, 80) || !faq.id || ids.has(faq.id) || !text(faq.question, 160) || !faq.question.trim() || !text(faq.answer, 2000) || !faq.answer.trim() || typeof faq.visible !== 'boolean') return false;
    ids.add(faq.id);
  }
  return true;
}
