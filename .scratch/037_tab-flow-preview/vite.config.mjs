// Preview server for the tab-flow cleanup: the real app with src/lib/supabase.js
// swapped for the in-memory mock beside this file. Run from the repo root:
//
//   VITE_SUPABASE_URL=https://preview.invalid VITE_SUPABASE_ANON_KEY=preview \
//     npx vite --config .scratch/037_tab-flow-preview/vite.config.mjs
//
// (The env vars only satisfy index.html's %VITE_SUPABASE_URL% preconnect —
// nothing is contacted; every query is answered by mock-supabase.js.)
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";

const mock = fileURLToPath(new URL("./mock-supabase.js", import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL("../..", import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: [{ find: /^.*\/lib\/supabase\.js$/, replacement: mock }],
  },
});
