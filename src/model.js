import { num } from "./catalog.js";
import { normTier, normPrintPricing } from "./pricing.js";
import { normBasketEntry } from "./sheoga.js";
import { TYPES } from "./uiconst.js";

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

export const newProduct = () => ({ id: uid(), type: "tile", sku: "", L: "", W: "", thickness: "0.375", sizeText: "", brandColor: "", priceSqft: "", qtyType: "sqft", qty: "", cartonSf: "", cartonPc: "", cartonUnit: "CT", cartonManual: "", note: "", grout: { checked: false, product: "", color: "", sku: "", joint: 0.125, manual: "", caulk: "", caulkSku: "", caulkPrice: "" }, mortar: { checked: false, product: "", manual: "" }, underlay: { checked: false, product: "", manual: "", install: false, installMortars: {}, installSkip: {} }, attached: {} });
export const newArea = () => ({ id: uid(), name: "", note: "", products: [newProduct()] });
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
export const newProject = (customerId = null, name = "New Project", opts = {}) => ({ id: uid(), customerId, name, address: "", phone: "", email: "", notes: "", createdAt: Date.now(), categories: opts.seedArea ? [newArea()] : [], versions: [], attachments: [], salesperson: null, priceTier: "retail", customPct: "", printPricing: "full", quick: !!opts.quick, waste: { tile: opts.waste?.tile ?? 10, floor: opts.waste?.floor ?? 5, tileOn: false, floorOn: false }, sheogaBasket: [] });
// A Customer is the person/account that owns many projects and holds contact
// info once. A Builder is a canonical name-list a customer links to by id.
export const newPerson = (name = "") => ({ id: uid(), builderId: null, name, phone: "", email: "", address: "", notes: "", createdAt: Date.now() });
export const newBuilder = (name = "") => ({ id: uid(), name });

// thickness/joint use || not ??: rows migrated from the artifact can hold ""
// (or 0), which silently blocks the grout calc — mortar doesn't need either,
// so grout alone showed "—". Default them like a fresh row.
export const normP = (p) => ({ id: p.id || uid(), type: TYPES.includes(p.type) ? p.type : "tile", sku: p.sku ?? "", L: p.L ?? "", W: p.W ?? "", thickness: p.thickness || "0.375", sizeText: p.sizeText ?? (p.size || ""), brandColor: p.brandColor ?? [p.brand, p.color].filter(Boolean).join(" / "), priceSqft: p.priceSqft ?? "", qtyType: p.qtyType === "count" ? "count" : "sqft", qty: p.qty ?? "", cartonSf: p.cartonSf ?? "", cartonPc: p.cartonPc ?? "", cartonUnit: p.cartonUnit || "CT", cartonManual: p.cartonManual ?? "", note: p.note ?? "", bookId: p.bookId ?? "", cost: p.cost ?? "", costSqft: p.costSqft ?? "", markupPct: p.markupPct ?? "", freightFlag: !!p.freightFlag, tierPrice: p.tierPrice ?? "", sheoga: p.sheoga ?? null, grout: { checked: !!p.grout?.checked, product: p.grout?.product || "", color: p.grout?.color || "", sku: p.grout?.sku ?? "", joint: num(p.grout?.joint) > 0 ? p.grout.joint : 0.125, manual: p.grout?.manual ?? "", caulk: p.grout?.caulk ?? "", caulkSku: p.grout?.caulkSku ?? "", caulkPrice: p.grout?.caulkPrice ?? "" }, mortar: { checked: !!p.mortar?.checked, product: p.mortar?.product || "", manual: p.mortar?.manual ?? "" }, underlay: { checked: !!p.underlay?.checked, product: p.underlay?.product || "", manual: p.underlay?.manual ?? "", install: !!p.underlay?.install, installMortars: p.underlay?.installMortars || {}, installSkip: p.underlay?.installSkip || {} }, attached: normAttachedJob(p.attached) });
// Add-on material selections, keyed by category id (ADR 0016). Old records have
// no `attached` — they normalize to {} and stay valid.
export const normAttachedJob = (a) => { const out = {}; if (a && typeof a === "object") for (const k of Object.keys(a)) { const v = a[k] || {}; out[k] = { checked: !!v.checked, product: v.product || "", manual: v.manual ?? "" }; } return out; };
export const normA = (a) => ({ id: a.id || uid(), name: a.name || "", note: a.note || "", products: (a.products || [{}]).map(normP) });
// Projects written before waste moved off Settings have no `waste` — keep it
// null rather than filling a default, so `projWaste` can tell "quoted under
// the old global rate" from "quoted with both toggles deliberately off".
export const normWasteJob = (w) => (w == null ? null : { tile: w.tile ?? 10, floor: w.floor ?? 5, tileOn: !!w.tileOn, floorOn: !!w.floorOn });
export const normC = (c) => ({ ...c, customerId: c.customerId ?? null, createdAt: c.createdAt || Date.now(), quick: !!c.quick, categories: (c.categories || []).map(normA), versions: c.versions || [], attachments: c.attachments || [], salesperson: c.salesperson || null, priceTier: normTier(c.priceTier), customPct: c.customPct ?? "", printPricing: normPrintPricing(c.printPricing), waste: normWasteJob(c.waste), sheogaBasket: (c.sheogaBasket || []).map(normBasketEntry).filter(Boolean) });

// personData is what gets written back to a person's data jsonb; the person/
// builder row mappers and selects live in bootload.js.
export const personData = ({ id, createdAt, updatedAt, builderId, ...rest }) => rest;
