import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Run from the repo root: npx vite build --config .scratch/054_quick-markups-settings/proof-vite.config.mjs
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    // Screenshot target only — delete proof-dist after; never committed.
    outDir: ".scratch/054_quick-markups-settings/proof-dist",
    emptyOutDir: true,
    rollupOptions: { input: ".scratch/054_quick-markups-settings/proof.html" },
  },
});
