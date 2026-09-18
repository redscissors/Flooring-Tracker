import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Run from the repo root: npx vite build --config .scratch/144_underlayment-row-type/proof-vite.config.mjs
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: ".scratch/144_underlayment-row-type/proof-dist",
    emptyOutDir: true,
    rollupOptions: { input: ".scratch/144_underlayment-row-type/proof.html" },
  },
});
