import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

/**
 * The Kite OAuth backend (`server/`) runs separately — see server/README.md.
 * Everything under /api is proxied there so the browser stays same-origin and
 * the session cookie set by the callback is actually kept.
 */
const BACKEND = process.env.TRADEPULSE_API_URL ?? "http://127.0.0.1:8787";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 5273,
    proxy: {
      "/api": { target: BACKEND, changeOrigin: false },
    },
  },
});
