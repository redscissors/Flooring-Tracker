// local-only harness: mounts the wedi configurator without the auth gate so
// the drawings can be driven and screenshotted. NOT committed.
import { createRoot } from "react-dom/client";
import WediConfigurator from "./src/WediConfigurator.jsx";
import { pans } from "./src/wedi.js";
import "./src/index.css";

const params = new URLSearchParams(location.search);
const pan = pans().find((p) => p.stock && p.w >= 48 && p.d >= 60) || pans()[0];
const benches = {
  none: [],
  site: [{ kind: "wall", side: "left", build: "site" }],
  mix: [
    { kind: "wall", side: "left", build: "site" },
    { kind: "corner", corner: "br" },
  ],
  framed: [{ kind: "wall", side: "right", build: "framed", panFit: "cut" }],
  smaller: [{ kind: "wall", side: "left", build: "framed", panFit: "smaller" }],
  back: [{ kind: "wall", side: "back", build: "site" }],
}[params.get("benches") || "mix"];

const corners = (params.get("corners") || "").split(",").filter(Boolean);
const walls = (params.get("walls") || "back,left,right").split(",").filter(Boolean);
const seed = params.get("tab") === "custom"
  ? { tab: "custom", input: { w: 60, d: 36, curb: "curbed", drain: "center" } }
  : {
    mode: "kits",
    cfg: {
      panKey: pan.key,
      walls: walls.map((side) => ({ side, len: side === "back" || side === "entry" ? pan.w : pan.d, h: 96 })),
      benches,
      corners,
    },
  };

// rasterize a drawing and POST it to the local scratchpad sink (agent-only)
window.__shot = async (name, which = 1, scale = 3, crop = null) => {
  const svgEl = [...document.querySelectorAll(".diagcol svg")][which];
  const xml = new XMLSerializer().serializeToString(svgEl);
  const W = svgEl.width.baseVal.value, H = svgEl.height.baseVal.value;
  const png = await new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      const [sx, sy, sw, sh] = crop || [0, 0, W, H];
      c.width = sw * scale; c.height = sh * scale;
      const g = c.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      res(c.toDataURL("image/png"));
    };
    img.onerror = rej;
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  });
  const r = await fetch("http://localhost:7788/", { method: "POST", body: JSON.stringify({ name, png }) });
  return r.text();
};

createRoot(document.getElementById("root")).render(
  <WediConfigurator seed={seed} tier="retail" onAdd={() => {}} onClose={() => {}} areaName="harness" />
);
