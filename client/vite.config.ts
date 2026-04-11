import { resolve } from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import UnoCSS from "unocss/vite";

export default defineConfig({
  plugins: [vue(), UnoCSS()],

  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },

  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to Express in dev — avoids CORS issues
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
      },
    },
  },

  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
