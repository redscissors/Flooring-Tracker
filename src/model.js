import { num } from "./catalog.js";
import { normTier, normPrintPricing } from "./pricing.js";
import { normBasketEntry } from "./sheoga.js";
import { TYPES, TLBL } from "./uiconst.js";

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
export const money = (n) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const sf1 = (n) => (n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
// Estimate wording for the waste factor. Each family is a toggle now, so the
// paperwork names only what was actually applied — a family left off added no
// overage and gets no mention, and with both off the line disappears entirely
// (callers render nothing on null).
export const wasteNote = (w) => {
  const t = num(w?.tile), f = num(w?.floor);
  if (!t && !f) return null;
  if (t && f) return t === f ? `${t}% material waste` : `material waste (tile ${t}%, other flooring ${f}%)`;
  return t ? `${t}% material waste on tile` : `${f}% material waste on flooring`;
};
// The same fact compressed for the estimate's header meta line.
export const wasteMeta = (w, one = "waste") => {
  const t = num(w?.tile), f = num(w?.floor);
  if (!t && !f) return "";
  if (t && f) return t === f ? `${one} ${t}%` : `waste tile ${t}% · other ${f}%`;
  return t ? `waste tile ${t}%` : `waste other ${f}%`;
};
// Misc lines are flat-priced; a typed quantity multiplies the price. Only
// count-mode qty is honored so a stale sqft value left over from a type
// switch (or legacy rows) can't silently multiply the total.
export const miscQty = (p) => (p.qtyType === "count" && String(p.qty ?? "").trim() !== "" ? num(p.qty) : 1);
export const blobToDataURL = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
export const dataURLToBlob = (dataURL) => { const [meta, b64] = String(dataURL).split(","); const mime = (meta.match(/:(.*?);/) || [])[1] || "application/octet-stream"; const bin = atob(b64 || ""); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return new Blob([arr], { type: mime }); };

export const newProduct = () => ({ id: uid(), type: "tile", sku: "", L: "", W: "", thickness: "0.375", sizeText: "", brandColor: "", priceSqft: "", qtyType: "sqft", qty: "", cartonSf: "", cartonPc: "", cartonUnit: "CT", sellUnit: "", cartonManual: "", note: "", freight: "", grout: { checked: false, product: "", color: "", sku: "", joint: 0.125, manual: "", caulk: "", caulkSku: "", caulkPrice: "" }, mortar: { checked: false, product: "", manual: "" }, underlay: { checked: false, product: "", manual: "", install: false, installMortars: {}, installSkip: {} }, attached: {} });
export const newArea = () => ({ id: uid(), name: "", option: "", products: [newProduct()] });
export const areaLabel = (a, i) => (a.name || "").trim() || `Area ${i + 1}`;
// A row with no identity yet — the empty state renders as a price-book search
// instead of the full grid (pick a match to fill it, or a type/double-click to
// enter it by hand).
export const rowBlank = (p) => !p.sku && !p.brandColor && !p.L && !p.W && !p.sizeText && !(num(p.priceSqft) > 0) && !(num(p.qty) > 0);
// Every area carries one trailing blank "adder" row (the inline New-row
// affordance). It's ephemeral scaffolding, not a real selection, so change
// detection for auto-versions compares categories with blank rows stripped —
// otherwise the adder would look like an edit on every open.
export const catSig = (cats) => JSON.stringify((cats || []).map((a) => ({ ...a, products: (a.products || []).filter((p) => !rowBlank(p)) })));
// Quick-price drafts all start life named "Quick price", which makes the
// drafts list impossible to tell apart. While a draft's name still looks
// auto-generated it renames itself from its content on every save:
// "Q-<first line item>-<M/D>" (the M/D is the day the quote was started).
// A hand-typed name never matches isQuickAutoName, so one rename stops the
// auto-updates for good.
export const QUICK_DEFAULT_NAME = "Quick price";
const QUICK_AUTO_RE = /^Q-.*-\d{1,2}\/\d{1,2}$/;
export const isQuickAutoName = (name) => { const s = String(name || "").trim(); return !s || s === QUICK_DEFAULT_NAME || QUICK_AUTO_RE.test(s); };
// The project-number claim gate (spec 2026-08-14): a number is minted only for
// a name a person typed — the "New Project" birth default and quick auto-names
// never claim, so drafts stay unnumbered until someone names them.
export const isRealProjectName = (name) => { const s = String(name || "").trim(); return !!s && s !== "New Project" && !isQuickAutoName(s); };
export const quickAutoName = (proj) => {
  const first = (proj.categories || []).flatMap((a) => a.products || []).find((p) => !rowBlank(p));
  if (!first) return QUICK_DEFAULT_NAME;
  const item = (first.brandColor || "").trim() || (first.sku || "").trim() || TLBL[first.type] || "Item";
  const d = new Date(proj.createdAt || Date.now());
  return `Q-${item.slice(0, 30).trim()}-${d.getMonth() + 1}/${d.getDate()}`;
};
// The printed estimate has no room for the sidebar's full auto name (item +
// date) — it prints just "Q-<first two words of the first line item>".
export const quickPrintName = (proj) => {
  const first = (proj.categories || []).flatMap((a) => a.products || []).find((p) => !rowBlank(p));
  if (!first) return QUICK_DEFAULT_NAME;
  const item = (first.brandColor || "").trim() || (first.sku || "").trim() || TLBL[first.type] || "Item";
  return `Q-${item.trim().split(/\s+/).slice(0, 2).join(" ")}`;
};
// A Project is what a "Customer" used to be: one job/estimate holding areas.
// It belongs to a Customer (person) via customerId (the projects.customer_id
// column). See ADR 0005.
// salesperson is SNAPSHOTTED from the creator's profile at addProject time and
// never read live again — projects are team-shared, so without the snapshot a
// teammate opening the job would print THEIR name on the estimate. Editable
// only through the header's salesperson popover.
// opts.quick marks a customer-less quick-price draft (lives in the sidebar's
// Quick Prices folder, self-clears after 30 days, cleared to false on promote).
// opts.seedArea opens the draft with one area whose blank adder row IS the
// product search, so a Quick Price lands straight in "grab a price". See
// docs/adr/0022-quick-price-draft-lifecycle.md.
// opts.waste seeds the job's waste rates from the shop default (Settings →
// General). Both families start UNPRESSED: a new quote reads raw measured
// footage until someone presses the waste they want ordered.
export const newProject = (customerId = null, name = "New Project", opts = {}) => ({ id: uid(), customerId, name, address: "", phone: "", email: "", notes: "", createdAt: Date.now(), categories: opts.seedArea ? [newArea()] : [], versions: [], attachments: [], salesperson: null, priceTier: "retail", customPct: "", printPricing: "full", quick: !!opts.quick, freight: true, waste: { tile: opts.waste?.tile ?? 10, floor: opts.waste?.floor ?? 5, tileOn: false, floorOn: false }, sheogaBasket: [], optionNames: {} });
// A Customer is the person/account that owns many projects and holds contact
// info once. A Builder is a canonical name-list a customer links to by id.
export const newPerson = (name = "") => ({ id: uid(), builderId: null, name, phone: "", email: "", address: "", notes: "", createdAt: Date.now() });
export const newBuilder = (name = "") => ({ id: uid(), name });

// thickness/joint use || not ??: rows migrated from the artifact can hold ""
// (or 0), which silently blocks the grout calc — mortar doesn't need either,
// so grout alone showed "—". Default them like a fresh row.
// `freight` stores only the opt-OUT ("off"): a row whose book charges freight
// rides the shipment by default, including rows saved before the program
// existed (ADR 0030).
export const normP = (p) => ({ id: p.id || uid(), type: TYPES.includes(p.type) ? p.type : "tile", sku: p.sku ?? "", L: p.L ?? "", W: p.W ?? "", thickness: p.thickness || "0.375", sizeText: p.sizeText ?? (p.size || ""), brandColor: p.brandColor ?? [p.brand, p.color].filter(Boolean).join(" / "), priceSqft: p.priceSqft ?? "", qtyType: p.qtyType === "count" ? "count" : "sqft", qty: p.qty ?? "", cartonSf: p.cartonSf ?? "", cartonPc: p.cartonPc ?? "", cartonUnit: p.cartonUnit || "CT", sellUnit: p.sellUnit ?? "", cartonManual: p.cartonManual ?? "", note: p.note ?? "", freight: p.freight === "off" ? "off" : "", bookId: p.bookId ?? "", cost: p.cost ?? "", costSqft: p.costSqft ?? "", markupPct: p.markupPct ?? "", freightFlag: !!p.freightFlag, tierPrice: p.tierPrice ?? "", sheoga: p.sheoga ?? null, wedi: p.wedi ?? null, schluter: p.schluter ?? null, grout: { checked: !!p.grout?.checked, product: p.grout?.product || "", color: p.grout?.color || "", sku: p.grout?.sku ?? "", joint: num(p.grout?.joint) > 0 ? p.grout.joint : 0.125, manual: p.grout?.manual ?? "", caulk: p.grout?.caulk ?? "", caulkSku: p.grout?.caulkSku ?? "", caulkPrice: p.grout?.caulkPrice ?? "" }, mortar: { checked: !!p.mortar?.checked, product: p.mortar?.product || "", manual: p.mortar?.manual ?? "" }, underlay: { checked: !!p.underlay?.checked, product: p.underlay?.product || "", manual: p.underlay?.manual ?? "", install: !!p.underlay?.install, installMortars: p.underlay?.installMortars || {}, installSkip: p.underlay?.installSkip || {} }, attached: normAttachedJob(p.attached) });
// Add-on material selections, keyed by category id (ADR 0016). Old records have
// no `attached` — they normalize to {} and stay valid.
export const normAttachedJob = (a) => { const out = {}; if (a && typeof a === "object") for (const k of Object.keys(a)) { const v = a[k] || {}; out[k] = { checked: !!v.checked, product: v.product || "", manual: v.manual ?? "" }; } return out; };
// Quote-option slot letters (ADR 0031; extended past A–C 2026-08-19, past A–F
// on the 2026-08-26 owner ask). Defined here, not options.js, because
// normA/normC gate on them and options.js imports from this file — it
// re-exports the list.
export const OPTION_SLOTS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
const OPT_RE = new RegExp(`^[${OPTION_SLOTS.join("")}]$`);
export const normA = (a) => ({ id: a.id || uid(), name: a.name || "", option: OPT_RE.test(a.option) ? a.option : "", products: (a.products || [{}]).map(normP) });
// Projects written before waste moved off Settings have no `waste` — keep it
// null rather than filling a default, so `projWaste` can tell "quoted under
// the old global rate" from "quoted with both toggles deliberately off".
export const normWasteJob = (w) => (w == null ? null : { tile: w.tile ?? 10, floor: w.floor ?? 5, tileOn: !!w.tileOn, floorOn: !!w.floorOn });
// The job's freight master switch (ADR 0030) defaults ON — an absent field is a
// project quoted before the switch existed, and vendor freight was always owed
// on those orders too.
export const normC = (c) => ({ ...c, customerId: c.customerId ?? null, createdAt: c.createdAt || Date.now(), quick: !!c.quick, freight: c.freight !== false, categories: (c.categories || []).map(normA), versions: c.versions || [], attachments: c.attachments || [], salesperson: c.salesperson || null, priceTier: normTier(c.priceTier), customPct: c.customPct ?? "", printPricing: normPrintPricing(c.printPricing), waste: normWasteJob(c.waste), sheogaBasket: (c.sheogaBasket || []).map(normBasketEntry).filter(Boolean), optionNames: (() => { const out = {}; const v = c.optionNames; if (v && typeof v === "object") for (const s of OPTION_SLOTS) { const n = typeof v[s] === "string" ? v[s].trim() : ""; if (n) out[s] = n; } return out; })() });

// personData is what gets written back to a person's data jsonb; the person/
// builder row mappers and selects live in bootload.js.
export const personData = ({ id, createdAt, updatedAt, builderId, ...rest }) => rest;
