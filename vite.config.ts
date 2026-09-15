import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const buildCommit = (process.env.GITHUB_SHA ?? execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()).slice(0, 7);
const buildDate = new Date().toISOString().slice(0, 10);

export default defineConfig({
  base: '/Digital-Bingo-Board/',
  define: {
    __BUILD_COMMIT__: JSON.stringify(buildCommit),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        display: resolve(import.meta.dirname, 'display.html'),
        controller: resolve(import.meta.dirname, 'controller.html'),
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: [],
      manifest: {
        name: 'Digital Bingo Board',
        short_name: 'Bingo Board',
        description: 'A digital bingo switchboard: Controller and Display views for running a live bingo game.',
        start_url: '.',
        scope: '.',
        display: 'fullscreen',
        orientation: 'any',
        background_color: '#0b1224',
        theme_color: '#0b1224',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        importScripts: ['sw-update-bridge.js'],
        navigateFallback: null,
        globPatterns: ['**/*.{js,css,png,svg,ico,mp3,webmanifest}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-shells',
              networkTimeoutSeconds: 5,
              fetchOptions: { cache: 'no-store' },
              expiration: { maxEntries: 6 },
            },
          },
        ],
      },
    }),
  ],
});
