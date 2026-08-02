// Preview harness: the REAL AppsWorkspace (labels + sheoga + wedi), mock commit
// handlers, no auth and no network. Used to shoot the rail-collapse and the
// configurator's shrink-to-fit at a range of widths. Served by vite; never shipped.
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
