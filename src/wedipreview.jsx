// Preview harness for the wedi configurator (issue 066): the REAL
// WediConfigurator over the real engine, mounted with no Supabase and no App
// shell — the change-control preview shots drive this page.
// Dev-only entry (wedi-preview.html); not part of the app build.
import { createRoot } from "react-dom/client";
import "./index.css";
import WediConfigurator from "./WediConfigurator.jsx";

createRoot(document.getElementById("preview")).render(
  <WediConfigurator
    seed={null}
    wediBuilderPct={18}
    areaName="Master bath"
    projectName="Harper — 214 Ridgeway"
    onAdd={(rows) => console.log("onAdd", rows)}
    onClose={() => console.log("onClose")}
    onConfigChange={() => {}}
  />
);
