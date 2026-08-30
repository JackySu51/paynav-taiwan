import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// 部署在子路徑時（例如 GitHub Pages 的 /paynav-taiwan/），用環境變數指定：
//   VITE_BASE=/paynav-taiwan/ npm run build
// Cloudflare Pages 或自有網域放在根目錄，保持預設 '/' 就好。
const base = process.env.VITE_BASE ?? '/';

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'data/*.json'],
      manifest: {
        id: base,
        name: '好付神卡 CardVsPay',
        short_name: '好付神卡',
        description: '走進店裡三秒知道刷哪張最划算。離線可用，資料只存在你的手機。',
        lang: 'zh-Hant-TW',
        dir: 'ltr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#EEF2FF',
        theme_color: '#4640DE',
        categories: ['finance', 'shopping', 'utilities'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            /**
             * 地標包不要進 Cache Storage。
             * 下載後我們已經自己存進 IndexedDB，
             * 讓 Workbox 再快取一份等於同一份資料佔兩倍空間，
             * 而且 maxEntries 一滿還會把包默默淘汰掉。
             */
            urlPattern: ({ url }) =>
              url.pathname.includes('/data/packs/') && !url.pathname.endsWith('index.json'),
            handler: 'NetworkOnly',
          },
          {
            // 規則庫、門市庫、地標包目錄：先讀快取立即上畫面，背景再更新
            urlPattern: ({ url }) => url.pathname.includes('/data/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'paynav-dataset',
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
        type: 'module',
      },
    }),
  ],
  build: {
    target: 'es2020',
    sourcemap: false,
  },
  server: {
    host: true,
    port: 5173,
  },
});
