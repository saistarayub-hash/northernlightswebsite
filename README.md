# Northern Lights / Lightkeeper

An immersive Northern Lights brand website, an original **branded-merchandise store prototype**, and **Lightkeeper**, the staff studio for website content, merchandise, and demo orders. The store is limited to apparel, art prints, and stickers. No cannabis sales, real payments, or actual fulfilment are implemented.

## Run the complete local demo

Requires Node.js 22+.

```sh
npm ci
npm run api:demo  # terminal 1: API on port 3001
npm run dev       # terminal 2: website on port 5173
```

Open `/staff.html` on the **website** server. After a `VITE_CMS_ENABLED=true npm run build`, the demo API also serves the built studio directly at its root (port 3001), with the public site at `/index.html`. The public website also has a Staff Studio link in its footer when the API is connected. Vite proxies browser requests at `/api` to the backend; browser code never connects to localhost directly.

The login screen includes **Try as owner** and **Try as staff** buttons, available only when the API reports demo mode. These are public sample identities, not real employee accounts. Do not enter private information in the demo. Keep `CMS_DEMO=true` strictly for development.

### Website editing flows

- Edit hours, announcements, and up to 20 FAQs; hide FAQs without deleting them.
- Tap a section in the live phone content preview to edit it.
- Compare published content and the draft, with before/after differences.
- Save a draft without changing the website.
- Staff submit drafts for review; only the owner can publish or restore.
- Expiring announcements are excluded by the public API; an already-open page hides them when their expiry passes.
- Last 30 publications and 100 activity entries are retained. Restore copies a prior publication to draft; publishing it is a separate, confirmed action.
- Revision checks prevent accidental overwrites from multiple editors.
- Public content updates on page load. The phone preview is a content representation, not an exact screenshot.

### Merchandise store flows

Open `/shop.html` for the storefront and `/merch-admin.html` for the merchandise desk. The brand homepage and Lightkeeper sidebar link to both.

- Original SVG mockups for the After Dark Tee, Night Shift Hoodie, an aurora print, and a sticker set. All are explicitly labelled design concepts; specifications, inventory, and prices are illustrative.
- Category filters, search, price sorting, product detail dialogs, sizes/options, local shopping bag, quantity changes, and removal.
- Demo customer registration/sign-in and private order history. Use fictional email/name details and a unique test password. To test shopper and staff simultaneously, use separate browser profiles/private windows; each origin has one active session.
- Demo checkout checks prices, quantities, product visibility, option availability, and inventory on the server. It uses integer cents and an idempotency key to prevent duplicate submissions. No payment or address fields exist.
- The stock deduction and order snapshot are saved together in the prototype's single-process atomic store. Historical order names/prices are preserved when the catalog changes.
- Signed-in staff can open a product on the public store and use **Staff shortcut: edit this design** to jump directly into that design’s editor.
- Staff can add/edit merchandise, stock, price, and options. They can hide and restore designs instead of deleting records. Unlike website copy drafts, merchandise edits apply immediately to the demo catalog.
- Up to 100 designs, 12 options/design, 20 cart lines, and 10 units/option per checkout. Options referenced by existing non-cancelled orders cannot be removed/renamed.
- Staff order desk: pending → packed → complete, or pending/packed → cancelled. Cancellation restores sample inventory exactly once. These actions trigger no actual shipment, email, or refund.
- Production deliberately starts with an empty catalog and blocks customer registration and checkout. Do not turn on demo mode to accept real orders; implement a production commerce service first.

The merchandise store is **a functional local demo, not a live payment-enabled business**. There is no automatic migration from fake customer accounts/orders to production.

### Current implementation and limits

The API uses Express, salted scrypt password hashes, random server-side sessions, HttpOnly/SameSite cookies, a custom request header for mutation protection, input validation, and login rate limiting. Production cookies are Secure. No passwords or session tokens are stored in browser localStorage.

Content, merchandise, sample orders, hashed credentials, and history persist in an atomic JSON file under `.cms-data/` (ignored by Git). Sessions and rate-limit counters are memory-only and reset when the server restarts. This is a **single-process prototype**, not a horizontally scalable CMS. Do not run multiple API instances against the same data directory. Staff changes are shared across everyone using the local demo.

Not yet implemented: photo uploads, account invitations/removal, password reset/rotation UI, MFA, email review notifications, automated off-site backups, monitoring, or a managed database. Browser rendering tests could not run because the Chromium download was unavailable; API and DOM interaction tests pass.

## Testing

```sh
npm test
npm run build
GITHUB_PAGES=true npm run build
```

Node tests cover authentication, access control, persistence, validation, expired notices, stale revisions, review/publish/restore, logout, and rate limiting. A jsdom interaction test drives the actual staff UI against a temporary API, checks the owner/staff workflows, and verifies user content is rendered as text, not HTML. Merchandise tests additionally cover registration, customer/staff isolation, server-side totals, stale prices and inventory, hidden products, option validation, idempotent checkout, order-history isolation, cancellation/restocking, and production checkout being disabled. A second DOM interaction test runs browsing, cart, account creation, repeat orders, staff price edits, visibility changes, and cancellation. Test data is created in temporary directories and removed afterward.

## Full-stack hosting on the client domain

GitHub Pages is a static preview only. A custom domain alone does not provide the staff backend. Use a Node host with HTTPS and a persistent volume, or migrate this prototype to managed database/auth services before handover.

Build with CMS support:

```sh
VITE_CMS_ENABLED=true npm run build
```

Configure secrets in the host's secret manager (not Git or browser code):

- `CMS_DATA_DIR`: persistent directory, separate from demo data.
- `CMS_OWNER_EMAIL`, `CMS_OWNER_PASSWORD`: initial owner identity; password at least 12 characters.
- Optional `CMS_STAFF_EMAIL`, `CMS_STAFF_PASSWORD`: separate initial staff identity; password at least 12 characters.
- `PORT`: host-specified port; defaults to 3001.

Then run `npm start`. Express serves the built public website, `/shop.html`, `/staff.html`, `/merch-admin.html`, and `/api` on one origin. Terminate TLS at the host's reverse proxy. The server trusts one proxy hop; verify this against the chosen hosting platform. Keep the API inaccessible over plain public HTTP.

Production refuses to use a demo data directory and never enables demo accounts, even if `CMS_DEMO=true` is present. Initial credentials are only used when creating a fresh data directory, not to rotate existing passwords. Sessions expire after eight hours. On startup the production service requires real initial owner credentials unless an existing production store is present.

**Before client handover:** choose production hosting; migrate/approve data; implement individual account lifecycle and recovery; configure and test backups; review privacy and security; confirm real business details, merchandise specifications/prices, and logo; implement provider-backed payments and verified webhooks, shipping, tax/invoicing, approved return/refund policies, email confirmation, and transactional inventory; test mobile browsers and accessibility; connect DNS and TLS. The working local editor is not a production-security certification.

## GitHub Pages preview

https://saistarayub-hash.github.io/northernlightswebsite/

`.github/workflows/pages.yml` builds pushes to `arena/01a0dc86-northernlightswebsite`. The public Pages build uses static information and does not connect to a CMS. `/staff.html` explains that its backend is unavailable on static hosting. Production staff credentials and local content are never published by this workflow. The sample demo passwords appear only as public prototype conveniences and are never valid in production. `/shop.html` has a static sample-catalog fallback, with account creation and checkout disabled when the API is absent.

## Brand and business references

Visual branding and editorial copy are provisional. The neon SVG interprets the user's supplied sign photograph; it is not the original logo. The original image was visible in chat but unavailable in the workspace.

- Name/location: https://www.facebook.com/northernlightsherbalwellness/
- Directory-listed address: https://www.fresha.com/lvp/northern-lights-herbal-wellness-protea-avenue-lenasia-Ly9vJA
- Consulted September 26, 2026. Address awaits owner confirmation; business approval and official contact details remain outstanding.

Google Fonts serves the typefaces. No analytics are installed. The connected backend stores sample customer identities and orders, staff accounts, and edit history, and sets essential authentication cookies. The merchandise bag and pending checkout retry key are stored in browser localStorage. No card details or shipping addresses are collected. Use fictional customer information and passwords that are not used elsewhere. Brand and merchandise design preview only.
