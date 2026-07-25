import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Run from the repo root: npx vite build --config .scratch/051_print-area-name-hallmark-size/proof-vite.config.mjs
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    // Build target for the proof screenshot only — delete proof-dist after
    // screenshotting; it is never committed or deployed.
    outDir: ".scratch/051_print-area-name-hallmark-size/proof-dist",
    emptyOutDir: true,
    rollupOptions: { input: ".scratch/051_print-area-name-hallmark-size/proof.html" },
  },
});
