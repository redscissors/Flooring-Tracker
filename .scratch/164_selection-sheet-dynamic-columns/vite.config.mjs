// Mockup harness (issue 164): the 162/163 fake client + App, with the columns
// sheet swapped for the variant copy beside this file. Vite on :5199.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root: join(dir, "../.."),
  plugins: [react()],
  resolve: { alias: [
    { find: /^\.\/lib\/supabase\.js$/, replacement: join(dir, "fakesupabase.js") },
    { find: /^\.\/EstimateColumns\.jsx$/, replacement: join(dir, "EstimateColumnsVariants.jsx") },
  ] },
  server: { port: 5199, strictPort: true },
});
