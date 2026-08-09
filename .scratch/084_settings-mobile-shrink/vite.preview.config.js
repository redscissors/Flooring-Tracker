import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// The harness mounts SettingsWorkspace directly with fixture props, so no
// Supabase client is ever touched — but src/lib/supabase.js still gets parsed
// on import chains, so alias it to 074's fake to keep env checks quiet.
const fake = fileURLToPath(new URL("../074_responsive-shrink-quickprice/fake-supabase.js", import.meta.url));

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
