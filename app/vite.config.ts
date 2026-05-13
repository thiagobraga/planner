import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
    watch: {
      usePolling: true,
    },
    proxy: {
      "/api": {
        target: "http://api:4000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://api:4000",
        ws: true,
      },
    },
  },
});
