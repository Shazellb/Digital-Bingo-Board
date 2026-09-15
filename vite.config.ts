import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/Digital-Bingo-Board/',
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
      injectRegister: 'script',
      includeAssets: ['icons/favicon-32.png', 'icons/apple-touch-icon.png'],
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
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
      },
    }),
  ],
});
