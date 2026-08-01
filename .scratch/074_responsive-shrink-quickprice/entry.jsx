// Boots the REAL App.jsx against the fake Supabase (aliased in
// vite.preview.config.js), with the Kisling job pre-opened so the desktop
// project header is on screen for width screenshots.
import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import App from "../../src/App.jsx";

const USER = { id: "u1", email: "marcus@example.com" };

function Harness() {
  useEffect(() => {
    // Open the seeded job once the sidebar has drawn it.
    const t = setInterval(() => {
      const row = [...document.querySelectorAll("button")].find((b) => /kitchen, bath & mudroom/i.test(b.textContent || ""));
      if (row) { row.click(); clearInterval(t); }
    }, 120);
    return () => clearInterval(t);
  }, []);
  return <App user={USER} onSignOut={() => {}} />;
}

createRoot(document.getElementById("root")).render(<Harness />);
