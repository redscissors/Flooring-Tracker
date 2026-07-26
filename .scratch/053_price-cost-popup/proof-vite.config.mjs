import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Run from the repo root: npx vite build --config .scratch/053_price-cost-popup/proof-vite.config.mjs
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    // Screenshot target only — delete proof-dist after; never committed.
    outDir: ".scratch/053_price-cost-popup/proof-dist",
    emptyOutDir: true,
    rollupOptions: { input: ".scratch/053_price-cost-popup/proof.html" },
  },
});
