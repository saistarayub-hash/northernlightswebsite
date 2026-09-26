// Browser-only demonstration adapter for the public GitHub Pages preview.
// This is NOT authentication, authorization, a backend, or a way to edit the deployed site.
export const PREVIEW_KEY = 'northern-lights-staff-preview-v1';
const ROLE_KEY = 'northern-lights-preview-role-v1';
function freshState() {
  const content = {
    hours: 'Opening hours are awaiting confirmation from Northern Lights.',
    announcement: { text: '', expiresAt: '', visible: false },
    faqs: [
      { id: 'preview', question: 'Is this the official Northern Lights website?', answer: 'This is a design preview. Business approval is still pending.', visible: true },
      { id: 'hours', question: 'What are the opening hours?', answer: 'Opening hours and holiday schedules have not yet been confirmed.', visible: true },
    ],
  };
  return { version: 1, published: structuredClone(content), draft: structuredClone(content), revision: 1, publishedRevision: 1, status: 'published', history: [], audit: [] };
}
function validContent(content) {
  const text = (value, max) => typeof value === 'string' && value.length <= max;
  if (!content || !text(content.hours, 600) || !content.hours.trim()) return false;
  const notice = content.announcement;
  if (!notice || !text(notice.text, 300) || typeof notice.visible !== 'boolean' || !text(notice.expiresAt, 40)) return false;
  if (notice.visible && !notice.text.trim()) return false;
  if (notice.expiresAt && !Number.isFinite(Date.parse(notice.expiresAt))) return false;
  if (!Array.isArray(content.faqs) || content.faqs.length > 20) return false;
  const ids = new Set();
  return content.faqs.every(faq => {
    if (!faq || !text(faq.id, 80) || !faq.id || ids.has(faq.id) || !text(faq.question, 160) || !faq.question.trim() || !text(faq.answer, 2000) || !faq.answer.trim() || typeof faq.visible !== 'boolean') return false;
    ids.add(faq.id); return true;
  });
}
export function createBrowserPreview(storage, session) {
  function read() {
    let raw;
    try { raw = storage.getItem(PREVIEW_KEY); } catch { throw new Error('Browser storage is blocked. Open this demo in a regular browser tab with site storage enabled.'); }
    if (!raw) return freshState();
    try {
      const state = JSON.parse(raw);
      if (state.version !== 1 || !validContent(state.draft) || !validContent(state.published) || !Array.isArray(state.history) || !Array.isArray(state.audit) || !Number.isInteger(state.revision)) throw new Error();
      return state;
    } catch { throw new Error('This browser’s demo data could not be read. Use Reset browser demo to start again.'); }
  }
  function write(state) {
    try { storage.setItem(PREVIEW_KEY, JSON.stringify(state)); } catch { throw new Error('The browser could not save this demo. Free up site storage or try a regular browser tab.'); }
  }
  function identity() {
    let role;
    try { role = session.getItem(ROLE_KEY); } catch { throw new Error('Session storage is blocked. Open this demo in a regular browser tab.'); }
    if (!['owner', 'staff'].includes(role)) return null;
    return { name: role === 'owner' ? 'Demo owner' : 'Demo staff', role, email: `${role}@demo.local` };
  }
  function summary(state) {
    return { ...state, history: state.history.map(({ content, ...entry }) => entry) };
  }
  function audit(state, user, action) {
    state.audit.unshift({ id: crypto.randomUUID(), name: user.name, role: user.role, action, at: new Date().toISOString() });
    state.audit = state.audit.slice(0, 100);
  }
  return async function request(url, method = 'GET', body) {
    if (url === '/health' && method === 'GET') return { ok: true, demo: true, browserDemo: true };
    if (url === '/demo/reset' && method === 'POST') { write(freshState()); session.removeItem(ROLE_KEY); return { ok: true }; }
    if (url === '/login' && method === 'POST') {
      const role = body?.email === 'owner@demo.local' ? 'owner' : body?.email === 'staff@demo.local' ? 'staff' : null;
      if (!role) throw new Error('Use a demo role button. This preview has no real sign-in or account registration.');
      session.setItem(ROLE_KEY, role);
      return { user: identity() };
    }
    if (url === '/logout' && method === 'POST') { session.removeItem(ROLE_KEY); return { ok: true }; }
    if (url === '/content' && method === 'GET') {
      const content = read().published;
      content.faqs = content.faqs.filter(faq => faq.visible);
      if (!content.announcement.visible || (content.announcement.expiresAt && Date.parse(content.announcement.expiresAt) <= Date.now())) content.announcement = { text: '', expiresAt: '', visible: false };
      return content;
    }
    const user = identity();
    if (!user) throw new Error('Choose a demo role to enter the studio.');
    if (url === '/me' && method === 'GET') return { user, demo: true, browserDemo: true };
    const state = read();
    if (url === '/admin/content' && method === 'GET') return summary(state);
    if (body?.revision !== state.revision) throw new Error('This demo draft changed in another tab. Reload the saved draft before continuing.');
    if (url === '/admin/draft' && method === 'PUT') {
      if (!validContent(body.content)) throw new Error('Check the content fields, lengths, and expiry date.');
      state.draft = structuredClone(body.content); state.status = 'draft';
      audit(state, user, 'Saved a browser-only draft');
    } else if (url === '/admin/submit' && method === 'POST') {
      state.status = 'review'; audit(state, user, 'Requested simulated owner review');
    } else if (url === '/admin/publish' && method === 'POST') {
      if (user.role !== 'owner') throw new Error('Switch to the demo owner to simulate publishing.');
      state.history.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), name: user.name, content: structuredClone(state.published) });
      state.history = state.history.slice(0, 30);
      state.published = structuredClone(state.draft); state.status = 'published'; state.publishedRevision = state.revision + 1;
      audit(state, user, 'Published to this browser’s preview only');
    } else if (url === '/admin/restore' && method === 'POST') {
      if (user.role !== 'owner') throw new Error('Switch to the demo owner to restore a version.');
      const previous = state.history.find(entry => entry.id === body.id);
      if (!previous || !validContent(previous.content)) throw new Error('That demo version is unavailable.');
      state.draft = structuredClone(previous.content); state.status = 'draft';
      audit(state, user, 'Restored a browser-only version to draft');
    } else throw new Error('This action is not supported by the browser preview.');
    state.revision++;
    write(state);
    return summary(state);
  };
}
let instance;
export function browserPreviewRequest(...args) {
  if (!instance) instance = createBrowserPreview(window.localStorage, window.sessionStorage);
  return instance(...args);
}
