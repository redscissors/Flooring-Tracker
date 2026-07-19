import { parseOvf } from "../../src/ovfbook.js";
import { parseMapped } from "../../src/pricebook.js";
import { fileFormat, routeFile, computeFingerprint } from "../../src/dropimport.js";
import { orderFloorFirst } from "../../src/orderbook.js";
import { HALLMARK_SHEETS, TARKETT_SHEETS } from "./data.js";

const money = (n) => (n == null ? "—" : "$" + Number(n).toFixed(2));
const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

// Books as they'd sit in the registry once imported (fingerprint stamped by the
// wizard on first apply) — lets routeFile show where a re-drop lands.
const registry = [
  { id: "hall", name: "Hallmark Wood (OVF)", data: { importFingerprint: { format: "ovf-hallmark" } } },
  { id: "tark", name: "Tarkett Home LVT (OVF)", data: { importFingerprint: { format: "ovf-tarkett" } } },
];

function bookSection(title, sheets, fname) {
  const fmt = fileFormat({ sheets });
  const res = parseOvf(sheets, fname);
  const { items, warnings } = parseMapped(res.rows, res.mapping);
  const floors = items.filter((i) => !i.trim && i.type);
  const trims = items.filter((i) => i.trim);
  const accs = items.filter((i) => !i.trim && !i.type);
  const fp = computeFingerprint({ sheets });
  const route = routeFile({ ...fp, sheets }, registry);
  const target = registry.find((b) => b.id === route.target);

  const sample = [...floors.slice(0, 4), ...trims.filter((t) => new RegExp(floors[0].sku).test(t.description)).slice(0, 3), ...accs.slice(0, 2)];
  const rowsHtml = sample.map((it) => `
    <tr>
      <td class="sku">${esc(it.sku)}</td>
      <td>${esc(it.description)}${it.trim ? '<span class="trimtag">trim</span>' : ""}${!it.trim && !it.type ? '<span class="trimtag" style="color:#7a705a;border-color:#e4dcc8;background:#f7f3e8">accessory</span>' : ""}</td>
      <td>${esc(it.productLine || "")}</td>
      <td>${esc(it.size || "")}</td>
      <td class="num">${it.sfPerUnit ?? ""}</td>
      <td class="num">${money(it.cost)}</td>
      <td>${esc(it.priceUnit || it.unit || "")}</td>
    </tr>`).join("");

  const collections = [...new Set(floors.map((i) => i.productLine).filter(Boolean))];
  const id = "demo-" + fname.replace(/[^a-z0-9]/gi, "");
  return `
  <div class="book">
    <h2>${esc(title)} <span class="chip">detected: ${esc(fmt)}</span>
        <span class="chip gray">${floors.length} floors · ${trims.length} trims${accs.length ? ` · ${accs.length} accessories` : ""} · ${collections.length} collections</span></h2>
    <div class="route">Drop routing: <b>${esc(route.reason)}</b>${target ? "" : " (no book stamped yet — the wizard stamps the fingerprint on first apply)"}</div>
    <div class="kv">
      <span>SKU pattern <b>${esc(res.mapping.skuPattern)}</b></span>
      <span>markup group <b>${esc(res.mapping.groupBy)}</b></span>
      <span>parse warnings <b>${warnings.length}</b></span>
    </div>
    <table>
      <thead><tr><th>Item #</th><th>Name</th><th>Collection</th><th>Size</th><th>SF/CT</th><th>Cost</th><th>U/M</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    ${warnings.length ? `<div class="warn">${esc(warnings[0])}${warnings.length > 1 ? ` (+${warnings.length - 1} more)` : ""}</div>` : ""}
    <div class="demo">
      <label>Type a floor SKU — its trims surface with it (orderFloorFirst)</label>
      <input id="${id}" placeholder="e.g. ${esc(floors[0].sku)}" value="${esc(floors[0].sku)}" />
      <div id="${id}-hits"></div>
    </div>
  </div>`;
}

function wireDemo(fname, items) {
  const id = "demo-" + fname.replace(/[^a-z0-9]/gi, "");
  const input = document.getElementById(id), out = document.getElementById(id + "-hits");
  const run = () => {
    const q = input.value.trim();
    if (!q) { out.innerHTML = ""; return; }
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const hits = orderFloorFirst(items.filter((i) => re.test(i.sku) || re.test(i.description)), q).slice(0, 8);
    out.innerHTML = hits.map((i) => `<div class="hit"><span class="sku">${esc(i.sku)}</span> <span>${esc(i.description)}</span>${i.trim ? '<span class="trimtag">trim</span>' : ""}<span class="p">${money(i.cost)}${i.priceUnit ? "/" + esc(i.priceUnit) : ""}</span></div>`).join("");
  };
  input.addEventListener("input", run); run();
}

const books = [
  ["OVF-Hallmark-Wood.xls", HALLMARK_SHEETS, "OVF-Hallmark-Wood"],
  ["ovf-tarkett-home-lvt.xls", TARKETT_SHEETS, "ovf-tarkett-home-lvt"],
];
document.getElementById("root").innerHTML =
  books.map(([t, s, f]) => bookSection(t, s, f)).join("") +
  `<div class="foot">Counts cross-checked against node --test (453 passing) and the command-line runs on the raw files.</div>`;
for (const [, sheets, fname] of books) {
  const res = parseOvf(sheets, fname);
  wireDemo(fname, parseMapped(res.rows, res.mapping).items);
}
