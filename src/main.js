const products = [
  { id:'sodaze-soda', category:'edibles', name:'Sodaze Craft Soda', brand:'SODAZE', tag:'SODAZE / CRAFT SODA', image:'/images/front-can.webp', description:'Infused craft soda range — flavours include Berry Haze, Tropical Punch, Cherry Lemonade and Orange Cream. Confirm current flavours and stock in store.', note:'FEATURED BRAND' },
  { id:'sodaze-preroll', category:'flower', name:'Sodaze Prerolls', brand:'SODAZE', tag:'SODAZE / PREROLLS', image:'/images/preroll.jpg', description:'Rolled 1g prerolls by Sodaze. Strain availability changes — ask the counter what is in the jar today.', note:'FEATURED BRAND' },
  { id:'aurora', category:'flower', name:'Northern Flower', brand:'NL HOUSE', tag:'FLOWER / JARS', image:'/images/flower.jpg', description:'Deli flower and sealed jars on the flower wall. Strains, weights and pricing are confirmed in store.', note:'IN STORE RANGE' },
  { id:'moonrock', category:'flower', name:'House Prerolls', brand:'NL HOUSE', tag:'FLOWER / PREROLLS', image:'/images/preroll.jpg', description:'Hand-rolled prerolls from the Northern Lights counter — the quick stop on the way through.', note:'IN STORE RANGE' },
  { id:'planet-pen', category:'concentrates', name:'10th Planet Dab Pen', brand:'10TH PLANET', tag:'10TH PLANET / VAPES', image:'/images/pen.jpg', description:'Disposable dab pens and vape hardware from 10th Planet. Device specs and flavour list to be confirmed.', note:'FEATURED BRAND' },
  { id:'glacier', category:'concentrates', name:'Dab Jars + Concentrates', brand:'NL HOUSE', tag:'DABS / CONCENTRATES', image:'/images/dab.jpg', description:'The dab shelf — extracts, jars and the tools that go with them. Compliance details are supplied in store.', note:'IN STORE RANGE' },
  { id:'aurora-bong', category:'glass', name:'Aurora Recycler', brand:'GLASS', tag:'GLASS / WATER PIPES', image:'/images/bong.jpg', description:'Sculptural glass for the display wall — recyclers, beakers and rigs. Ask about what is currently on the shelf.', note:'GLASS DISPLAY' },
  { id:'night-bong', category:'glass', name:'Nightfall Beaker', brand:'GLASS', tag:'GLASS / BEAKERS', image:'/images/bong.jpg', description:'Classic beaker silhouettes in clear and smoked glass, sized for every counter.', note:'GLASS DISPLAY' },
  { id:'gummies', category:'edibles', name:'Infused Gummies', brand:'EDIBLES', tag:'EDIBLES / SWEETS', image:'/images/edibles.jpg', description:'Infused gummy packets and sweets, kept behind the counter with dosage information.', note:'IN STORE RANGE' },
  { id:'toolkit', category:'accessories', name:'Counter Essentials', brand:'ACCESSORIES', tag:'ACCESSORIES / KITS', image:'/images/accessories.jpg', description:'Grinders, papers, jars, tools and the everyday essentials that go with the ritual.', note:'IN STORE RANGE' },
  { id:'stash', category:'accessories', name:'Signal Stash Jar', brand:'NL HOUSE', tag:'ACCESSORIES / STORAGE', image:'/images/accessories.jpg', description:'Reusable glass storage jars with the Northern Lights signal on the label.', note:'ACCESSORIES CONCEPT' },
  { id:'drinks', category:'edibles', name:'Fridge Drinks', brand:'SODAZE', tag:'DRINKS / COLD', image:'/images/front-can.webp', description:'The cold fridge at the front of the room — infused sodas and soft drinks to take away.', note:'FEATURED BRAND' },
];
const grid = document.querySelector('#product-grid');
const count = document.querySelector('#catalog-count');
const dialog = document.querySelector('#product-dialog');
const dialogContent = document.querySelector('#dialog-content');
function renderProducts(filter='all') {
  const visible = products.filter(p => filter === 'all' || p.category === filter);
  count.textContent = `${String(visible.length).padStart(2,'0')} ITEMS`;
  grid.replaceChildren(...visible.map((p, index) => {
    const article = document.createElement('article'); article.className = 'product-card'; article.style.setProperty('--delay', `${index * 55}ms`);
    article.innerHTML = `<button class="product-button" aria-label="View ${p.name}"><div class="product-visual"><img src="${p.image}" alt="${p.name}" loading="lazy"><span class="visual-brand">${p.brand}</span></div><div class="product-meta"><span>${p.tag}</span><b>↗</b></div><h3>${p.name}</h3><p>${p.note}</p></button>`;
    article.querySelector('button').addEventListener('click', () => openProduct(p)); return article;
  }));
}
function openProduct(product) {
  dialogContent.innerHTML = `<div class="dialog-visual"><img src="${product.image}" alt="${product.name}"></div><p class="eyebrow">${product.tag}</p><h2>${product.name}</h2><p>${product.description}</p><div class="catalog-notice"><b>CATALOG PREVIEW</b><span>This display does not take orders or payments. Confirm current stock, pricing and details directly with the dispensary.</span></div>`;
  dialog.showModal();
}
document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('.filter').forEach(b => b.classList.remove('active')); button.classList.add('active'); renderProducts(button.dataset.filter); }));
document.querySelector('#close-product').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
const menu = document.querySelector('.menu-toggle'); const nav = document.querySelector('nav');
menu.addEventListener('click', () => { const open = nav.classList.toggle('open'); menu.setAttribute('aria-expanded', String(open)); menu.textContent = open ? '×' : '☰'; });
nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { nav.classList.remove('open'); menu.textContent = '☰'; }));
renderProducts();
// Brand cards hand a spotlight request to the 3D scene.
document.querySelectorAll('[data-focus]').forEach(button => button.addEventListener('click', () => {
  window.dispatchEvent(new CustomEvent('nl:focus-product', { detail: button.dataset.focus }));
  document.querySelector('#product-stage').scrollIntoView({ behavior:'smooth', block:'center' });
}));
// The 3D shop floor loads after the page so the catalog and copy render first.
import('./scene3d.js').catch(() => document.body.classList.add('stage-fallback'));
document.body.classList.add('stage-ready');
// Dynamic informational content is opt-in on a full-stack host; the catalog remains useful without it.
if (import.meta.env.DEV || import.meta.env.VITE_CMS_ENABLED === 'true') {
  fetch('/api/content', { credentials:'same-origin' }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(content => {
    if (content.announcement.visible) { const notice = document.querySelector('#cms-notice'); notice.textContent = content.announcement.text; notice.hidden = false; }
    const hours = document.querySelector('#cms-hours'); const heading = document.createElement('h3'); heading.textContent = 'Opening hours'; const text = document.createElement('p'); text.textContent = content.hours; hours.replaceChildren(heading,text); hours.hidden = false; document.querySelector('#fallback-hours-faq').hidden = true;
    const faqs = document.querySelector('#cms-team-faqs'); if (content.faqs.length) { const title = document.createElement('h3'); title.textContent = 'From the team'; faqs.append(title,...content.faqs.map(f => { const d=document.createElement('details'); const s=document.createElement('summary'); s.textContent=f.question; const p=document.createElement('p'); p.textContent=f.answer; d.append(s,p); return d; })); faqs.hidden=false; }
  }).catch(() => {});
}
