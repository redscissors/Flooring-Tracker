// Preview proof (issue 164): the REAL App and the REAL sheet over the fake
// client (long material names) — no variant alias. Vite on :5196.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root: join(dir, "../../.."),
  plugins: [react()],
  resolve: { alias: [{ find: /^\.\/lib\/supabase\.js$/, replacement: join(dir, "fakesupabase.js") }] },
  server: { port: 5196, strictPort: true },
});
