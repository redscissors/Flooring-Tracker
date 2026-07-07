#!/usr/bin/env node
// Data-shape lint for a FloorTrack backup JSON (or a single pasted customer
// object saved to a file). Settings are checked with the app's REAL
// normalizeSettings from src/catalog.js. Customers get a structural lint only:
// the app's customer normalizers (normC/normA/normP) live unexported inside
// src/App.jsx (a JSX file Node can't import), so this script mirrors their
// checks read-only instead of running them.
//
// Usage: node shape-check.mjs <path-to-json>

import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const { normalizeSettings, FLOOR_TYPES, num } = await import(
  pathToFileURL(path.resolve(here, "../../../../src/catalog.js")).href
);

const file = process.argv[2];
if (!file) { console.error("usage: node shape-check.mjs <backup.json | customer.json>"); process.exit(1); }
const raw = JSON.parse(fs.readFileSync(file, "utf8"));

// Accept a full backup ({ customers, settings, attachments }), a bare customer
// array, or a single customer object.
const customers = Array.isArray(raw) ? raw : Array.isArray(raw.customers) ? raw.customers : raw.categories ? [raw] : [];
const warnings = [];
const warn = (msg) => warnings.push(msg);

if (raw.settings !== undefined || (!Array.isArray(raw) && !raw.categories)) {
  const s = normalizeSettings(raw.settings);
  const count = (kind) => s.catalog.companies.reduce((n, co) => n + (co[kind] || []).length, 0);
  console.log(`settings ok: waste tile=${s.waste.tile}% floor=${s.waste.floor}% | catalog: ${s.catalog.companies.length} companies, ${count("grouts")} grouts, ${count("mortars")} mortars, ${count("underlayments")} underlayments`);
  for (const [name, g] of Object.entries(s.grouts)) if (!num(g.coverage)) warn(`grout "${name}" has no coverage — its quantities won't compute`);
  for (const [name, m] of Object.entries(s.mortars)) if (!num(m.tier1) && !num(m.tier2) && !num(m.tier3)) warn(`mortar "${name}" has no tier coverages — its quantities won't compute`);
}

const TYPES = [...FLOOR_TYPES, "misc"];
console.log(`customers: ${customers.length}`);
for (const c of customers) {
  const who = c.name || c.id || "(unnamed)";
  if (!c.id) warn(`customer "${who}": missing id`);
  if (!Array.isArray(c.categories)) { warn(`customer "${who}": no categories array (normC would default to [])`); continue; }
  for (const a of c.categories) {
    for (const p of a.products || []) {
      const where = `customer "${who}" / area "${a.name || "?"}"`;
      if (p.type && !TYPES.includes(p.type)) warn(`${where}: unknown product type "${p.type}" (normP would coerce to "tile")`);
      if (p.qtyType && !["sqft", "count"].includes(p.qtyType)) warn(`${where}: qtyType "${p.qtyType}" (normP would coerce to "sqft")`);
      if (p.grout?.checked && !(num(p.qty) && num(p.L) && num(p.W) && num(p.thickness))) warn(`${where}: grout checked but sqft/L/W/thickness incomplete — shows no quantity unless grout.manual is set`);
      if (p.mortar?.checked && !(num(p.qty) && Math.max(num(p.L), num(p.W)) > 0)) warn(`${where}: mortar checked but sqft/L/W incomplete — shows no quantity unless mortar.manual is set`);
      if (num(p.cartonSf) && p.qtyType === "count") warn(`${where}: cartonSf set on a count-quantity row — carton math only runs for qtyType "sqft"`);
    }
  }
}

if (warnings.length) { console.log(`\n${warnings.length} warning(s):`); for (const w of warnings) console.log(`  - ${w}`); process.exit(2); }
console.log("no warnings");
