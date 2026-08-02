import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const fake = fileURLToPath(new URL("./fake-supabase.js", import.meta.url));

// Swap the real Supabase client for the fake one wherever it's imported, so the
// real App.jsx boots in a browser with no network and no credentials.
const stubSupabase = {
  name: "stub-supabase",
  enforce: "pre",
  resolveId(id) {
    return /(^|\/)lib\/supabase\.js$/.test(id) ? fake : null;
  },
};

export default defineConfig({
  root: fileURLToPath(new URL("../..", import.meta.url)),
  plugins: [stubSupabase, react()],
  server: { port: Number(process.env.PORT || 5199), strictPort: true },
});
