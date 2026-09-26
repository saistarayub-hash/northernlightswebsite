# Northern Lights / Lightkeeper

A 3D dispensary storefront concept for **Northern Lights Herbal Wellness, Lenasia**: an interactive Three.js product stage, a browsable catalog of flower, prerolls, dabs, vapes, glass, edibles and accessories, plus a working local staff editor.

This is a **visual catalog**, not a transactional shop. There is no ordering, cart, checkout, delivery, payment processing or customer registration — in the UI or in the API. Stock, strains, flavours and pricing are confirmed in store.

## 3D storefront

- `src/scene3d.js` builds the interactive shop floor with Three.js: a rotating Sodaze can on the centre pedestal, six product stations (Sodaze preroll, 10th Planet dab pen, house dab jar, glass, flower jar, gummies), photo backdrop, aurora particles and bloom.
- Drag to orbit, tap a product to spotlight it. Brand cards on the page dispatch `nl:focus-product` to spotlight a product in 3D.
- The scene is code-split and loaded after first paint; on low-power devices transmission glass, bloom and particle counts are reduced, reduced-motion disables auto-rotation, and a CSS fallback shows if WebGL is unavailable.

## Imagery

Product, interior and brand imagery in `public/images/` is **AI-generated placeholder art** created for this preview, not photography of the real store and not the brands' official artwork. The Sodaze can treatment is an interpretation based on a reference image supplied in the build chat. Replace with licensed brand assets and the dispensary's own photography before publishing. Brand names are shown descriptively to indicate products the store stocks.

## Local development

Requires Node.js 22+.

```sh
npm ci
npm run api:demo  # terminal 1: backend on 3001
npm run dev       # terminal 2: website on 5173
```

- Public website: `/index.html`
- Staff studio: `/staff.html`
- Vite proxies `/api` to the backend; browser code uses same-origin relative requests.

The staff login has **Try as owner** and **Try as staff** buttons when the backend is explicitly in demo mode. Use only test data. Open the preview in a new tab for session-cookie compatibility.

To serve a built preview from the backend:

```sh
VITE_CMS_ENABLED=true npm run build
npm run api:demo
```

The demo backend root opens the staff studio; `/index.html` opens the public site.

## Working staff features

- Opening hours, announcements, and up to 20 FAQs.
- Tap-to-edit phone content preview and before/after comparison.
- Hide FAQs without losing their content.
- Scheduled notice expiry.
- Save draft → request owner review → owner publishes.
- Publication history, restore-to-draft, and audit trail.
- Revision checks to protect against stale edits.

No photo uploader, invitations, or password-recovery interface is implemented yet. The phone preview represents content, not an exact screenshot.

## Implementation and limits

Express backend with salted scrypt password hashes, random server-side sessions, HttpOnly/SameSite cookies, a custom mutation header, input validation, and login rate limiting. Production cookies are Secure. Passwords and session tokens are not stored in browser localStorage.

Data is stored in `.cms-data/cms.json`, ignored by Git, with atomic file replacement. This is a single-process prototype: do not run multiple instances against the same file. Sessions and rate-limit counters are in memory and reset on restart. Existing local demo data from retired features is preserved on disk but not exposed by active API routes. The obsolete merchandise-cart browser keys are no longer used by the site.

Before production, implement proper account lifecycle/recovery, backups, monitoring, a scalable data store if needed, privacy review, and browser/accessibility testing. This prototype is not a production-security certification.

## Tests and builds

```sh
npm test
npm run build
GITHUB_PAGES=true npm run build
```

Tests cover staff authentication and roles, draft/review/publication/restoration, persistence, notice expiry, revision conflicts, logout, and rate limiting. A jsdom interaction test exercises the actual editor against a temporary backend. Browser-rendering tests remain outstanding because the Chromium download was unavailable.

## Client hosting and domain

The custom domain will connect to a full-stack Node host with HTTPS and persistent storage, not just GitHub Pages.

Build with `VITE_CMS_ENABLED=true npm run build`. Configure the following through the hosting provider's secret manager:

- `CMS_DATA_DIR`: persistent production directory, separate from demo data.
- `CMS_OWNER_EMAIL` and `CMS_OWNER_PASSWORD`: initial owner; password at least 12 characters.
- Optional `CMS_STAFF_EMAIL` and `CMS_STAFF_PASSWORD`: separate initial staff identity.
- `PORT`: host-provided port, defaults to 3001.

Run `npm start`. Express serves `dist` and `/api` on one origin. Terminate TLS through the host's reverse proxy; the server trusts one proxy hop. Demo accounts and demo data stores are rejected in production. Environment credentials initialize a new store only; they do not rotate existing passwords.

## Static GitHub preview

https://saistarayub-hash.github.io/northernlightswebsite/

The workflow tests, builds, and deploys the session branch `arena/01a0dc86-northernlightswebsite`. GitHub Pages shows the static brand site; the staff editor requires the local or production backend. The local data store is never deployed.

## Branding and verification

The neon SVG is an interpretation of the user's sign photograph, not the original logo file. Editorial copy and design remain provisional.

- Business name/location: https://www.facebook.com/northernlightsherbalwellness/
- Directory-listed address: https://www.fresha.com/lvp/northern-lights-herbal-wellness-protea-avenue-lenasia-Ly9vJA
- Sources consulted September 26, 2026. Address, opening hours, contact details, and final content require business approval.

Google Fonts serves the typefaces. There are no public customer forms or analytics. Staff authentication uses an essential cookie, and the backend stores staff identity and edit history.
