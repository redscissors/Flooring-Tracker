// Build the self-contained preview proof for the Mirage carton-coverage fix.
// Runs the REAL modules over the REAL four Mirage files (the frozen payloads
// from issue 028) and bakes the result into one HTML page — same pattern as
// issue 025's ovf-import-proof.html.
//
//   node .scratch/060_mirage-carton-coverage/make-proof.mjs

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseMirage, parseMiragePackaging } from "../../src/miragebook.js";
import { parseMapped } from "../../src/pricebook.js";
import { orderPatch } from "../../src/orderbook.js";
import { newProduct, normP } from "../../src/model.js";
import { mergeSettings, getCarton } from "../../src/catalog.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const payloads = JSON.parse(fs.readFileSync(path.join(here, "../028_mirage-bundle-preview/payloads.json"), "utf8"));

const SF = 420;          // the sample job area
const MARKUP = 35;       // a plausible book markup, so the row shows a sell price
const SHOW = ["86360", "76455", "88364", "76939N", "87144", "86246"];

const book = parseMirage(payloads);
const { items } = parseMapped(book.rows, book.mapping);
const settings = mergeSettings({});
const bySku = new Map(items.map((i) => [i.sku, i]));

const bands = payloads
  .filter((p) => !p.isPdf)
  .map((p) => ({ name: p.name, ...parseMiragePackaging(p.sheets) }))
  .filter((b) => b.coverage.size);

// One row's math, with and without the coverage the fix supplies.
const rowFor = (sku) => {
  const item = bySku.get(sku);
  if (!item) return null;
  const patch = orderPatch(item, { id: "mirage", data: { markups: { default: MARKUP } } }, newProduct());
  const withSf = normP({ ...newProduct(), ...patch, qty: String(SF) });
  const without = normP({ ...withSf, cartonSf: "" });
  const C = getCarton(withSf, settings);
  const price = Number(withSf.priceSqft);
  return {
    sku,
    name: item.description,
    size: item.size,
    cost: item.cost,
    price,
    sfPerUnit: item.sfPerUnit,
    before: { qty: SF, total: SF * price },
    after: C ? { boxes: C.order, exact: C.exact, sf: C.sf, billed: C.order * C.sf, total: C.order * C.sf * price } : null,
    noCoverage: !without.cartonSf && !C,
  };
};

const rows = SHOW.map(rowFor).filter(Boolean);
const covered = book.rows.slice(1).filter((r) => r[8] === "hardwood" && r[5]);
const floors = book.rows.slice(1).filter((r) => r[8] === "hardwood");

const money = (n) => `$${n.toFixed(2)}`;
const pretty = (s) => s.replace(/\btrubalance\b/, "TruBalance").replace(/\b(lite|lock|classic)\b/, (m) => m[0].toUpperCase() + m.slice(1)).replace(/\bherr\b/, "Herringbone").replace(/\bchevron\b/, "Chevron");
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

const bandTable = (b) => `
  <div class="band">
    <h3>${esc(b.name)}</h3>
    <table>
      <thead><tr><th>Construction</th><th>Width</th><th class="num">Box content</th></tr></thead>
      <tbody>${[...b.coverage.entries()].map(([k, v]) => {
        const [c, w] = k.split("|");
        return `<tr><td>${esc(pretty(c))}</td><td>${esc(pretty(w))}</td><td class="num">${v} sf</td></tr>`;
      }).join("")}
      ${[...b.split.values()].map((label) => `<tr class="split"><td colspan="3">${esc(label)} — two box sizes (Box A / Box B), no single figure fits, left without coverage</td></tr>`).join("")}
      </tbody>
    </table>
  </div>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Mirage carton coverage — preview proof</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { --ink:#1f2421; --paper:#faf9f6; --mute:#8a8f8a; --line:#e4e2dc; --moss:#5f7a5a; --moss-soft:#eef1ea; }
  * { box-sizing:border-box; }
  body { margin:0; padding:28px 32px 60px; background:var(--paper); color:var(--ink);
         font:14px/1.45 Manrope, system-ui, sans-serif; }
  h1 { font-size:19px; margin:0 0 2px; }
  h2 { font-size:15px; margin:0 0 10px; }
  h3 { font-size:12px; margin:0 0 6px; color:var(--mute); font-weight:600; }
  .sub { color:var(--mute); font-size:12px; margin-bottom:24px; }
  .card { background:#fff; border:1px solid var(--line); border-radius:10px; padding:18px 20px; margin-bottom:22px; }
  .kv { display:flex; gap:22px; flex-wrap:wrap; font-size:12px; color:var(--mute); margin-bottom:14px; }
  .kv b { color:var(--ink); font-weight:600; }
  table { border-collapse:collapse; width:100%; font-size:12px; }
  th { text-align:left; font-size:10.5px; letter-spacing:.05em; text-transform:uppercase; color:var(--mute);
       border-bottom:1px solid var(--line); padding:5px 8px; white-space:nowrap; }
  td { border-bottom:1px solid #f0efeb; padding:5px 8px; vertical-align:top; }
  td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .sku { font-weight:600; white-space:nowrap; }
  .bands { display:flex; gap:26px; flex-wrap:wrap; }
  .band { min-width:270px; flex:1; }
  tr.split td { color:#8a6d3b; background:#fdf6ec; font-size:11px; }
  .was { color:var(--mute); text-decoration:line-through; }
  .now { color:var(--moss); font-weight:600; }
  .chip { display:inline-block; font-size:10.5px; font-weight:600; padding:2px 8px; border-radius:999px;
          background:var(--moss-soft); color:var(--moss); border:1px solid #d8dfd2; }
  .foot { color:var(--mute); font-size:11px; margin-top:18px; }
</style>
</head>
<body>
<h1>Mirage floors order in whole boxes again</h1>
<div class="sub">Real modules (<code>miragebook.js</code> → <code>pricebook.js</code> → <code>orderbook.js</code> → <code>catalog.js</code>)
over the real four Mirage files. Sample job: <b>${SF} sq ft</b>, book markup ${MARKUP}%, waste ${settings.waste.floor}% (floor).</div>

<div class="card">
  <h2>1 · The packaging band, now parsed</h2>
  <div class="kv"><span>Each flooring sheet states box coverage once, per construction × width. Nothing read it before.</span></div>
  <div class="bands">${bands.map(bandTable).join("")}</div>
</div>

<div class="card">
  <h2>2 · What reaches the book</h2>
  <div class="kv">
    <span><b>${floors.length}</b> priced floors</span>
    <span><b>${covered.length}</b> with box coverage <span class="chip">was 0</span></span>
    <span><b>${book.meta.trims}</b> trims (unchanged, sold EA)</span>
  </div>
  <table>
    <thead><tr><th>Item #</th><th>Name</th><th>Width</th><th class="num">$/SF cost</th><th class="num">SF/box before</th><th class="num">SF/box now</th></tr></thead>
    <tbody>${rows.map((r) => `<tr>
      <td class="sku">${esc(r.sku)}</td><td>${esc(r.name)}</td><td>${esc(r.size)}</td>
      <td class="num">${money(r.cost)}</td><td class="num was">—</td><td class="num now">${r.sfPerUnit} sf</td></tr>`).join("")}
    </tbody>
  </table>
</div>

<div class="card">
  <h2>3 · The row math on a ${SF} sq ft job</h2>
  <div class="kv"><span>Same snapshot path a salesperson's SKU pick takes — <code>orderPatch</code> → the product row → <code>getCarton</code>.</span></div>
  <table>
    <thead><tr><th>Item #</th><th class="num">Sell $/SF</th>
      <th class="num">Before — quantity</th><th class="num">Before — line</th>
      <th class="num">Now — quantity</th><th class="num">Now — line</th></tr></thead>
    <tbody>${rows.map((r) => `<tr>
      <td class="sku">${esc(r.sku)}</td><td class="num">${money(r.price)}</td>
      <td class="num was">${r.before.qty} sf</td><td class="num was">${money(r.before.total)}</td>
      <td class="num now">${r.after ? `${r.after.boxes} boxes <span style="color:var(--mute);font-weight:400">(${r.after.exact.toFixed(2)} exact · ${r.after.sf} sf ea)</span>` : "—"}</td>
      <td class="num now">${r.after ? money(r.after.total) : "—"}</td></tr>`).join("")}
    </tbody>
  </table>
  <div class="foot">Before: exact square feet, no rounding — the bug the shop hit on 86360. Now: whole boxes, billed at ordered coverage × $/SF, exactly as every other carton-sold book behaves.</div>
</div>

<div class="card">
  <h2>4 · Import warnings</h2>
  <table><tbody>${book.warnings.map((w) => `<tr><td>${esc(w)}</td></tr>`).join("")}</tbody></table>
  <div class="foot">No new warning fires: every priced floor found its box. A width that ever loses its coverage — or the 9"'s Box A/Box B pair, which has no single figure — is named in this list rather than quietly quoting by the foot.</div>
</div>

<div class="foot">Generated by <code>.scratch/060_mirage-carton-coverage/make-proof.mjs</code>.</div>
</body>
</html>`;

fs.writeFileSync(path.join(here, "carton-coverage-proof.html"), html);
console.log("floors", floors.length, "covered", covered.length);
console.log("wrote carton-coverage-proof.html");
