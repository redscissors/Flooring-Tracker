import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Root from "./Root.jsx";
import "./index.css";

// Open the Supabase connection (DNS + TCP + TLS) while React boots, so the
// first stage-1 data request doesn't pay it (ADR 0026). The URL is env-set,
// so this can't live as a static tag in index.html.
const supaUrl = import.meta.env.VITE_SUPABASE_URL;
if (supaUrl) {
  const l = document.createElement("link");
  l.rel = "preconnect"; l.href = supaUrl; l.crossOrigin = "anonymous";
  document.head.appendChild(l);
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
