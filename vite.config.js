import { defineConfig } from 'vite';
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/northernlightswebsite/' : '/',
  server: { host: '0.0.0.0', allowedHosts: ['.e2b.app'] },
});
