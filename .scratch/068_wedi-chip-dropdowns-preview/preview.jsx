// Preview harness: the REAL AppsWorkspace with the new wedi tab, wired exactly
// like App.jsx wires it (both configurators share the destination prompt; a
// commit with a project "open" raises it, the mock handlers just log).
// Served by vite; never shipped.
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { AppsWorkspace } from "../../src/AppsWorkspace.jsx";

const log = (tag) => (lines) => console.log(tag, lines.length, "lines");
const dest = (tag) => ({
  currentName: "Smith — hall bath",
  addToCurrent: log(tag + " → current"),
  addToNew: log(tag + " → new"),
});

createRoot(document.getElementById("root")).render(
  <AppsWorkspace
    onClose={() => console.log("close hub")}
    stock={[]}
    labels={[]}
    presets={[]}
    onAddLabel={() => {}}
    onAddLabelsBulk={() => {}}
    onUpdateLabel={() => {}}
    onDeleteLabel={() => {}}
    onSavePreset={() => {}}
    sheoga={{ markupDefault: 40, ventMarkupDefault: 50, ...dest("sheoga") }}
    wedi={{ builderPct: 18, ...dest("wedi") }}
  />
);
