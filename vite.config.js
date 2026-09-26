import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/northernlightswebsite/' : '/',
  build: { rollupOptions: { input: { main: resolve('index.html'), staff: resolve('staff.html'), shop: resolve('shop.html'), merchandise: resolve('merch-admin.html') } } },
  server: {
    host: '0.0.0.0', allowedHosts: ['.e2b.app'],
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
});
