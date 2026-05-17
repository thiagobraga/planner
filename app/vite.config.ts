import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
/// <reference types="vitest" />

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts: ["planner.local"],
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
