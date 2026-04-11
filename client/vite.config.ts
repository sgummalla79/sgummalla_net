import { resolve } from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import UnoCSS from "unocss/vite";

export default defineConfig({
  plugins: [vue(), UnoCSS()],

  resolve: {
    alias: {
      // Resolve @vzen/ui from source in dev — no build step required
      "@vzen/ui": resolve(__dirname, "../packages/ui/src/index.ts"),
      "@": resolve(__dirname, "src"),
    },
  },

  server: {
    port: 5173,
    proxy: {
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
