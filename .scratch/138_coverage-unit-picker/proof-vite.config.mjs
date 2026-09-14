import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Run from the repo root: npx vite build --config .scratch/138_coverage-unit-picker/proof-vite.config.mjs
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: ".scratch/138_coverage-unit-picker/proof-dist",
    emptyOutDir: true,
    rollupOptions: { input: ".scratch/138_coverage-unit-picker/proof.html" },
  },
});
