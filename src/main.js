const products = [
  { id:'aurora', category:'flower', name:'Aurora Flower', tag:'FLOWER / 01', description:'A visual catalog placeholder for a Northern Lights flower selection. Final strain, weight and availability require confirmation.', shape:'bud', note:'DETAILS TO BE CONFIRMED' },
  { id:'moonrock', category:'flower', name:'Moonrock Reserve', tag:'FLOWER / 02', description:'A premium shelf concept for a high-end flower collection, presented as a design sample only.', shape:'bud deep', note:'DETAILS TO BE CONFIRMED' },
  { id:'glacier', category:'concentrates', name:'Glacier Glass', tag:'DABS / 01', description:'A display card for concentrates and dab products. Product specifications and compliance information are not yet supplied.', shape:'jar', note:'CATALOG CONCEPT' },
  { id:'northern', category:'concentrates', name:'Northern Extract', tag:'DABS / 02', description:'A luminous concentrate concept for the green room. Not available for purchase through this preview.', shape:'jar amber', note:'CATALOG CONCEPT' },
  { id:'aurora-bong', category:'glass', name:'Aurora Recycler', tag:'GLASS / 01', description:'A sculptural glass piece for the display wall. Material, dimensions and price are awaiting confirmation.', shape:'bong', note:'GLASS DISPLAY' },
  { id:'night-bong', category:'glass', name:'Nightfall Beaker', tag:'GLASS / 02', description:'A deep-green beaker silhouette imagined for the Northern Lights glass collection.', shape:'bong dark', note:'GLASS DISPLAY' },
  { id:'toolkit', category:'accessories', name:'The Lightkeeper Kit', tag:'ACCESSORIES / 01', description:'A tidy accessory set concept for the counter: storage, tools and everyday essentials.', shape:'kit', note:'ACCESSORIES CONCEPT' },
  { id:'stash', category:'accessories', name:'Signal Stash Jar', tag:'ACCESSORIES / 02', description:'A reusable storage object concept with the Northern Lights signal built into the label.', shape:'jar green', note:'ACCESSORIES CONCEPT' },
];
const grid = document.querySelector('#product-grid');
const count = document.querySelector('#catalog-count');
const dialog = document.querySelector('#product-dialog');
const dialogContent = document.querySelector('#dialog-content');
function renderProducts(filter='all') {
  const visible = products.filter(p => filter === 'all' || p.category === filter);
  count.textContent = `${String(visible.length).padStart(2,'0')} PIECES`;
  grid.replaceChildren(...visible.map((p, index) => {
    const article = document.createElement('article'); article.className = 'product-card'; article.style.setProperty('--delay', `${index * 70}ms`);
    article.innerHTML = `<button class="product-button" aria-label="View ${p.name}"><div class="product-visual ${p.shape}"><span class="visual-glow"></span><span class="visual-mark">NL</span></div><div class="product-meta"><span>${p.tag}</span><b>↗</b></div><h3>${p.name}</h3><p>${p.note}</p></button>`;
    article.querySelector('button').addEventListener('click', () => openProduct(p)); return article;
  }));
}
function openProduct(product) {
  dialogContent.innerHTML = `<div class="dialog-visual product-visual ${product.shape}"><span class="visual-glow"></span><span class="visual-mark">NL</span></div><p class="eyebrow">${product.tag}</p><h2>${product.name}</h2><p>${product.description}</p><div class="catalog-notice"><b>CATALOG PREVIEW</b><span>This display does not take orders or payments. Confirm current stock and details directly with the dispensary.</span></div>`;
  dialog.showModal();
}
document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('.filter').forEach(b => b.classList.remove('active')); button.classList.add('active'); renderProducts(button.dataset.filter); }));
document.querySelector('#close-product').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
const menu = document.querySelector('.menu-toggle'); const nav = document.querySelector('nav');
menu.addEventListener('click', () => { const open = nav.classList.toggle('open'); menu.setAttribute('aria-expanded', String(open)); menu.textContent = open ? '×' : '☰'; });
nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { nav.classList.remove('open'); menu.textContent = '☰'; }));
renderProducts();
// Dynamic informational content is opt-in on a full-stack host; the catalog remains useful without it.
if (import.meta.env.DEV || import.meta.env.VITE_CMS_ENABLED === 'true') {
  fetch('/api/content', { credentials:'same-origin' }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(content => {
    if (content.announcement.visible) { const notice = document.querySelector('#cms-notice'); notice.textContent = content.announcement.text; notice.hidden = false; }
    const hours = document.querySelector('#cms-hours'); const heading = document.createElement('h3'); heading.textContent = 'Opening hours'; const text = document.createElement('p'); text.textContent = content.hours; hours.replaceChildren(heading,text); hours.hidden = false; document.querySelector('#fallback-hours-faq').hidden = true;
    const faqs = document.querySelector('#cms-team-faqs'); if (content.faqs.length) { const title = document.createElement('h3'); title.textContent = 'From the team'; faqs.append(title,...content.faqs.map(f => { const d=document.createElement('details'); const s=document.createElement('summary'); s.textContent=f.question; const p=document.createElement('p'); p.textContent=f.answer; d.append(s,p); return d; })); faqs.hidden=false; }
  }).catch(() => {});
}
