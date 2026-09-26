import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { sampleProducts, money, categories } from '../src/merch-data.js';
export function appWindow(htmlFile, scriptFile, url) {
  const dom = new JSDOM(readFileSync(htmlFile, 'utf8'), { url: `${url}/${htmlFile}`, runScripts: 'outside-only' });
  const { window } = dom;
  let cookie = '';
  window.structuredClone = structuredClone;
  window.confirm = () => true;
  window.matchMedia = () => ({ matches: true });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  window.fetch = async (route, options = {}) => {
    const response = await fetch(new URL(route, url), { ...options, headers: { ...options.headers, Cookie: cookie } });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return response;
  };
  window.sampleProducts = structuredClone(sampleProducts); window.money = money; window.categories = categories;
  const source = readFileSync(scriptFile, 'utf8').replace(/^import .*?;\n/gm, '').replaceAll('import.meta.env.BASE_URL', "'/'");
  window.eval(source);
  return { dom, window, $: selector => window.document.querySelector(selector) };
}
export function waitFor(window, check, timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (check()) return resolve();
    const observer = new window.MutationObserver(() => { if (check()) { clearTimeout(timer); observer.disconnect(); resolve(); } });
    observer.observe(window.document, { subtree: true, childList: true, attributes: true, characterData: true });
    const timer = setTimeout(() => { observer.disconnect(); reject(new Error(`UI condition not met: ${check.toString()}\nMessages: ${['#message', '#account-message', '#cart-message', '#checkout-message', '#editor-message'].map(selector => window.document.querySelector(selector)?.textContent || '').join(' | ')}`)); }, timeout);
  });
}
