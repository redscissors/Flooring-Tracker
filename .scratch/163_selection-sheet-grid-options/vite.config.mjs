// Mockup harness (issue 163): the 162 preview's fake client + App, with the
// columns sheet swapped for the variant copy beside this file.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root: join(dir, "../.."),
  plugins: [react()],
  resolve: { alias: [
    { find: /^\.\/lib\/supabase\.js$/, replacement: join(dir, "../162_selection-sheet-columns/fakesupabase.js") },
    { find: /^\.\/EstimateColumns\.jsx$/, replacement: join(dir, "EstimateColumnsVariants.jsx") },
  ] },
  server: { port: 5198, strictPort: true },
});
