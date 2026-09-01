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
export const newProject = (customerId = null, name = "New Project", opts = {}) => ({ id: uid(), customerId, name, address: "", phone: "", email: "", notes: "", createdAt: Date.now(), categories: opts.seedArea ? [newArea()] : [], versions: [], attachments: [], salesperson: null, priceTier: "retail", customPct: "", printPricing: "full", quick: !!opts.quick, freight: true, waste: { tile: opts.waste?.tile ?? 10, floor: opts.waste?.floor ?? 5, tileOn: false, floorOn: false }, sheogaBasket: [], wediBasket: [], schluterBasket: [], optionNames: {} });
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
export const normP = (p) => ({ id: p.id || uid(), type: TYPES.includes(p.type) ? p.type : "tile", sku: p.sku ?? "", L: p.L ?? "", W: p.W ?? "", thickness: p.thickness || "0.375", sizeText: p.sizeText ?? (p.size || ""), brandColor: p.brandColor ?? [p.brand, p.color].filter(Boolean).join(" / "), priceSqft: p.priceSqft ?? "", qtyType: p.qtyType === "count" ? "count" : "sqft", qty: p.qty ?? "", cartonSf: p.cartonSf ?? "", cartonPc: p.cartonPc ?? "", cartonUnit: p.cartonUnit || "CT", sellUnit: p.sellUnit ?? "", cartonManual: p.cartonManual ?? "", note: p.note ?? "", freight: p.freight === "off" ? "off" : "", bookId: p.bookId ?? "", cost: p.cost ?? "", costSqft: p.costSqft ?? "", markupPct: p.markupPct ?? "", freightFlag: !!p.freightFlag, tierPrice: p.tierPrice ?? "", kitId: p.kitId ?? "", sheoga: p.sheoga ?? null, wedi: p.wedi ?? null, schluter: p.schluter ?? null, grout: { checked: !!p.grout?.checked, product: p.grout?.product || "", color: p.grout?.color || "", sku: p.grout?.sku ?? "", joint: num(p.grout?.joint) > 0 ? p.grout.joint : 0.125, manual: p.grout?.manual ?? "", caulk: p.grout?.caulk ?? "", caulkSku: p.grout?.caulkSku ?? "", caulkPrice: p.grout?.caulkPrice ?? "" }, mortar: { checked: !!p.mortar?.checked, product: p.mortar?.product || "", manual: p.mortar?.manual ?? "" }, underlay: { checked: !!p.underlay?.checked, product: p.underlay?.product || "", manual: p.underlay?.manual ?? "", install: !!p.underlay?.install, installMortars: p.underlay?.installMortars || {}, installSkip: p.underlay?.installSkip || {} }, attached: normAttachedJob(p.attached) });
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

// One staged wedi/Schluter basket entry (ADR 0035 step 3): the snap IS the
// reconfigure marker shape ({ mode, cfg }), so a move re-lands through the
// engine exactly like a Reconfigure would. Engine-free on purpose — model.js
// must never import wedi.js/schluter.js (boot path); junk cfgs price as a
// faint row in the drawer instead of crashing here.
// The stepped quantities, hand-added extras and panel-Fit flag ride BESIDE the
// marker, never inside it: the marker is what a Reconfigure reopens on and it
// deliberately carries no session state, but a staged entry still has to
// reproduce the build that was on screen (owner decision 2026-08-31).
const normKitSession = (s) => {
  if (!s || typeof s !== "object") return undefined;
  const out = {};
  if (s.qtyOv && typeof s.qtyOv === "object" && !Array.isArray(s.qtyOv)) {
    const ov = {};
    for (const [k, v] of Object.entries(s.qtyOv)) if (typeof v === "number" && Number.isFinite(v) && v >= 0) ov[k] = v;
    if (Object.keys(ov).length) out.qtyOv = ov;
  }
  const manual = (Array.isArray(s.manual) ? s.manual : []).map((m) => {
    if (!m || typeof m !== "object" || !(+m.qty > 0)) return null;
    const key = typeof m.key === "string" ? m.key.trim() : "";
    const sku = typeof m.sku === "string" ? m.sku.trim() : "";
    return key ? { key, qty: +m.qty } : sku ? { sku, qty: +m.qty } : null;
  }).filter(Boolean);
  if (manual.length) out.manual = manual;
  if (s.panelFit === false) out.panelFit = false;
  return Object.keys(out).length ? out : undefined;
};
// Where a staged entry lands, when it is an UPDATE to a kit already on the job
// rather than a new one. Both ids or nothing: a half-stored target has nothing
// to land on. `kitId` is optional — a legacy anchor saved before ADR 0035 has
// none — and doubles as the staleness check at move time (moveKitEntries).
const normKitTarget = (t) => {
  if (!t || typeof t !== "object") return undefined;
  const areaId = typeof t.areaId === "string" ? t.areaId.trim() : "";
  const rowId = typeof t.rowId === "string" ? t.rowId.trim() : "";
  if (!areaId || !rowId) return undefined;
  return { areaId, rowId, kitId: typeof t.kitId === "string" ? t.kitId : "" };
};
export const normKitBasketEntry = (e) => {
  if (!e || typeof e !== "object" || !e.snap || typeof e.snap !== "object" || !e.snap.cfg || typeof e.snap.cfg !== "object") return null;
  const out = { id: e.id || uid(), kind: "kit", addedAt: e.addedAt || Date.now(), snap: { mode: typeof e.snap.mode === "string" ? e.snap.mode : "custom", cfg: e.snap.cfg } };
  const session = normKitSession(e.session);
  if (session) out.session = session;
  const target = normKitTarget(e.target);
  if (target) out.target = target;
  return out;
};
const normKitBasket = (v) => (Array.isArray(v) ? v.map(normKitBasketEntry).filter(Boolean) : []);

export const normC = (c) => ({ ...c, customerId: c.customerId ?? null, createdAt: c.createdAt || Date.now(), quick: !!c.quick, freight: c.freight !== false, categories: (c.categories || []).map(normA), versions: c.versions || [], attachments: c.attachments || [], salesperson: c.salesperson || null, priceTier: normTier(c.priceTier), customPct: c.customPct ?? "", printPricing: normPrintPricing(c.printPricing), waste: normWasteJob(c.waste), sheogaBasket: (c.sheogaBasket || []).map(normBasketEntry).filter(Boolean), wediBasket: normKitBasket(c.wediBasket), schluterBasket: normKitBasket(c.schluterBasket), optionNames: (() => { const out = {}; const v = c.optionNames; if (v && typeof v === "object") for (const s of OPTION_SLOTS) { const n = typeof v[s] === "string" ? v[s].trim() : ""; if (n) out[s] = n; } return out; })() });

// --- configurator kit landing (ADR 0035) ----------------------------------
// One configurator emission (anchor + companions) is one KIT: every line lands
// carrying the same kitId so a later reconfigure can replace the whole set.
const VENDOR_KEYS = ["sheoga", "wedi", "schluter"];
const vendorOf = (p) => VENDOR_KEYS.find((k) => p?.[k]);
const hasCfg = (p) => VENDOR_KEYS.some((k) => p?.[k]?.cfg);
// A companion is any vendor-marked line with no cfg of its own — wedi/Schluter
// { part: true } and the Sheoga fee mark alike.
const isCompanion = (p, v) => !!p?.[v] && !p[v].cfg;
// A bundle's anchor (the row whose marker carries the whole bundle snap) OWNS
// its group: re-emitting or deleting the bundle takes every width and pooled
// fee. Only a bundle-less anchor defers to the sibling guard below.
const ownsGroup = (p) => VENDOR_KEYS.some((k) => p?.[k]?.bundle);
// The rows a kit's anchor takes with it — shared by landing and delete so the
// two can never disagree. `v` is the vendor whose companions a legacy
// (kitId-less) anchor may consume.
const kitCompanionIds = (categories, a, anchor, v) => {
  const remove = new Set();
  if (anchor.kitId) {
    const group = categories.flatMap((c) => c.products).filter((p) => p.kitId === anchor.kitId && p.id !== anchor.id);
    if (ownsGroup(anchor) || !group.some(hasCfg)) group.forEach((p) => remove.add(p.id));
  } else if (v && anchor[v]?.cfg) {
    const i = a.products.findIndex((p) => p.id === anchor.id);
    for (let j = i + 1; j < a.products.length; j++) {
      const r = a.products[j];
      if (r.kitId || !isCompanion(r, v)) break;
      remove.add(r.id);
    }
  }
  return remove;
};
// Idempotent: lines already carrying a kitId keep it, so per-entry basket
// stamps survive the shared landing helpers restamping the flattened array.
export const stampKit = (lines) => {
  const kid = uid();
  return (lines || []).map((l) => (l.kitId ? l : { ...l, kitId: kid }));
};
// The one landing rule for configurator lines: the anchor row is filled in
// place, companions insert after it, and the OLD kit's companions are removed —
// by kitId group when the anchor has one (refused if the group holds another
// cfg-bearing row: a bundle sibling or a duplicated anchor is never deleted by
// editing its neighbor — except by the bundle's OWN anchor (marker carries the
// bundle snap): ownsGroup, it takes the whole group), else — a legacy
// reconfigure — by consuming the contiguous run of same-vendor, kitId-less
// companions directly below the anchor. A fresh add (anchor without a
// same-vendor cfg) removes nothing.
// Returns the next categories, or null when there is nothing to land on.
export const landKitLines = (categories, aid, pid, lines) => {
  if (!(lines || []).length) return null;
  const a = (categories || []).find((x) => x.id === aid);
  const anchor = a?.products.find((p) => p.id === pid);
  if (!anchor) return null;
  const stamped = stampKit(lines);
  const remove = kitCompanionIds(categories, a, anchor, vendorOf(stamped[0]));
  return categories.map((c) => ({ ...c, products: c.products.flatMap((p) => {
    if (p.id === pid) return [{ ...p, ...stamped[0] }, ...stamped.slice(1).map((patch) => ({ ...newProduct(), ...patch }))];
    return remove.has(p.id) ? [] : [p];
  }) }));
};
// Append a kit's lines as fresh rows at the end of an area — the landing for
// an emission that isn't updating anything. Its own kitId per call, so two
// entries moved in one click stay two kits.
export const appendKitLines = (categories, aid, lines) => {
  const stamped = stampKit(lines);
  return (categories || []).map((a) => (a.id === aid
    ? { ...a, products: [...a.products, ...stamped.map((patch) => ({ ...newProduct(), ...patch }))] }
    : a));
};
// Land staged basket entries in ONE pass over the accumulating categories (the
// caller writes a single patch — usedirectory's setter is non-functional, so
// two updateProject calls in a tick clobber each other).
//
// An entry staged from a reconfigure carries a `target`, so it REPLACES that
// kit's lines through landKitLines instead of appending a second copy of the
// same shower — the whole point of the amendment: updating a placed kit used
// to mean staging a new one and hand-deleting the old.
//
// The target is honoured only while it still points at the kit that was
// staged. If the row is gone, or now belongs to a different kit, the lines
// APPEND and the entry counts as `stranded` for the caller to report: landing
// on whatever took the row's place would silently clobber a kit nobody asked
// to touch, which is worse than a duplicate the salesperson can see and
// delete.
export const moveKitEntries = (categories, aid, groups) => {
  let cats = categories || [];
  let stranded = 0;
  for (const g of groups || []) {
    const lines = stampKit(g?.lines || []);
    if (!lines.length) continue;
    const t = g.target;
    const row = t && cats.find((c) => c.id === t.areaId)?.products.find((p) => p.id === t.rowId);
    const next = row && (!t.kitId || row.kitId === t.kitId) ? landKitLines(cats, t.areaId, t.rowId, lines) : null;
    if (next) { cats = next; continue; }
    if (t) stranded++;
    cats = appendKitLines(cats, aid, lines);
  }
  return { categories: cats, stranded };
};
// Delete a placed kit: the anchor row plus everything kitCompanionIds says is
// its — the basket drawer's "Remove" (ADR 0035 step 2). Null when the anchor
// is already gone.
export const removeKitLines = (categories, aid, pid) => {
  const a = (categories || []).find((x) => x.id === aid);
  const anchor = a?.products.find((p) => p.id === pid);
  if (!anchor) return null;
  const remove = kitCompanionIds(categories, a, anchor, vendorOf(anchor));
  remove.add(pid);
  return categories.map((c) => ({ ...c, products: c.products.filter((p) => !remove.has(p.id)) }));
};
// The derived "in this project" list (ADR 0035: the rows ARE the registry —
// placed kits are never stored twice). One entry per reconfigurable anchor of
// `vendor`; a stamped bundle's sibling widths fold under their anchor, while a
// LEGACY bundle (moved before the snap existed) lists each width on its own.
export const placedKits = (categories, vendor) => {
  const cats = categories || [];
  const bundleKits = new Set();
  for (const c of cats) for (const p of c.products || []) if (p[vendor]?.bundle && p.kitId) bundleKits.add(p.kitId);
  const out = [];
  cats.forEach((c, i) => (c.products || []).forEach((p) => {
    const m = p[vendor];
    if (!m?.cfg) return;
    if (m.multiWidth && !m.bundle && p.kitId && bundleKits.has(p.kitId)) return;
    out.push({ rowId: p.id, kitId: p.kitId || "", areaId: c.id, areaName: areaLabel(c, i), marker: m, qty: p.qty ?? "", markupPct: p.markupPct ?? "" });
  }));
  return out;
};

// personData is what gets written back to a person's data jsonb; the person/
// builder row mappers and selects live in bootload.js.
export const personData = ({ id, createdAt, updatedAt, builderId, ...rest }) => rest;
