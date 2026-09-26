# Northern Lights

An immersive, informational brand concept built with Vite, vanilla JavaScript, CSS dimensional artwork, and a Canvas aurora background. Visual branding and editorial copy are provisional. The business name and Lenasia location are corroborated by public listings; the directory-listed street address awaits owner confirmation.

## Run

```sh
npm install
npm run dev
```

## Production

```sh
npm run build
npm run preview
```

Includes responsive layouts, pointer-reactive artwork, optional synthesized ambient sound, reduced-motion support, keyboard-accessible navigation and a preview information dialog. No commerce, account system, analytics, or personal data collection is implemented. Fonts load from Google Fonts with local fallback fonts.

## Business references

- Name/location: https://www.facebook.com/northernlightsherbalwellness/
- Directory-listed address: https://www.fresha.com/lvp/northern-lights-herbal-wellness-protea-avenue-lenasia-Ly9vJA
- References consulted September 26, 2026. Hours, phone, logo, and business approval remain unconfirmed.

## GitHub Pages preview

The workflow `.github/workflows/pages.yml` builds and deploys pushes to `arena/01a0dc86-northernlightswebsite`. No separate deployment branch is needed.

One-time setup by a repository administrator:

1. Open **Settings → Pages → Build and deployment** and select **GitHub Actions** as the source.
2. If the `github-pages` environment restricts deployment branches, allow `arena/01a0dc86-northernlightswebsite` under **Settings → Environments → github-pages**.
3. Open **Actions → Deploy Northern Lights preview** and rerun the latest run after enabling Pages. If no run exists, push another commit on the session branch.
4. After successful deployment, the expected URL is https://saistarayub-hash.github.io/northernlightswebsite/ . This URL is not confirmed live until deployment succeeds.

The connected integration could not enable Pages (HTTP 403: Resource not accessible by integration). Repository visibility has not been changed.

Test the project-path build locally with `GITHUB_PAGES=true npm run build`. Vite rewrites image, stylesheet, and script URLs for `/northernlightswebsite/`.

## Preview scope

Includes dimensional neon artwork interpreted from the user's sign photo, aurora canvas, responsive navigation, FAQ, privacy information, sound and motion controls. Original photo was visible in chat but unavailable as a workspace asset, so the SVG is explicitly an interpretation. This is an informational design preview, not a business-approved production site or transactional application.
