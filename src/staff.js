const browserDemo = typeof __STATIC_CMS_DEMO__ !== 'undefined' && __STATIC_CMS_DEMO__;
const $ = selector => document.querySelector(selector);
let user, state, content, busy = false, previewPublished = false;
const message = (text, error = false) => { $('#message').textContent = text; $('#message').classList.toggle('error', error); };
const clone = value => structuredClone(value);
const dirty = () => Boolean(state && JSON.stringify(content) !== JSON.stringify(state.draft));
const stamp = value => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
function node(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
async function api(url, method = 'GET', body) {
  if (browserDemo) {
    const { browserPreviewRequest } = await import('./browser-preview.js');
    return browserPreviewRequest(url, method, body);
  }
  const response = await fetch(`/api${url}`, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CMS-Request': '1' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The staff backend is unavailable on this host.');
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && user) {
      user = null; $('#editor-panel').hidden = true; $('#login-panel').hidden = false; $('#account').hidden = true;
    }
    throw new Error(result.error || 'That action could not be completed.');
  }
  return result;
}
function controls() {
  $('#status-badge').textContent = dirty() ? 'UNSAVED CHANGES' : state.status === 'review' ? 'AWAITING REVIEW' : state.status.toUpperCase();
  $('#revision-label').textContent = `Draft revision ${state.revision}`;
  $('#save').disabled = busy || !dirty();
  $('#submit-review').disabled = busy || dirty() || state.status === 'published' || state.status === 'review';
  $('#publish').hidden = user.role !== 'owner';
  $('#publish').disabled = busy || dirty() || state.status === 'published';
  $('#reload').disabled = busy;
  $('#add-faq').disabled = content.faqs.length >= 20 || busy;
  document.querySelectorAll('[data-restore]').forEach(button => { button.disabled = busy || dirty(); });
}
function update() { renderPreview(); renderChanges(); controls(); }
function selectTab(name, focus = false) {
  document.querySelectorAll('[data-tab]').forEach(button => {
    const selected = button.dataset.tab === name;
    button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
    $(`#panel-${button.dataset.tab}`).hidden = !selected;
    if (selected && focus) button.focus();
  });
}
document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => selectTab(button.dataset.tab)));
$('.tabs').addEventListener('keydown', event => {
  const names = ['hours', 'announcement', 'faqs'];
  let index = names.indexOf(event.target.dataset.tab);
  if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  index = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
  selectTab(names[index], true);
});
function localDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function renderFields() {
  $('#hours').value = content.hours;
  $('#notice-text').value = content.announcement.text;
  $('#notice-visible').checked = content.announcement.visible;
  $('#notice-expiry').value = localDate(content.announcement.expiresAt);
  renderFaqFields();
}
function renderFaqFields() {
  const parent = $('#faq-fields'); parent.replaceChildren();
  content.faqs.forEach((faq, index) => {
    const block = node('div', undefined, 'faq-field');
    const questionLabel = node('label', `Question ${index + 1}`);
    const question = node('input'); question.type = 'text'; question.maxLength = 160; question.value = faq.question;
    question.addEventListener('input', () => { faq.question = question.value; update(); });
    questionLabel.append(question);
    const answerLabel = node('label', 'Answer');
    const answer = node('textarea'); answer.rows = 4; answer.maxLength = 2000; answer.value = faq.answer;
    answer.addEventListener('input', () => { faq.answer = answer.value; update(); }); answerLabel.append(answer);
    const actions = node('div', undefined, 'faq-actions');
    const visibleLabel = node('label', undefined, 'checkbox'); const visible = node('input'); visible.type = 'checkbox'; visible.checked = faq.visible;
    visible.addEventListener('change', () => { faq.visible = visible.checked; update(); }); visibleLabel.append(visible, document.createTextNode('Visible after publishing'));
    const remove = node('button', 'Remove'); remove.type = 'button'; remove.setAttribute('aria-label', `Remove question ${index + 1}`);
    remove.addEventListener('click', () => {
      if (!confirm('Remove this question from the draft? You can hide it instead to keep it for later.')) return;
      content.faqs = content.faqs.filter(item => item.id !== faq.id); renderFaqFields(); update(); $('#add-faq').focus();
    });
    actions.append(visibleLabel, remove); block.append(questionLabel, answerLabel, actions); parent.append(block);
  });
}
$('#hours').addEventListener('input', event => { content.hours = event.target.value; update(); });
$('#notice-text').addEventListener('input', event => { content.announcement.text = event.target.value; update(); });
$('#notice-visible').addEventListener('change', event => { content.announcement.visible = event.target.checked; update(); });
$('#notice-expiry').addEventListener('change', event => { content.announcement.expiresAt = event.target.value ? new Date(event.target.value).toISOString() : ''; update(); });
$('#add-faq').addEventListener('click', () => {
  if (content.faqs.length >= 20) return;
  content.faqs.push({ id: crypto.randomUUID(), question: '', answer: '', visible: true });
  renderFaqFields(); update(); $('#faq-fields').lastElementChild.querySelector('input').focus();
});
function renderPreview() {
  const data = previewPublished ? state.published : content;
  const announcement = data.announcement;
  const expired = announcement.expiresAt && Date.parse(announcement.expiresAt) <= Date.now();
  $('#preview-notice').replaceChildren(node('h4', 'A note from the team'), node('p', announcement.visible && !expired ? announcement.text || 'Write your announcement…' : expired ? 'Notice expired · hidden on the public site' : 'No visible notice · tap to add one'));
  $('#preview-hours').replaceChildren(node('h4', 'Opening hours'), node('p', data.hours || 'Add confirmed opening hours…'));
  const faqPreview = $('#preview-faqs'); faqPreview.replaceChildren(node('h4', 'Good to know'));
  data.faqs.filter(faq => faq.visible).forEach(faq => { const block = node('div', undefined, 'preview-faq'); block.append(node('strong', faq.question || 'Your question…'), node('p', faq.answer || 'Your answer…')); faqPreview.append(block); });
  if (!data.faqs.some(faq => faq.visible)) faqPreview.append(node('p', 'No visible team FAQs.'));
  $('.preview-dot').textContent = previewPublished ? 'PUBLISHED' : 'DRAFT';
  $('#show-draft').classList.toggle('active', !previewPublished); $('#show-published').classList.toggle('active', previewPublished);
  $('#show-draft').setAttribute('aria-pressed', String(!previewPublished)); $('#show-published').setAttribute('aria-pressed', String(previewPublished));
}
$('#show-draft').addEventListener('click', () => { previewPublished = false; renderPreview(); });
$('#show-published').addEventListener('click', () => { previewPublished = true; renderPreview(); });
for (const [element, tab] of [['notice', 'announcement'], ['hours', 'hours'], ['faqs', 'faqs']]) {
  const block = $(`#preview-${element}`);
  const activate = () => { previewPublished = false; renderPreview(); selectTab(tab); $(`#panel-${tab}`).scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' }); $(`#panel-${tab}`).querySelector('input,textarea,button')?.focus({ preventScroll: true }); };
  block.addEventListener('click', activate);
  block.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); } });
}
function renderChanges() {
  const parent = $('#changes'); parent.replaceChildren();
  const sections = [
    ['Opening hours', state.published.hours, content.hours],
    ['Announcement', describeNotice(state.published.announcement), describeNotice(content.announcement)],
    ['FAQs', describeFaqs(state.published.faqs), describeFaqs(content.faqs)],
  ];
  sections.forEach(([title, before, after]) => {
    if (before === after) return;
    const block = node('div', undefined, 'change-item'); block.append(node('b', title), node('del', `Published: ${before || '(empty)'}`), node('ins', `Draft: ${after || '(empty)'}`)); parent.append(block);
  });
  if (!parent.children.length) parent.append(node('p', 'Your draft matches the published content. Nothing to change yet.'));
}
function describeNotice(value) { return `${value.visible ? 'Visible' : 'Hidden'} · ${value.text || 'No notice'}${value.expiresAt ? ` · Expires ${stamp(value.expiresAt)}` : ''}`; }
function describeFaqs(values) { return values.map(value => `${value.visible ? 'Visible' : 'Hidden'}: ${value.question}\n${value.answer}`).join('\n\n'); }
function renderHistory() {
  const history = $('#history-list'); history.replaceChildren();
  state.history.forEach(entry => {
    const row = node('div', undefined, 'history-item'); const description = node('div'); description.append(node('p', 'Version before publication'), node('small', `${stamp(entry.at)} · ${entry.name}`)); row.append(description);
    if (user.role === 'owner') {
      const restore = node('button', 'Restore to draft'); restore.dataset.restore = entry.id;
      restore.addEventListener('click', () => {
        if (!confirm('Replace the saved draft with this previous publication? The public site will not change until you publish.')) return;
        mutate('/admin/restore', { id: entry.id }, 'Previous version restored to draft. Review it before publishing.');
      }); row.append(restore);
    } history.append(row);
  });
  if (!state.history.length) history.append(node('p', 'Previous versions appear after your first publication.'));
  const audit = $('#audit-list'); audit.replaceChildren();
  state.audit.slice(0, 12).forEach(entry => { const row = node('div', undefined, 'history-item'); const description = node('div'); description.append(node('p', `${entry.name} · ${entry.action}`), node('small', stamp(entry.at))); row.append(description); audit.append(row); });
  if (!state.audit.length) audit.append(node('p', 'Your team’s saved changes will appear here.'));
}
async function loadEditor() {
  state = await api('/admin/content'); content = clone(state.draft);
  $('#login-panel').hidden = true; $('#editor-panel').hidden = false; $('#account').hidden = false;
  $('#account-name').textContent = `${user.name} · ${user.role}`;
  renderFields(); renderHistory(); update();
}
function validate() {
  if (!content.hours.trim()) throw new Error('Add opening hours or a clear note that they are unconfirmed.');
  if (content.announcement.visible && !content.announcement.text.trim()) throw new Error('Write a notice before making it visible.');
  if (content.faqs.some(faq => !faq.question.trim() || !faq.answer.trim())) throw new Error('Each question needs both a question and an answer—even when hidden.');
}
async function mutate(url, body, success, method = 'POST') {
  if (busy) return;
  busy = true; controls(); $('.editing').setAttribute('inert', ''); $('.preview-column').setAttribute('inert', '');
  try {
    state = await api(url, method, { ...body, revision: state.revision }); content = clone(state.draft);
    renderFields(); renderHistory(); message(success);
  } catch (error) { message(error.message, true); }
  finally { busy = false; $('.editing').removeAttribute('inert'); $('.preview-column').removeAttribute('inert'); if (user) update(); }
}
$('#save').addEventListener('click', () => { try { validate(); mutate('/admin/draft', { content }, 'Draft saved. The public website is unchanged.', 'PUT'); } catch (error) { message(error.message, true); } });
$('#submit-review').addEventListener('click', () => mutate('/admin/submit', {}, 'Sent for owner review. Nothing is published yet.'));
$('#publish').addEventListener('click', () => $('#confirm-publish').showModal());
$('#cancel-publish').addEventListener('click', () => $('#confirm-publish').close());
$('#confirm-publish-button').addEventListener('click', () => { $('#confirm-publish').close(); mutate('/admin/publish', {}, browserDemo ? 'Saved to your browser preview only. The live website is unchanged.' : 'Published. The public site will show these changes on its next load.'); });
$('#reload').addEventListener('click', async () => {
  if (dirty() && !confirm('Discard unsaved changes and load the latest saved draft?')) return;
  try { await loadEditor(); message('Latest saved draft loaded.'); } catch (error) { message(error.message, true); }
});
$('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = $('#login-form button'); button.disabled = true;
  try { const result = await api('/login', 'POST', { email: $('#email').value, password: $('#password').value }); user = result.user; $('#password').value = ''; await loadEditor(); message(browserDemo ? `Exploring the ${user.role} demo. No real sign-in has taken place.` : `Welcome back. You’re signed in as ${user.role}.`); }
  catch (error) { message(error.message, true); }
  finally { button.disabled = false; }
});
$('#logout').addEventListener('click', async () => {
  if (dirty() && !confirm('Sign out and discard unsaved changes?')) return;
  try { await api('/logout', 'POST'); user = null; state = null; content = null; $('#editor-panel').hidden = true; $('#account').hidden = true; $('#login-panel').hidden = false; message(browserDemo ? 'Choose a different demo role. Your browser’s saved draft is kept.' : 'Signed out.'); }
  catch (error) { message(error.message, true); }
});
document.querySelectorAll('[data-demo]').forEach(button => button.addEventListener('click', () => {
  const owner = button.dataset.demo === 'owner'; $('#email').value = owner ? 'owner@demo.local' : 'staff@demo.local'; $('#password').value = owner ? 'NorthernDemo!Owner' : 'NorthernDemo!Staff'; $('#login-form').requestSubmit();
}));
window.addEventListener('beforeunload', event => { if (dirty()) { event.preventDefault(); event.returnValue = ''; } });
async function initialize() {
if (browserDemo) {
  $('#browser-demo-banner').hidden = false;
  $('#login-form').hidden = true;
  $('#demo-accounts strong').textContent = 'CHOOSE A DEMO ROLE';
  $('#demo-accounts p').textContent = 'Explore the workflow without signing in. These are simulated roles, not real employee accounts.';
  $('#logout').textContent = 'Change demo role ↗';
  $('#publish').textContent = 'Update browser preview ↗';
  $('#confirm-publish h2').textContent = 'Update your browser preview?';
  $('#confirm-publish p').textContent = 'This saves a local demonstration copy for this browser only. It does not change the live website or send anything to a server. A previous local version is kept for undo.';
  $('#confirm-publish-button').textContent = 'Update preview ↗';
  document.querySelectorAll('a[href="./index.html"]').forEach(link => { link.href = './index.html?staff-demo=1'; });
  $('#reset-browser-demo').addEventListener('click', async () => {
    if (!confirm('Reset this browser’s demo content, drafts, and history? This does not affect the real website.')) return;
    try {
      await api('/demo/reset', 'POST'); user = null; state = null; content = null;
      $('#editor-panel').hidden = true; $('#account').hidden = true; $('#login-panel').hidden = false;
      message('Browser demo reset. Choose a role to start again.');
    } catch (error) { message(error.message, true); }
  });
}
try {
  const health = await api('/health');
  $('#environment').textContent = browserDemo ? 'BROWSER DEMO · NOT A LIVE CMS' : health.demo ? 'LOCAL DEMO · NOT PRODUCTION' : 'CONNECTED TO CMS';
  $('#demo-accounts').hidden = !health.demo;
  try { const result = await api('/me'); user = result.user; await loadEditor(); } catch (error) { if (user) message(error.message, true); }
} catch (error) {
  $('#environment').textContent = 'BACKEND OFFLINE'; $('#offline').hidden = false;
  $('#login-form').querySelectorAll('input,button').forEach(element => { element.disabled = true; });
}

}
initialize();
