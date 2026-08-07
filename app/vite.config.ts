import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
/// <reference types="vitest" />

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: false,
      injectRegister: false,
      workbox: {
        // vite-plugin-pwa only auto-sets skipWaiting/clientsClaim for
        // registerType "autoUpdate" when injectRegister is left at its
        // default - injectRegister: false (needed so main.tsx can call
        // registerSW itself) silently opts back out of that wiring. Without
        // it, a new SW installs but sits in "waiting" forever: the old SW
        // stays active and keeps intercepting every navigation, so no
        // number of plain reloads picks up a new deploy, only a hard
        // refresh (which bypasses the SW's fetch handler outright).
        skipWaiting: true,
        clientsClaim: true,
        // html excluded: precaching index.html makes navigations resolve
        // against the SW's precache (revision bumps only on SW activation),
        // so a plain reload right after deploy can still serve the old
        // shell from a not-yet-activated SW. Leaving html out sends every
        // navigation to the network, where nginx's no-cache header on /
        // already guarantees a fresh index.html.
        globPatterns: ['**/*.{js,css,svg,png,ico,woff2}'],
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  // Disable CSS minification (lightningcss) during CI hooks to avoid native
  // binary platform mismatches inside the hook's docker environment. Vite
  // still builds JS and bundles CSS; production builds in CI should enable
  // minification separately if desired.
  build: {
    minify: false,
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts: [".planner.local", "planner.local"],
    watch: {
      usePolling: true,
    },
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL ?? "http://localhost:4000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: process.env.VITE_API_URL ?? "http://localhost:4000",
        ws: true,
      },
    },
  },
});
