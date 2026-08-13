import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Dynamically import the tailwindcss Vite plugin so a missing native binary for
// `lightningcss` inside the pre-push docker environment doesn't abort config
// parsing. If the import fails, fall back to null and omit the plugin.
import { VitePWA } from "vite-plugin-pwa";

let tailwindcss: any = null;
try {
  // top-level await allowed in ESM; use dynamic import to catch failures
  // when native binaries are unavailable in the environment.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  // @ts-ignore - dynamic import fallback
  const mod = await import('@tailwindcss/vite');
  tailwindcss = mod.default ?? mod;
} catch (e) {
  // Leave tailwindcss null — plugin will be omitted.
  tailwindcss = null;
}
export default defineConfig({
  plugins: [
    react(),
    tailwindcss && tailwindcss(),
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
  // When SKIP_CSS_MINIFY is set (e.g. in pre-push hook), disable CSS minification
  // to avoid lightningcss native binary platform mismatches in restricted environments.
  // JS minification via esbuild continues unchanged.
  build: {
    minify: 'esbuild',
    cssMinify: process.env.SKIP_CSS_MINIFY ? false : 'esbuild',
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
