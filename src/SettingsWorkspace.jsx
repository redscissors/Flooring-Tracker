import { useState, useRef } from "react";
import { Plus, Trash2, Download, Upload, X, Check, ChevronRight, Pencil, Percent, BookOpen, Package, Paintbrush, Layers, Database, Link2, Link2Off, MoreHorizontal, Sun, Moon, Laptop, User, Lock, Star, Tag } from "lucide-react";
import { offeredGrouts, offeredMortars, isOffered, setCatalogDefault, isDuplicateName, addCompany, addProduct, removeProduct, removeCompany, renameProduct, addCategory, updateCategory, removeCategory, isDuplicateCategoryName, isDuplicateAttachedName, offeredAttached } from "./catalog.js";
import { stockBaseCompanion } from "./stock.js";
import { deriveSeriesRule, matchRule, parseColorToken, normBookFamily, familyWarnings, linkedItemState, proposeLinks, applyProposals } from "./booklink.js";
import { uid } from "./model.js";
import { DotMenu, Modal } from "./widgets.jsx";
import { StockSearch, FamilySearch } from "./search.jsx";
import { PriceBookLibrary } from "./pricebooklib.jsx";

// The shared grout/mortar catalog editor: a Company → Product tree. Each company
// and product has an enabled checkbox (show/hide for the job dropdowns); a
// product's numbers are shown and editable only while it is enabled, but stay
// stored when off. All edits flow up through onChange(newCatalog).
// The PC-first Settings workspace (issue 007): near-fullscreen, left-nav
// sections, master→detail catalog editing. Pure UI — every write still flows
// through setSettings and the import/backup handlers passed in from App.

// The Materials & add-ons library's built-in categories (spec 2026-07-15,
// PR 1). Locked: math and floor scope live in code; only their catalog
// content and chip default are team-editable. Custom add-on categories
// join this list in a later PR.
const MATERIAL_CATEGORIES = [
  { id: "grout", label: "Grout", kind: "grouts", icon: Paintbrush, applies: "Tile", math: "Volumetric — scales with tile size, joint & thickness" },
  { id: "mortar", label: "Mortar", kind: "mortars", icon: Package, applies: "Tile", math: "Tiered coverage by the tile's longest side" },
  { id: "underlay", label: "Underlayment", kind: "underlayments", icon: Layers, applies: "Per product — the flooring-type chips on each product", math: "Flat sq ft coverage · optional install materials" },
];

// Escapes regex metacharacters out of a book-row word before it's used to
// build a live RegExp — rule.prefix is user-editable text (e.g. "(RTU)",
// "A&B+"), and an unescaped metachar there throws on every render.
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Turns one picked stock-book row into a saved color family (spec 2026-07-21):
// derives a series rule from sibling descriptions, previews the matched
// colors, and offers a base-unit pairing and a matched caulk line before
// saving.
function FamilyConfirm({ seed, bookStock, books, existingNames, inp, lbl, onSave, onClose }) {
  // seed: { bookId, description } — the picked grout row.
  const items = bookStock[seed.bookId] || [];
  const descs = items.map((it) => it.description);
  const [name, setName] = useState("");
  const [rule, setRule] = useState(() => deriveSeriesRule(seed.description, descs));
  const [baseSkus, setBaseSkus] = useState({ default: "", variant: "" });
  const [caulkSeed, setCaulkSeed] = useState(null); // a picked caulk row → rule derived from it
  const [error, setError] = useState("");
  const colors = items
    .filter((it) => it.active !== false && !it.disabled && ![baseSkus.default, baseSkus.variant].includes(it.sku))
    .map((it) => ({ it, token: matchRule(rule, it.description) }))
    .filter((x) => x.token)
    .map((x) => ({ ...parseColorToken(x.token), sku: x.it.sku, price: x.it.price }));
  // Base candidates: same book, share the rule's prefix words but DON'T match as
  // a color row and smell like a base (the Laticrete wordings).
  const baseCandidates = items.filter((it) => !matchRule(rule, it.description) && /part a&b|grout base|full unit|commercial unit|sanded/i.test(it.description) && new RegExp(escRe(rule.prefix.split(/\s+/).find((w) => w.length > 4) || " "), "i").test(it.description));
  const caulkBook = caulkSeed ? caulkSeed.bookId : seed.bookId;
  const caulkRule = caulkSeed ? deriveSeriesRule(caulkSeed.description, (bookStock[caulkSeed.bookId] || []).map((i) => i.description)) : null;
  const caulkMatches = caulkRule ? (bookStock[caulkBook] || []).filter((it) => matchRule(caulkRule, it.description)).length : 0;
  const save = () => {
    const n = name.trim();
    if (!n) { setError("Family name is required."); return; }
    if (existingNames.includes(n.toLowerCase())) { setError(`A family named "${n}" already exists.`); return; }
    if (!colors.length) { setError("The rule matches no color rows — adjust the prefix/suffix."); return; }
    onSave(normBookFamily({ name: n, bookId: seed.bookId, rule, baseSkus, caulk: caulkRule ? { bookId: caulkBook, ...caulkRule } : null, cache: colors.map((c) => ({ color: c.name || c.num, num: c.num, sku: c.sku, price: c.price })) }));
  };
  return (
    <Modal title="New color family" onClose={onClose}>
      <label className={lbl}>Family name (what jobs show, e.g. "SpectraLock Pro")</label>
      <input className={inp} value={name} autoFocus onChange={(e) => setName(e.target.value)} />
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div><label className={lbl}>Rows start with</label><input className={inp} value={rule.prefix} onChange={(e) => setRule({ ...rule, prefix: e.target.value })} /></div>
        <div><label className={lbl}>…and end with</label><input className={inp} value={rule.suffix} onChange={(e) => setRule({ ...rule, suffix: e.target.value })} /></div>
      </div>
      <div className="mt-2 rounded-lg border border-slate-200 p-2.5 max-h-40 overflow-y-auto">
        <div className="text-[11px] text-slate-400 mb-1">{colors.length} colors match — new colors in future re-imports join automatically</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">{colors.map((c) => <div key={c.sku} className="flex items-baseline gap-2 text-xs"><span className="truncate">{c.name || c.num}</span><span className="ft-mono text-[10px] text-slate-400 ml-auto shrink-0">{c.sku}</span></div>)}</div>
      </div>
      {baseCandidates.length > 0 && (
        <div className="mt-3">
          <label className={lbl}>Base units (two-part grouts — ADR 0006)</label>
          {baseCandidates.map((b) => (
            <label key={b.sku} className="flex items-center gap-2 text-xs py-0.5">
              <input type="radio" name="fam-base-d" checked={baseSkus.default === b.sku} onChange={() => setBaseSkus((s) => ({ default: b.sku, variant: s.variant === b.sku ? "" : s.variant }))} /> default
              <input type="radio" name="fam-base-v" checked={baseSkus.variant === b.sku} onChange={() => setBaseSkus((s) => ({ default: s.default === b.sku ? "" : s.default, variant: b.sku }))} /> variant
              <span className="truncate flex-1">{b.description}</span><span className="ft-mono text-[10px] text-slate-400">{b.sku}</span>
            </label>
          ))}
        </div>
      )}
      <div className="mt-3">
        <label className={lbl}>Matched caulk line {caulkRule && <span className="text-slate-400 font-normal normal-case">— {caulkMatches} rows, matched to colors by number</span>}</label>
        <StockSearch stock={Object.values(bookStock).flat().filter((it) => /caulk|latasil/i.test(it.description))} inp={inp} placeholder='Pick any one caulk row of the matching line (e.g. "latasil almond")…' onPick={(it) => setCaulkSeed({ bookId: it.bookId, description: it.description })} />
        {caulkSeed && <button onClick={() => setCaulkSeed(null)} className="text-xs text-slate-400 hover:text-red-500 mt-1">No matched caulk</button>}
      </div>
      {error && <div className="text-xs text-red-500 mt-2">{error}</div>}
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button>
        <button onClick={save} className="text-sm rounded-lg bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700">Create family</button>
      </div>
    </Modal>
  );
}

// Assisted migration pass (spec 2026-07-21 §5): proposes a link for every
// catalog product that carries a SKU but no link yet, matching it against the
// imported stock books. All proposals start checked; unmatched rows (no book
// carries the SKU, or more than one does) are listed but never auto-linked.
function LinkMigration({ catalog, bookStock, books, onApply, onClose }) {
  const [{ proposals, unmatched }] = useState(() => proposeLinks(catalog, bookStock, books));
  const [checked, setChecked] = useState(() => new Set(proposals.map((_, i) => i)));
  const toggle = (i) => setChecked((s) => { const next = new Set(s); if (next.has(i)) next.delete(i); else next.add(i); return next; });
  const selected = proposals.filter((_, i) => checked.has(i));
  const byCompany = new Map();
  proposals.forEach((pr, i) => { if (!byCompany.has(pr.companyName)) byCompany.set(pr.companyName, []); byCompany.get(pr.companyName).push({ ...pr, idx: i }); });
  return (
    <Modal title="Link products to stock books" onClose={onClose}>
      <p className="text-xs text-slate-500 mb-2">Matched by SKU against the imported stock books — uncheck any you don't want linked.</p>
      <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
        {[...byCompany.entries()].map(([companyName, rows]) => (
          <div key={companyName} className="p-2">
            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">{companyName}</div>
            {rows.map((pr) => (
              <label key={pr.idx} className="flex items-center gap-2 text-xs py-1">
                <input type="checkbox" checked={checked.has(pr.idx)} onChange={() => toggle(pr.idx)} />
                <span className="truncate">{pr.companyName} · {pr.name} → {pr.bookName} · <span className="ft-mono">{pr.sku}</span></span>
              </label>
            ))}
          </div>
        ))}
        {!proposals.length && <p className="p-3 text-xs text-slate-400">No matches found.</p>}
      </div>
      {unmatched.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Unmatched</div>
          <div className="max-h-32 overflow-y-auto space-y-0.5">
            {unmatched.map((u, i) => (
              <div key={`${u.sku}-${i}`} className="text-xs text-slate-500">{u.name} · <span className="ft-mono">{u.sku}</span> — {u.reason === "none" ? "not in any stock book" : "in several books — link it from the product page"}</div>
            ))}
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button>
        <button onClick={() => onApply(selected)} disabled={!selected.length} className="text-sm rounded-lg bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700 disabled:opacity-50">Apply {selected.length} links</button>
      </div>
    </Modal>
  );
}

export default function SettingsWorkspace({ onClose, settings, setSettings, stock, stockReady, gFamilies, importing, importPriceBook, importStockFile, pbRef, exportBackup, importBackup, fileRef, inp, lbl, types, typeLabels, theme, setTheme, headerLayout, setHeaderLayout, profile, saveProfile, user, books, addBook, updateBook, delBook, loadBookItems, applyBookImport, loadBookVersions, loadBookVersionSnapshot, pinBookVersion, updateBookItem, setBookItemsDisabled, reviewBookItemFlags, setStockItemsDisabled, rollbackStock, bookStock = {}, bookStockReady, refreshBookStock }) {
  const catalog = settings.catalog;
  const onChange = (c) => setSettings({ catalog: c });
  const [section, setSection] = useState("materials");
  const [cat, setCat] = useState("grout"); // which Materials & add-ons category is open
  // Master→detail selection: an existing product, or (via `adding`) an
  // add-draft under a company. View state only, never persisted.
  const [sel, setSel] = useState(null); // { companyId, kind, productId }
  const [newCompany, setNewCompany] = useState("");
  const [adding, setAdding] = useState(null); // { companyId, kind }
  const [draft, setDraft] = useState({});
  const [error, setError] = useState("");
  const [confirmDel, setConfirmDel] = useState(null); // { companyId, kind, productId }
  const [menuFor, setMenuFor] = useState(null); // company id with the ⋯ menu open
  const menuBtns = useRef({}); // company id -> its ⋯ button, the open menu's DotMenu anchor
  const [showOthers, setShowOthers] = useState(false); // "Not in this section" group
  const [rename, setRename] = useState(null); // { value, error } — renaming the selected product
  const [coRename, setCoRename] = useState(null); // { id, value } — renaming a company inline
  const [addingCat, setAddingCat] = useState(false); // New-category modal
  const [catDraft, setCatDraft] = useState({ name: "", floorTypes: [], math: "coverage" });
  const [catError, setCatError] = useState("");
  const [catRename, setCatRename] = useState(null); // { value, error } — renaming the open custom category
  const [confirmDelCat, setConfirmDelCat] = useState(false);
  const [famSeed, setFamSeed] = useState(null); // FamilyConfirm opener: { pick } | { bookId, description, forDraft|forProduct }
  const [showLinkMigration, setShowLinkMigration] = useState(false); // LinkMigration opener

  // Spread the whole catalog, not just companies, so sibling fields
  // (defaults, removedSeeds) survive a company/product edit.
  const setCompany = (cid, patch) => onChange({ ...catalog, companies: catalog.companies.map((co) => co.id === cid ? { ...co, ...patch } : co) });
  const setProduct = (cid, kind, pid, patch) => onChange({ ...catalog, companies: catalog.companies.map((co) => co.id === cid ? { ...co, [kind]: co[kind].map((p) => p.id === pid ? { ...p, ...patch } : p) } : co) });
  const setInstallItem = (cid, u, mid, patch) => setProduct(cid, "underlayments", u.id, { install: (u.install || []).map((m) => m.id === mid ? { ...m, ...patch } : m) });
  const delInstallItem = (cid, u, mid) => setProduct(cid, "underlayments", u.id, { install: (u.install || []).filter((m) => m.id !== mid) });
  const newInstallItem = (kind) => kind === "mortar" ? { id: uid(), kind: "mortar", product: "", coverage: "" } : { id: uid(), kind: "custom", name: "", coverage: "", unit: "units", price: "", sku: "" };
  const addInstallItem = (cid, u, kind) => setProduct(cid, "underlayments", u.id, { install: [...(u.install || []), newInstallItem(kind)] });
  // Switching a row's kind rebuilds it (the field sets don't overlap), keeping
  // only the id and coverage.
  const setInstallKind = (cid, u, mid, kind) => setProduct(cid, "underlayments", u.id, { install: (u.install || []).map((m) => m.id !== mid || m.kind === kind ? m : { ...newInstallItem(kind), id: m.id, coverage: m.coverage }) });
  const mortarNames = catalog.companies.flatMap((c) => c.mortars.map((m) => m.name));

  const kindLabel = (kind) => kind === "grouts" ? "grout" : kind === "mortars" ? "mortar" : kind === "attached" ? (customCat?.name || "add-on") : "underlayment";
  // The team's chip default for a kind, compared name-wise the way jobs resolve.
  const isDefaultMaterial = (kind, name) => String(catalog.defaults?.[{ grouts: "grout", mortars: "mortar", underlayments: "underlay" }[kind]] || "").trim().toLowerCase() === String(name || "").trim().toLowerCase();
  // An attached product's chip default lives on ITS category (only reachable
  // while that category is the open one, so customCat is the right scope).
  const isCategoryDefault = (p) => !!customCat && String(customCat.default || "").trim().toLowerCase() === String(p?.name || "").trim().toLowerCase() && customCat.default !== "";
  const startAdd = (companyId, kind) => { setAdding({ companyId, kind }); setSel(null); setConfirmDel(null); setRename(null); setDraft(kind === "attached" ? { name: "", coverage: "", unit: "units", price: "", sku: "", categoryId: cat } : kind === "grouts" ? { name: "", coverage: "", unit: "units", price: "", sku: "", book: "", base: null } : kind === "mortars" ? { name: "", tier1: "", tier2: "", tier3: "", unit: "units", price: "", sku: "" } : { name: "", coverage: "", unit: "rolls", price: "", sku: "", types: [] }); setError(""); };
  const cancelAdd = () => { setAdding(null); setError(""); };
  const pickProduct = (companyId, kind, productId) => { setSel({ companyId, kind, productId }); setAdding(null); setConfirmDel(null); setRename(null); };
  const submitAdd = () => {
    const name = (draft.name || "").trim();
    if (!name) { setError("Product name is required."); return; }
    const dup = adding.kind === "attached" ? isDuplicateAttachedName(catalog, draft.categoryId, name) : isDuplicateName(catalog, adding.kind, name);
    if (dup) { setError(`A ${kindLabel(adding.kind)} named "${name}" already exists.`); return; }
    onChange(addProduct(catalog, adding.companyId, adding.kind, { ...draft, name }));
    setAdding(null); setError("");
  };
  // A new company starts empty, so it would land in the collapsed "Not in this
  // section" group — open the add form for it right away so it doesn't seem to
  // vanish.
  const submitCompany = () => { const name = newCompany.trim(); if (!name) return; const next = addCompany(catalog, name); onChange(next); setNewCompany(""); setShowOthers(true); startAdd(next.companies[next.companies.length - 1].id, kindsFor[0]); };
  const openNewCategory = () => { setAddingCat(true); setCatDraft({ name: "", floorTypes: [], math: "coverage" }); setCatError(""); };
  const submitCategory = () => {
    const name = catDraft.name.trim();
    if (!name) { setCatError("Category name is required."); return; }
    if (isDuplicateCategoryName(catalog, name)) { setCatError(`A category named "${name}" already exists.`); return; }
    const next = addCategory(catalog, { ...catDraft, name });
    onChange(next);
    setAddingCat(false); setSel(null); setAdding(null); setConfirmDelCat(false); setCatRename(null);
    setCat(next.categories[next.categories.length - 1].id);
  };
  const openCat = (id) => { setCat(id); setSel(null); setAdding(null); setConfirmDel(null); setMenuFor(null); setShowOthers(false); setRename(null); setCoRename(null); setCatRename(null); setConfirmDelCat(false); };
  // The book rarely carries coverage, so most items still need it typed in —
  // mortars always do (three tiers can't come from one number). The pick keeps
  // the item's SKU on the product (ADR 0006), and a Laticrete pigment brings
  // its default base unit along (editable before and after adding).
  const fillFromStock = (it) => setDraft((d) => ({
    ...d,
    name: it.product || it.description,
    sku: it.sku,
    ...(it.price != null ? { price: String(it.price) } : it.priceSqft != null ? { price: String(it.priceSqft) } : {}),
    ...(adding.kind !== "mortars" && it.coverage != null ? { coverage: String(it.coverage) } : {}),
    ...(adding.kind === "grouts" ? { base: stockBaseCompanion(it, stock) } : {}),
    // A pick from the Grout & Caulk color matrix also suggests the color
    // family link (ADR 0007) — the grout offers that family's colors.
    ...(adding.kind === "grouts" && it.sheet === "Grout & Caulk" && it.product && it.color ? { book: it.product } : {}),
    ...(it.bookId ? { link: { bookId: it.bookId, sku: it.sku } } : {}),
    // Transient seed for the "Set up color family…" chip below — never saved
    // (addProduct's grout field shape whitelists fields, so this drops off).
    ...(it.bookId ? { _desc: it.description } : {}),
  }));

  const box = (on, onClick, title) => (
    <button onClick={onClick} title={title} className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${on ? "bg-indigo-600 text-white" : "border border-slate-300"}`}>{on && <Check size={12} />}</button>
  );
  const delButton = (co, kind, p) => (
    <button onClick={() => setConfirmDel({ companyId: co.id, kind, productId: p.id })} title={`Delete ${p.name}`} className="text-slate-300 hover:text-red-500 shrink-0"><Trash2 size={13} /></button>
  );
  const delConfirm = (co, kind, p) => confirmDel && confirmDel.companyId === co.id && confirmDel.kind === kind && confirmDel.productId === p.id && (
    <div className="flex items-center gap-2 mt-1.5 text-xs">
      <span className="text-red-600 flex-1">Delete "{p.name}"? Saved jobs that use it keep the name but stop calculating. To just hide it from new jobs, uncheck it instead.</span>
      <button onClick={() => { onChange(removeProduct(catalog, co.id, kind, p.id)); setConfirmDel(null); }} className="rounded-md bg-red-600 text-white px-2.5 py-1 font-medium hover:bg-red-700 shrink-0">Delete</button>
      <button onClick={() => setConfirmDel(null)} className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50 shrink-0">Cancel</button>
    </div>
  );
  const numField = (label, value, onVal) => (
    <div><label className={lbl}>{label}</label><input type="number" value={value} onChange={(e) => onVal(e.target.value)} className={inp} /></div>
  );
  const txtField = (label, value, onVal) => (
    <div><label className={lbl}>{label}</label><input value={value} onChange={(e) => onVal(e.target.value)} className={inp} /></div>
  );
  // Which flooring types an underlayment is offered for. No chips selected = all
  // types (the empty-tag convention in the catalog).
  const typeChips = (selected, onVal, list = types) => {
    const sel = selected || [];
    const toggle = (t) => onVal(sel.includes(t) ? sel.filter((x) => x !== t) : [...sel, t]);
    return (
      <div><label className={lbl}>Offered for {sel.length === 0 && <span className="text-slate-400 font-normal normal-case tracking-normal">(all types)</span>}</label>
        <div className="flex flex-wrap gap-1">{list.map((t) => <button key={t} onClick={() => toggle(t)} className={`text-xs rounded-md px-2 py-1 border ${sel.includes(t) ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>{typeLabels[t]}</button>)}</div>
      </div>
    );
  };
  const floorTypeList = types.filter((t) => t !== "misc");
  // The ERP stock books, flattened, join the shop's own stock as a search
  // source (spec 2026-07-21) — picking a book row stamps a link on the
  // product so re-imports can refresh its price.
  const bookItems = Object.values(bookStock).flat();
  const pickerItems = [...stock, ...bookItems];
  // Cheap opener gate — proposeLinks itself is the source of truth once the
  // modal is open, this is just "is it worth offering the pass at all".
  const hasUnlinkedSku = catalog.companies.some((co) =>
    ["grouts", "mortars", "underlayments", "attached"].some((kind) => (co[kind] || []).some((p) => p.sku && !p.link))
  );
  const bookName = (id) => books.find((b) => b.id === id)?.name || "book";
  const selCo = sel ? catalog.companies.find((c) => c.id === sel.companyId) : null;
  const selProd = selCo ? (selCo[sel.kind] || []).find((p) => p.id === sel.productId) : null;
  const addCo = adding ? catalog.companies.find((c) => c.id === adding.companyId) : null;
  const customCat = (catalog.categories || []).find((c) => c.id === cat);
  const kindsFor = customCat ? ["attached"] : [{ grout: "grouts", mortar: "mortars", underlay: "underlayments" }[cat]];
  // The products a company shows in the current section — attached rows are
  // additionally scoped to the open custom category.
  const prodsOf = (co, kind) => kind === "attached" ? (co.attached || []).filter((p) => p.categoryId === cat) : (co[kind] || []);
  const countAll = (co) => co.grouts.length + co.mortars.length + (co.underlayments?.length || 0) + (co.attached?.length || 0);
  // A company "belongs" to a section by having products of its kinds — the rest
  // sit in a collapsed group so e.g. underlayment-only brands stay out of
  // Grout & colors. Deleting a company's last grout drops it out of the
  // section the same way.
  const inSection = (co) => kindsFor.some((k) => prodsOf(co, k).length > 0);
  const famFor = (g) => (g.book ? gFamilies.find((f) => f.product.toLowerCase() === g.book.toLowerCase()) : null);
  const masterHint = (kind, p) => (kind === "grouts"
    ? (p.book ? (famFor(p) ? `${famFor(p).colors.length} colors · book` : "book link missing") : "standard colors")
    : kind === "mortars" || kind === "attached" ? [p.unit, p.sku ? `SKU ${p.sku}` : ""].filter(Boolean).join(" · ")
      : ((p.types || []).length ? p.types.map((t) => typeLabels[t]).join(", ") : "all types") + ((p.install || []).length ? ` · ${p.install.length} install` : "")
  ) + (p.link ? " · linked" : "");
  const SECTIONS = [
    { id: "profile", label: "Your details", icon: User, hint: profile.name || "salesperson" },
    { id: "general", label: "General", icon: Percent, hint: "waste %" },
    { id: "book", label: "Price book", icon: BookOpen, hint: books.length ? `${1 + books.length} books` : stock.length ? `${stock.filter((s) => s.active).length} SKUs` : "empty" },
    { id: "materials", label: "Materials & add-ons", icon: Layers, hint: String(catalog.companies.reduce((n, c) => n + c.grouts.length + c.mortars.length + (c.underlayments?.length || 0) + (c.attached?.length || 0), 0)) },
    { id: "backup", label: "Backup & restore", icon: Database, hint: settings.ops?.lastBackup ? new Date(settings.ops.lastBackup.at).toLocaleDateString() : "" },
  ];

  const companyHeader = (co) => (
    <div className="px-3 py-1 flex items-center gap-2">
      {box(co.enabled, () => setCompany(co.id, { enabled: !co.enabled }), co.enabled ? "Hide all of this company's products" : "Show this company's products")}
      {coRename?.id === co.id ? (
        <input autoFocus value={coRename.value} onChange={(e) => setCoRename({ id: co.id, value: e.target.value })}
          onKeyDown={(e) => { if (e.key === "Enter") { const n = coRename.value.trim(); if (n) setCompany(co.id, { name: n }); setCoRename(null); } if (e.key === "Escape") setCoRename(null); }}
          onBlur={() => setCoRename(null)} placeholder="Enter to save" className={inp + " flex-1 min-w-0 !py-0.5 !text-xs"} />
      ) : (
        <span className={`ft-eyebrow text-[9px] flex-1 truncate ${co.enabled ? "" : "opacity-50"}`}>{co.name}</span>
      )}
      <button ref={(el) => { menuBtns.current[co.id] = el; }} onClick={() => setMenuFor(menuFor === co.id ? null : co.id)} title="Company options" className={`shrink-0 ${menuFor === co.id ? "text-slate-600" : "text-slate-300 hover:text-slate-600"}`}><MoreHorizontal size={14} /></button>
      <DotMenu open={menuFor === co.id} onClose={() => setMenuFor(null)} anchorRef={{ get current() { return menuBtns.current[co.id]; } }} width={192}>
        {kindsFor.map((kind) => (
          <button key={kind} onClick={() => { setMenuFor(null); startAdd(co.id, kind); }} className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-1.5"><Plus size={12} className="text-slate-400" /> Add {kindLabel(kind)}</button>
        ))}
        <button onClick={() => { setMenuFor(null); setCoRename({ id: co.id, value: co.name }); }} className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-1.5"><Pencil size={12} className="text-slate-400" /> Rename company</button>
        {countAll(co) === 0 && <button onClick={() => { setMenuFor(null); onChange(removeCompany(catalog, co.id)); }} className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-1.5"><Trash2 size={12} /> Delete company</button>}
      </DotMenu>
    </div>
  );

  const detailHeader = (co, kind, p, tag) => {
    const submitRename = () => {
      const name = (rename?.value || "").trim();
      if (!name) { setRename({ ...rename, error: "Name is required." }); return; }
      if (name.toLowerCase() !== p.name.trim().toLowerCase() && (kind === "attached" ? isDuplicateAttachedName(catalog, p.categoryId, name) : isDuplicateName(catalog, kind, name))) { setRename({ ...rename, error: `A ${kindLabel(kind)} named "${name}" already exists.` }); return; }
      onChange(renameProduct(catalog, co.id, kind, p.id, name));
      setRename(null);
    };
    return (
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="ft-eyebrow text-[9px] mb-1">{co.name} · {tag}</div>
          {rename ? (
            <div className="max-w-md">
              <div className="flex items-center gap-2">
                <input autoFocus value={rename.value} onChange={(e) => setRename({ value: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") submitRename(); if (e.key === "Escape") setRename(null); }} className={inp + " font-medium"} />
                <button onClick={submitRename} className="text-sm rounded-md bg-indigo-600 text-white px-3 py-1.5 hover:bg-indigo-700 shrink-0">Save</button>
                <button onClick={() => setRename(null)} className="text-sm rounded-md border border-slate-200 px-3 py-1.5 hover:bg-slate-50 shrink-0">Cancel</button>
              </div>
              {rename.error && <div className="text-xs text-red-500 mt-1">{rename.error}</div>}
              <p className="text-[11px] text-amber-600 mt-1.5">Jobs resolve materials by name — saved jobs keep the old name and stop calculating until this product is re-picked on them.</p>
            </div>
          ) : (
            <h2 className="ft-serif text-3xl leading-tight">{p.name}
              <button onClick={() => setRename({ value: p.name })} title={`Rename ${p.name}`} className="ml-2.5 text-slate-300 hover:text-slate-600 align-middle"><Pencil size={15} /></button>
            </h2>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 pt-1">
          {((kind === "attached" ? isCategoryDefault(p) : isDefaultMaterial(kind, p.name))
            ? <span title={kind === "attached" ? `Rows turning on the ${customCat?.name} chip start with this product` : kind === "underlayments" ? "Rows turning on the underlayment chip start with this product" : "New tile rows start with this material"} className="flex items-center gap-1 text-xs font-medium text-indigo-600"><Star size={12} className="fill-current" /> Default</span>
            : <button onClick={() => onChange(kind === "attached" ? updateCategory(catalog, p.categoryId, { default: p.name }) : setCatalogDefault(catalog, kind, p.name))} title={kind === "attached" ? `Make this the product the ${customCat?.name} chip starts with` : kind === "underlayments" ? "Make this the product the underlayment chip starts with" : "Make this the default new tile rows start with"} className="text-xs text-slate-400 hover:text-indigo-600">Set as default</button>)}
          <label className="flex items-center gap-1.5 text-xs text-slate-500">{box(p.enabled, () => setProduct(co.id, kind, p.id, { enabled: !p.enabled }), p.enabled ? "Hide from job dropdowns" : "Offer in job dropdowns")} offered on jobs</label>
          {delButton(co, kind, p)}
        </div>
      </div>
    );
  };

  // Shown while no product is selected: the built-in category's locked
  // identity plus its one team-editable knob, the chip default. Underlay's
  // blank option = "first offered", today's pre-default behavior.
  const renderCategoryPane = () => {
    const meta = MATERIAL_CATEGORIES.find((c) => c.id === cat);
    const offered = cat === "grout" ? offeredGrouts(catalog)
      : cat === "mortar" ? offeredMortars(catalog)
        : catalog.companies.flatMap((co) => (co.underlayments || []).filter((u) => isOffered(co, u)).map((u) => u.name));
    const current = String(catalog.defaults?.[cat] || "");
    const Icon = meta.icon;
    return (
      <div className="max-w-xl">
        <p className="ft-eyebrow text-[10px] text-slate-400">Materials &amp; add-ons · built-in</p>
        <h2 className="ft-serif text-3xl leading-tight mt-1 flex items-center gap-2.5"><Icon size={22} className="text-slate-400" /> {meta.label} <Lock size={14} className="text-slate-300" /></h2>
        <div className="mt-5 space-y-2 text-sm">
          <div className="flex gap-2"><span className="w-24 shrink-0 text-[11px] uppercase tracking-wide text-slate-400 pt-0.5">Applies to</span><span className="text-slate-500">{meta.applies}</span></div>
          <div className="flex gap-2"><span className="w-24 shrink-0 text-[11px] uppercase tracking-wide text-slate-400 pt-0.5">Quantity</span><span className="text-slate-500">{meta.math}</span></div>
        </div>
        <div className="mt-6 max-w-xs">
          <label className={lbl}>Default product</label>
          <select value={offered.includes(current) ? current : ""} onChange={(e) => onChange(setCatalogDefault(catalog, meta.kind, e.target.value))} className={inp}>
            {cat === "underlay" ? <option value="">— first offered —</option> : !offered.includes(current) && <option value="">Select…</option>}
            {offered.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <p className="text-[11px] text-slate-400 mt-1.5">{cat === "underlay" ? "Pre-selected when a row's underlayment chip is turned on." : "New tile rows start with this product."}</p>
        </div>
        <p className="text-xs text-slate-400 mt-8">Pick a product on the left to edit its numbers — or add one under its company.</p>
      </div>
    );
  };

  // The custom-category counterpart: everything the built-in pane locks is
  // editable here (spec 2026-07-15, PR 2). Job chips arrive with PR 3.
  const renderCustomCategoryPane = () => {
    const c = customCat;
    const offered = offeredAttached(catalog, c.id);
    const productCount = catalog.companies.reduce((n, co) => n + (co.attached || []).filter((p) => p.categoryId === c.id).length, 0);
    const submitCatRename = () => {
      const name = (catRename?.value || "").trim();
      if (!name) { setCatRename({ ...catRename, error: "Name is required." }); return; }
      if (isDuplicateCategoryName(catalog, name, c.id)) { setCatRename({ ...catRename, error: `A category named "${name}" already exists.` }); return; }
      onChange(updateCategory(catalog, c.id, { name }));
      setCatRename(null);
    };
    return (
      <div className="max-w-xl">
        <p className="ft-eyebrow text-[10px] text-slate-400">Materials &amp; add-ons · add-on</p>
        {catRename ? (
          <div className="max-w-md mt-1">
            <div className="flex items-center gap-2">
              <input autoFocus value={catRename.value} onChange={(e) => setCatRename({ value: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") submitCatRename(); if (e.key === "Escape") setCatRename(null); }} className={inp + " font-medium"} />
              <button onClick={submitCatRename} className="text-sm rounded-md bg-indigo-600 text-white px-3 py-1.5 hover:bg-indigo-700 shrink-0">Save</button>
              <button onClick={() => setCatRename(null)} className="text-sm rounded-md border border-slate-200 px-3 py-1.5 hover:bg-slate-50 shrink-0">Cancel</button>
            </div>
            {catRename.error && <div className="text-xs text-red-500 mt-1">{catRename.error}</div>}
          </div>
        ) : (
          <h2 className="ft-serif text-3xl leading-tight mt-1 flex items-center gap-2.5"><Tag size={22} className="text-slate-400" /> {c.name}
            <button onClick={() => setCatRename({ value: c.name })} title={`Rename ${c.name}`} className="text-slate-300 hover:text-slate-600"><Pencil size={15} /></button>
          </h2>
        )}
        <div className="mt-5 space-y-5 max-w-md">
          <div>
            {typeChips(c.floorTypes, (v) => onChange(updateCategory(catalog, c.id, { floorTypes: v })), floorTypeList)}
            <p className="text-[11px] text-slate-400 mt-1">Which product rows offer this add-on's chip. None selected = every type.</p>
          </div>
          <div>
            <label className={lbl}>Quantity</label>
            <div className="inline-flex rounded-md border border-slate-200 overflow-hidden text-sm">
              {[["coverage", "Coverage"], ["manual", "Manual"]].map(([k, t]) => (
                <button key={k} onClick={() => onChange(updateCategory(catalog, c.id, { math: k }))} className={`px-3.5 py-2 font-medium ${c.math === k ? "bg-indigo-600 text-white" : "ft-field text-slate-500 hover:bg-slate-50"}`}>{t}</button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">{c.math === "coverage" ? "One unit covers a set sq ft — quantities scale off the row's area plus waste, with a per-row manual override." : "A typed per-row quantity (starts at 1) — no area math."}</p>
          </div>
          <div className="max-w-xs">
            <label className={lbl}>Default product</label>
            <select value={offered.includes(c.default) ? c.default : ""} onChange={(e) => onChange(updateCategory(catalog, c.id, { default: e.target.value }))} className={inp}>
              <option value="">— first offered —</option>
              {offered.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <p className="text-[11px] text-slate-400 mt-1.5">Pre-selected when a row's {c.name} chip is turned on.</p>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">{box(c.enabled, () => onChange(updateCategory(catalog, c.id, { enabled: !c.enabled })), c.enabled ? "Hide this add-on's chip from job rows" : "Offer this add-on's chip on job rows")} offered on jobs</label>
        </div>
        <p className="text-xs text-slate-400 mt-6">Job rows pick these up in an upcoming update — for now this builds the catalog.</p>
        <div className="mt-8 pt-5 border-t border-slate-100">
          {confirmDelCat ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-red-600 flex-1">Delete "{c.name}"{productCount ? ` and its ${productCount} product${productCount === 1 ? "" : "s"}` : ""} from every company? Jobs that use them keep the name but stop calculating. To just hide the chip, uncheck "offered on jobs" instead.</span>
              <button onClick={() => { onChange(removeCategory(catalog, c.id)); setConfirmDelCat(false); setSel(null); setCat("grout"); }} className="rounded-md bg-red-600 text-white px-2.5 py-1 font-medium hover:bg-red-700 shrink-0">Delete</button>
              <button onClick={() => setConfirmDelCat(false)} className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50 shrink-0">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelCat(true)} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1"><Trash2 size={12} /> Delete category</button>
          )}
        </div>
      </div>
    );
  };

  // A product picked from a stock book (spec 2026-07-21) shows its link and,
  // once the book row goes stale (removed or a re-import moves the SKU),
  // warns instead of silently keeping the last-known price.
  const linkStrip = (co, kind, p) => {
    if (!p.link) return null;
    const state = linkedItemState(p.link, bookStock);
    const unlink = () => setProduct(co.id, kind, p.id, { link: null });
    return (
      <>
        <div className={`mt-3 flex items-center gap-2 text-xs rounded-md border px-2.5 py-1.5 max-w-xl ${state === "ok" ? "border-slate-200 text-slate-500" : "border-amber-200 text-amber-600"}`}>
          {state === "ok" ? <Link2 size={12} className="shrink-0" /> : <Link2Off size={12} className="shrink-0" />}
          <span className="flex-1">
            {bookName(p.link.bookId)} · <span className="ft-mono">{p.link.sku}</span>
            {state === "inactive" && " — no longer in this book's stock; keeping last known price"}
            {state === "missing" && " — book or SKU not found; keeping last known price"}
          </span>
          <button onClick={unlink} className="text-slate-400 hover:text-red-500 shrink-0">Unlink</button>
        </div>
        {state !== "ok" && bookItems.length > 0 && (
          <div className="mt-1.5 max-w-xl">
            <StockSearch stock={bookItems} inp={inp} placeholder="Relink — search the stock books…"
              onPick={(it) => it.bookId && setProduct(co.id, kind, p.id, { link: { bookId: it.bookId, sku: it.sku }, sku: it.sku, ...(it.price != null ? { price: String(it.price) } : {}) })} />
          </div>
        )}
      </>
    );
  };
  const renderGroutDetail = (co, g) => {
    const family = famFor(g);
    // A book family's rule can go quiet after a re-drop (supplier reworded
    // every row) — projectFamilies then serves the cached colors (booklink.js
    // resolveFamily), so this warns instead of the color list silently going
    // stale with no signal.
    const zeroMatch = familyWarnings(catalog.bookFamilies, bookStock).some((w) => w.kind === "zero-match" && w.name.toLowerCase() === (g.book || "").toLowerCase());
    return (
      <div key={g.id}>
        {detailHeader(co, "grouts", g, "Grout")}
        {delConfirm(co, "grouts", g)}
        {linkStrip(co, "grouts", g)}
        <div className="flex flex-wrap items-end gap-2.5 mt-4">
          <div className="w-36">{numField("Cov. sq ft/unit", g.coverage, (v) => setProduct(co.id, "grouts", g.id, { coverage: v }))}</div>
          <div className="w-24">{txtField("Unit", g.unit, (v) => setProduct(co.id, "grouts", g.id, { unit: v }))}</div>
          <div className="w-28">{numField("$/unit", g.price, (v) => setProduct(co.id, "grouts", g.id, { price: v }))}</div>
          <div className="w-36">{txtField("SKU", g.sku || "", (v) => setProduct(co.id, "grouts", g.id, { sku: v }))}</div>
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">Coverage is calibrated here — the book doesn't carry one. Grout scales for tile size, joint and thickness from the 12×12×3/8" / 1/8" baseline.</p>
        <div className="mt-6 flex items-baseline justify-between gap-3">
          <div className="font-medium text-sm">Colors &amp; SKUs</div>
          {family && <span className="text-[11px] text-slate-400">picking a color on a job stamps that color's SKU on the estimate</span>}
        </div>
        {g.book ? (family ? (
          <>
            {zeroMatch && <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 rounded-md border border-amber-200 px-3 py-2"><Link2Off size={12} className="shrink-0" /> This family's rule matched nothing in the last import — colors shown are the last known set. Re-check the rule.</div>}
            <div className="mt-2 rounded-lg border border-slate-200 p-3 max-h-72 overflow-y-auto">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-0.5">
                {family.colors.map((c) => (
                  <div key={c.sku} className="flex items-baseline gap-2 text-xs py-0.5 min-w-0">
                    <span className="truncate">{c.color}</span>
                    <span className="ft-mono text-[10px] text-slate-400 ml-auto shrink-0">{c.sku}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 rounded-md border border-amber-200 px-3 py-2"><Link2Off size={12} className="shrink-0" /> Linked to "{g.book}", which isn't in the imported book — re-import the price book or re-link below.</div>
        )) : (
          <p className="mt-2 text-xs text-slate-400">No color link — jobs offer the standard color list and grout lines print without a per-color SKU.</p>
        )}
        <div className="mt-2 flex items-center gap-2 max-w-xl">
          {gFamilies.length > 0 ? <FamilySearch families={gFamilies} inp={inp} onPick={(f) => setProduct(co.id, "grouts", g.id, { book: f.product })} />
            : <p className="text-[11px] text-slate-400 flex-1">Import the price book to link a color family.</p>}
          {bookItems.length > 0 && <button onClick={() => setFamSeed({ pick: true, forProduct: { coId: co.id, gId: g.id } })} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium shrink-0">New family from stock book…</button>}
          {g.book && <button onClick={() => setProduct(co.id, "grouts", g.id, { book: "" })} className="text-xs text-slate-400 hover:text-red-500 shrink-0">Unlink colors</button>}
        </div>
        <div className="mt-6 max-w-2xl">
          <label className={lbl}>Base unit <span className="text-slate-400 font-normal normal-case tracking-normal">(a two-part grout's base — ordered with the kits and shown in the order summary; "per" = kits one base covers)</span></label>
          {g.base ? (
            <div className="grid gap-1.5 items-end grid-cols-[1.6fr_.9fr_.6fr_.7fr_.7fr_auto]">
              {txtField("Name", g.base.name, (v) => setProduct(co.id, "grouts", g.id, { base: { ...g.base, name: v } }))}
              {txtField("SKU", g.base.sku, (v) => setProduct(co.id, "grouts", g.id, { base: { ...g.base, sku: v } }))}
              {numField("Per", g.base.per, (v) => setProduct(co.id, "grouts", g.id, { base: { ...g.base, per: v } }))}
              {txtField("Unit", g.base.unit, (v) => setProduct(co.id, "grouts", g.id, { base: { ...g.base, unit: v } }))}
              {numField("$/unit", g.base.price, (v) => setProduct(co.id, "grouts", g.id, { base: { ...g.base, price: v } }))}
              <button onClick={() => setProduct(co.id, "grouts", g.id, { base: null })} title="Remove base unit" className="text-slate-300 hover:text-red-500 pb-2"><X size={14} /></button>
            </div>
          ) : (
            <div>
              {stock.length > 0 && <StockSearch stock={stock} inp={inp} placeholder="Search the book for the base unit…" onPick={(it) => setProduct(co.id, "grouts", g.id, { base: { sku: it.sku, name: it.description || it.product, unit: it.unit || "units", price: it.price ?? 0, per: 1 } })} />}
              <button onClick={() => setProduct(co.id, "grouts", g.id, { base: { sku: "", name: "", unit: "units", price: "", per: 1 } })} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"><Plus size={12} /> Base unit</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMortarDetail = (co, m) => (
    <div key={m.id}>
      {detailHeader(co, "mortars", m, "Mortar")}
      {delConfirm(co, "mortars", m)}
      {linkStrip(co, "mortars", m)}
      <div className="flex flex-wrap items-end gap-2.5 mt-4">
        <div className="w-28">{numField('Tile < 8"', m.tier1, (v) => setProduct(co.id, "mortars", m.id, { tier1: v }))}</div>
        <div className="w-28">{numField('8"–15"', m.tier2, (v) => setProduct(co.id, "mortars", m.id, { tier2: v }))}</div>
        <div className="w-28">{numField('> 15"', m.tier3, (v) => setProduct(co.id, "mortars", m.id, { tier3: v }))}</div>
        <div className="w-24">{txtField("Unit", m.unit, (v) => setProduct(co.id, "mortars", m.id, { unit: v }))}</div>
        <div className="w-28">{numField("$/unit", m.price, (v) => setProduct(co.id, "mortars", m.id, { price: v }))}</div>
        <div className="w-36">{txtField("SKU", m.sku || "", (v) => setProduct(co.id, "mortars", m.id, { sku: v }))}</div>
      </div>
      <p className="text-[11px] text-slate-400 mt-1.5">Coverage sq ft per unit, tiered by the tile's longest side.</p>
    </div>
  );

  const renderUnderlayDetail = (co, u) => (
    <div key={u.id}>
      {detailHeader(co, "underlayments", u, "Underlayment")}
      {delConfirm(co, "underlayments", u)}
      {linkStrip(co, "underlayments", u)}
      <div className="flex flex-wrap items-end gap-2.5 mt-4">
        <div className="w-36">{numField("Cov. sq ft/unit", u.coverage, (v) => setProduct(co.id, "underlayments", u.id, { coverage: v }))}</div>
        <div className="w-24">{txtField("Unit", u.unit, (v) => setProduct(co.id, "underlayments", u.id, { unit: v }))}</div>
        <div className="w-28">{numField("$/unit", u.price, (v) => setProduct(co.id, "underlayments", u.id, { price: v }))}</div>
        <div className="w-36">{txtField("SKU", u.sku || "", (v) => setProduct(co.id, "underlayments", u.id, { sku: v }))}</div>
      </div>
      <div className="mt-4">{typeChips(u.types, (v) => setProduct(co.id, "underlayments", u.id, { types: v }))}</div>
      <div className="mt-6 max-w-3xl">
        <label className={lbl}>Install materials <span className="text-slate-400 font-normal normal-case tracking-normal">(added when a job checks "Install materials"; mortar rows pull unit &amp; price from that mortar and combine with the job's mortar totals)</span></label>
        <div className="space-y-1.5">
          {(u.install || []).map((m) => (
            <div key={m.id} className={`grid gap-1.5 items-end ${m.kind === "mortar" ? "grid-cols-[auto_1.6fr_1fr_auto]" : "grid-cols-[auto_1.3fr_.8fr_.6fr_.6fr_.9fr_auto]"}`}>
              <div><label className={lbl}>Type</label>
                <div className="flex rounded-md border border-slate-200 overflow-hidden text-[11px]">{[["mortar", "Mortar"], ["custom", "Other"]].map(([k, l]) => <button key={k} onClick={() => setInstallKind(co.id, u, m.id, k)} className={`px-1.5 py-1.5 ${m.kind === k ? "bg-indigo-600 text-white" : "ft-field text-slate-500 hover:bg-slate-50"}`}>{l}</button>)}</div>
              </div>
              {m.kind === "mortar" ? (
                <div><label className={lbl}>Mortar</label>
                  <select value={m.product} onChange={(e) => setInstallItem(co.id, u, m.id, { product: e.target.value })} className={inp}>
                    {!m.product && <option value="">Select…</option>}
                    {(m.product && !mortarNames.includes(m.product) ? [m.product, ...mortarNames] : mortarNames).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              ) : (
                txtField("Name", m.name, (v) => setInstallItem(co.id, u, m.id, { name: v }))
              )}
              {numField("Cov. sq ft/unit", m.coverage, (v) => setInstallItem(co.id, u, m.id, { coverage: v }))}
              {m.kind !== "mortar" && txtField("Unit", m.unit, (v) => setInstallItem(co.id, u, m.id, { unit: v }))}
              {m.kind !== "mortar" && numField("$/unit", m.price, (v) => setInstallItem(co.id, u, m.id, { price: v }))}
              {m.kind !== "mortar" && txtField("SKU", m.sku || "", (v) => setInstallItem(co.id, u, m.id, { sku: v }))}
              <button onClick={() => delInstallItem(co.id, u, m.id)} title="Remove install material" className="text-slate-300 hover:text-red-500 pb-2"><X size={14} /></button>
            </div>
          ))}
          <div className="flex gap-3">
            <button onClick={() => addInstallItem(co.id, u, "mortar")} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"><Plus size={12} /> Mortar</button>
            <button onClick={() => addInstallItem(co.id, u, "custom")} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"><Plus size={12} /> Other (screws, tape…)</button>
          </div>
          {stock.length > 0 && <StockSearch stock={stock} inp={inp} placeholder="Add from the price book — screws, tape, sealer… (keeps the SKU for the order summary)" onPick={(it) => setProduct(co.id, "underlayments", u.id, { install: [...(u.install || []), { id: uid(), kind: "custom", name: it.description || it.product, coverage: it.coverage != null ? String(it.coverage) : "", unit: it.unit || "units", price: it.price != null ? String(it.price) : "", sku: it.sku }] })} />}
        </div>
      </div>
    </div>
  );
  const renderAttachedDetail = (co, p) => (
    <div key={p.id}>
      {detailHeader(co, "attached", p, customCat?.name || "Add-on")}
      {delConfirm(co, "attached", p)}
      {linkStrip(co, "attached", p)}
      <div className="flex flex-wrap items-end gap-2.5 mt-4">
        {customCat?.math === "coverage" && <div className="w-36">{numField("Cov. sq ft/unit", p.coverage, (v) => setProduct(co.id, "attached", p.id, { coverage: v }))}</div>}
        <div className="w-24">{txtField("Unit", p.unit, (v) => setProduct(co.id, "attached", p.id, { unit: v }))}</div>
        <div className="w-28">{numField("$/unit", p.price, (v) => setProduct(co.id, "attached", p.id, { price: v }))}</div>
        <div className="w-36">{txtField("SKU", p.sku || "", (v) => setProduct(co.id, "attached", p.id, { sku: v }))}</div>
      </div>
      <p className="text-[11px] text-slate-400 mt-1.5">{customCat?.math === "coverage" ? "One unit covers this many sq ft — quantities scale off the row's area plus waste." : "Ordered by a typed per-row quantity — no coverage math."} A SKU lets price-book imports refresh the price.</p>
    </div>
  );
  const renderAddForm = () => addCo && (
    <div className="max-w-xl">
      <div className="ft-eyebrow text-[9px] mb-1">{addCo.name}</div>
      <h2 className="ft-serif text-3xl leading-tight">New {kindLabel(adding.kind)}</h2>
      <div className="mt-4 space-y-2">
        {pickerItems.length > 0 && <StockSearch stock={pickerItems} onPick={fillFromStock} inp={inp} />}
        <input autoFocus placeholder="Product name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") submitAdd(); if (e.key === "Escape") cancelAdd(); }} className={inp} />
        {draft.link && (
          <div className="flex items-center gap-2 text-xs text-slate-500 rounded-md border border-indigo-100 bg-indigo-50/40 px-2.5 py-1.5">
            <Link2 size={12} className="shrink-0" /><span className="flex-1">Linked to <b>{bookName(draft.link.bookId)}</b> · <span className="ft-mono">{draft.link.sku}</span> — re-imports refresh the price</span>
            <button onClick={() => setDraft({ ...draft, link: null, _desc: undefined })} title="Don't link" className="text-slate-300 hover:text-red-500 shrink-0"><X size={13} /></button>
          </div>
        )}
        {adding.kind === "grouts" && draft._desc && draft.link && (
          <button onClick={() => setFamSeed({ bookId: draft.link.bookId, description: draft._desc, forDraft: true })} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Set up color family…</button>
        )}
        {adding.kind === "attached" ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {customCat?.math === "coverage" && numField("Cov. sq ft/unit", draft.coverage, (v) => setDraft({ ...draft, coverage: v }))}
            {txtField("Unit", draft.unit, (v) => setDraft({ ...draft, unit: v }))}
            {numField("$/unit", draft.price, (v) => setDraft({ ...draft, price: v }))}
            {txtField("SKU", draft.sku, (v) => setDraft({ ...draft, sku: v }))}
          </div>
        ) : adding.kind === "grouts" ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {numField("Cov. sq ft/unit", draft.coverage, (v) => setDraft({ ...draft, coverage: v }))}
              {txtField("Unit", draft.unit, (v) => setDraft({ ...draft, unit: v }))}
              {numField("$/unit", draft.price, (v) => setDraft({ ...draft, price: v }))}
              {txtField("SKU", draft.sku, (v) => setDraft({ ...draft, sku: v }))}
            </div>
            {draft.book && (
              <div className="flex items-center gap-2 text-xs text-slate-500 rounded-md border border-indigo-100 bg-indigo-50/40 px-2.5 py-1.5">
                <Link2 size={12} className="shrink-0" /><span className="flex-1">Colors &amp; per-color SKUs from <b>{draft.book}</b></span>
                <button onClick={() => setDraft({ ...draft, book: "" })} title="Don't link colors" className="text-slate-300 hover:text-red-500 shrink-0"><X size={13} /></button>
              </div>
            )}
            {draft.base && (
              <div className="flex items-center gap-2 text-xs text-slate-500 rounded-md border border-indigo-100 bg-indigo-50/40 px-2.5 py-1.5">
                <span className="flex-1">Also orders <b>{draft.base.name}</b>{draft.base.sku ? <span className="ft-mono text-slate-400"> · {draft.base.sku}</span> : ""} — 1 per kit (editable after adding)</span>
                <button onClick={() => setDraft({ ...draft, base: null })} title="Don't attach a base unit" className="text-slate-300 hover:text-red-500 shrink-0"><X size={13} /></button>
              </div>
            )}
          </>
        ) : adding.kind === "mortars" ? (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            {numField('Tile < 8"', draft.tier1, (v) => setDraft({ ...draft, tier1: v }))}
            {numField('8"–15"', draft.tier2, (v) => setDraft({ ...draft, tier2: v }))}
            {numField('> 15"', draft.tier3, (v) => setDraft({ ...draft, tier3: v }))}
            {txtField("Unit", draft.unit, (v) => setDraft({ ...draft, unit: v }))}
            {numField("$/unit", draft.price, (v) => setDraft({ ...draft, price: v }))}
            {txtField("SKU", draft.sku, (v) => setDraft({ ...draft, sku: v }))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {numField("Cov. sq ft/unit", draft.coverage, (v) => setDraft({ ...draft, coverage: v }))}
              {txtField("Unit", draft.unit, (v) => setDraft({ ...draft, unit: v }))}
              {numField("$/unit", draft.price, (v) => setDraft({ ...draft, price: v }))}
              {txtField("SKU", draft.sku, (v) => setDraft({ ...draft, sku: v }))}
            </div>
            {typeChips(draft.types, (v) => setDraft({ ...draft, types: v }))}
          </>
        )}
        {error && <div className="text-xs text-red-500">{error}</div>}
        <div className="flex gap-2 pt-1">
          <button onClick={submitAdd} className="text-sm rounded-md bg-indigo-600 text-white px-3 py-1.5 hover:bg-indigo-700">Add</button>
          <button onClick={cancelAdd} className="text-sm rounded-md border border-slate-200 px-3 py-1.5 hover:bg-slate-50">Cancel</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="print:hidden fixed inset-0 z-50 p-2 md:p-5" style={{ background: "rgba(20,15,10,.4)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl border border-slate-200 w-full h-full flex overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <aside className="w-56 shrink-0 border-r border-slate-200 bg-slate-50/50 flex flex-col">
          <div className="px-4 pt-4 pb-3 flex items-center justify-between">
            <h3 className="ft-serif text-2xl">Settings</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>
          <nav className="px-2 space-y-0.5">
            {SECTIONS.map(({ id, label, icon: Icon, hint }) => (
              <button key={id} onClick={() => { setSection(id); setSel(null); setAdding(null); setConfirmDel(null); setMenuFor(null); setShowOthers(false); setRename(null); setCoRename(null); }} className={`w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-left ${section === id ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                <Icon size={15} className={section === id ? "" : "text-slate-400"} />
                <span className="flex-1">{label}</span>
                {hint && <span className={`text-[10px] ${section === id ? "text-white/70" : "text-slate-400"}`}>{hint}</span>}
              </button>
            ))}
          </nav>
          <div className="mt-auto p-4 text-[11px] text-slate-400 border-t border-slate-100 space-y-0.5">
            {settings.ops?.lastImport && <div>Book imported {new Date(settings.ops.lastImport.at).toLocaleDateString()}{settings.ops.lastImport.by ? ` by ${settings.ops.lastImport.by}` : ""}</div>}
            {settings.ops?.lastBackup && <div>Last backup {new Date(settings.ops.lastBackup.at).toLocaleDateString()}</div>}
          </div>
        </aside>

        {section === "materials" ? (
          <>
            <div className="w-44 shrink-0 border-r border-slate-200 overflow-y-auto py-3 px-2 space-y-0.5">
              <div className="ft-eyebrow text-[10px] text-slate-400 px-1.5 mb-1">Materials</div>
              {MATERIAL_CATEGORIES.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => openCat(id)}
                  className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left ${cat === id ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                  <Icon size={14} className={cat === id ? "" : "text-slate-400"} />
                  <span className="flex-1 truncate">{label}</span>
                  <Lock size={10} className={cat === id ? "text-white/60" : "text-slate-300"} />
                </button>
              ))}
              <div className="ft-eyebrow text-[10px] text-slate-400 px-1.5 pt-3 mb-1">Add-ons</div>
              {(catalog.categories || []).length === 0 && <p className="px-1.5 text-[11px] text-slate-400">None yet.</p>}
              {(catalog.categories || []).map((c) => (
                <button key={c.id} onClick={() => openCat(c.id)}
                  className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left ${cat === c.id ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                  <Tag size={14} className={cat === c.id ? "" : "text-slate-400"} />
                  <span className="flex-1 truncate">{c.name}</span>
                  {!c.enabled && <span className={`text-[10px] ${cat === c.id ? "text-white/70" : "text-slate-400"}`}>off</span>}
                </button>
              ))}
              <button onClick={openNewCategory} className="w-full flex items-center gap-1.5 text-xs rounded-md border border-dashed border-slate-300 px-2 py-1.5 text-slate-500 hover:bg-slate-50 mt-1"><Plus size={12} /> New category</button>
            </div>
            <div className="w-72 shrink-0 border-r border-slate-200 overflow-y-auto py-2">
              <p className="px-3 pb-1.5 text-[11px] text-slate-400">Uncheck a company or product to hide it from the job dropdowns — it stays stored, and jobs that already use it are unaffected.</p>
              {catalog.companies.filter(inSection).map((co) => (
                <div key={co.id} className="mb-1">
                  {companyHeader(co)}
                  {kindsFor.flatMap((kind) => prodsOf(co, kind).map((p) => { const active = sel && sel.companyId === co.id && sel.kind === kind && sel.productId === p.id; return (
                    <button key={p.id} onClick={() => pickProduct(co.id, kind, p.id)} className={`w-full text-left pl-9 pr-2.5 py-1.5 flex items-center gap-2 border-l-2 ${active ? "border-indigo-600 bg-indigo-50/40" : "border-transparent hover:bg-slate-50"}`}>
                      <span className="min-w-0 flex-1">
                        <span className={`flex items-center gap-1 text-sm ${p.enabled ? "font-medium" : "text-slate-400"}`}><span className="truncate">{p.name}</span>{(kind === "attached" ? isCategoryDefault(p) : isDefaultMaterial(kind, p.name)) && <Star size={10} className="fill-current text-indigo-500 shrink-0" title="Chip default" />}</span>
                        <span className="block text-[10px] text-slate-400 truncate">{masterHint(kind, p)}</span>
                      </span>
                      <ChevronRight size={13} className="text-slate-300 shrink-0" />
                    </button>
                  ); }))}
                </div>
              ))}
              {(() => { const others = catalog.companies.filter((co) => !inSection(co)); return others.length > 0 && (
                <div className="mt-1 border-t border-slate-100 pt-1">
                  <button onClick={() => setShowOthers(!showOthers)} className="w-full px-3 py-1 flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600">
                    <ChevronRight size={11} className={`transition-transform ${showOthers ? "rotate-90" : ""}`} />
                    <span className="flex-1 text-left">Companies with no {kindsFor[0] === "attached" ? `${kindLabel("attached")} products` : `${kindLabel(kindsFor[0])}s`}</span>
                    <span>{others.length}</span>
                  </button>
                  {showOthers && others.map((co) => <div key={co.id}>{companyHeader(co)}</div>)}
                </div>
              ); })()}
              <div className="px-3 pt-2 mt-1 border-t border-slate-100 flex gap-2 items-center">
                <input placeholder="New company" value={newCompany} onChange={(e) => setNewCompany(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitCompany(); }} className={inp + " flex-1"} />
                <button onClick={submitCompany} className="text-xs rounded-md border border-slate-200 px-2 py-2 hover:bg-slate-50 flex items-center gap-1 shrink-0"><Plus size={12} /> Add</button>
              </div>
              {bookStockReady && hasUnlinkedSku && (
                <div className="px-3 pt-2">
                  <button onClick={() => setShowLinkMigration(true)} className="w-full text-xs rounded-md border border-dashed border-indigo-200 px-2 py-1.5 text-indigo-600 hover:bg-indigo-50 flex items-center justify-center gap-1"><Link2 size={12} /> Link products to stock books…</button>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-5 md:p-6">
              {adding ? renderAddForm()
                : selProd && sel.kind === "grouts" ? renderGroutDetail(selCo, selProd)
                  : selProd && sel.kind === "mortars" ? renderMortarDetail(selCo, selProd)
                    : selProd && sel.kind === "attached" ? renderAttachedDetail(selCo, selProd)
                      : selProd ? renderUnderlayDetail(selCo, selProd)
                        : customCat ? renderCustomCategoryPane() : renderCategoryPane()}
            </div>
          </>
        ) : section === "profile" ? (
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="ft-serif text-3xl">Your details</h2>
            <p className="text-sm text-slate-500 mt-1 max-w-xl">Your contact info prints at the top of the estimate ("Your salesperson") so the customer knows who to reach. It's saved with your login — each person on the team sets their own.</p>
            <div className="mt-5 space-y-3 max-w-md">
              <div><label className={lbl}>Name</label><input value={profile.name} onChange={(e) => saveProfile({ name: e.target.value })} placeholder="Your name" className={inp} /></div>
              <div><label className={lbl}>Phone</label><input value={profile.phone} onChange={(e) => saveProfile({ phone: e.target.value })} placeholder="Phone number" className={inp} /></div>
              <div><label className={lbl}>Email</label><input value={profile.email} onChange={(e) => saveProfile({ email: e.target.value })} placeholder={user.email || "Email"} className={inp} /></div>
            </div>
            <p className="text-xs text-slate-400 mt-4">Signed in as {user.email}. Leave a field blank to keep it off the estimate.</p>
          </div>
        ) : section === "general" ? (
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="ft-serif text-3xl">General</h2>
            <p className="text-sm text-slate-500 mt-1 max-w-xl">Calibrate coverage to your real-world results and set unit prices. Grout scales automatically for tile size, joint, and thickness from a 12×12×3/8" / 1/8"-joint baseline.</p>
            <div className="mt-5 flex gap-6">
              <div><label className={lbl}>Tile waste (%)</label><input type="number" value={settings.waste.tile} onChange={(e) => setSettings({ waste: { ...settings.waste, tile: e.target.value } })} className={inp + " w-28"} /></div>
              <div><label className={lbl}>Flooring waste (%)</label><input type="number" value={settings.waste.floor} onChange={(e) => setSettings({ waste: { ...settings.waste, floor: e.target.value } })} className={inp + " w-28"} /><div className="text-[11px] text-slate-400 mt-1">Hardwood, vinyl, laminate, carpet</div></div>
              <div className="text-[11px] text-slate-400 self-end pb-1 max-w-[15rem]">The rates a new project starts with. Each job carries its own waste from there — changing these never touches a project that already exists.</div>
            </div>
            <div className="mt-8 pt-6 border-t border-slate-100">
              <label className={lbl}>Appearance</label>
              <p className="text-[11px] text-slate-400 mt-1 mb-2.5 max-w-md">Applies on this device only. The printed estimate stays on white paper.</p>
              <div className="inline-flex rounded-md border border-slate-200 overflow-hidden text-sm">
                {[{ v: "system", label: "System", icon: Laptop }, { v: "light", label: "Light", icon: Sun }, { v: "dark", label: "Dark", icon: Moon }].map(({ v, label, icon: Icon }) => (
                  <button key={v} onClick={() => setTheme(v)} className={`flex items-center gap-1.5 px-3.5 py-2 font-medium ${theme === v ? "bg-indigo-600 text-white" : "ft-field text-slate-500 hover:bg-slate-50"}`}><Icon size={14} /> {label}</button>
                ))}
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-slate-100">
              <label className={lbl}>Project header</label>
              <p className="text-[11px] text-slate-400 mt-1 mb-2.5 max-w-md">Applies on this device only. One-bar is the 2026-07 redesign; Classic is the original two-row header.</p>
              <div className="inline-flex rounded-md border border-slate-200 overflow-hidden text-sm">
                {[{ v: "bar", label: "One-bar" }, { v: "classic", label: "Classic" }].map(({ v, label }) => (
                  <button key={v} onClick={() => setHeaderLayout(v)} className={`px-3.5 py-2 font-medium ${headerLayout === v ? "bg-indigo-600 text-white" : "ft-field text-slate-500 hover:bg-slate-50"}`}>{label}</button>
                ))}
              </div>
            </div>
          </div>
        ) : section === "book" ? (
          <PriceBookLibrary books={books} stock={stock} stockReady={stockReady} addBook={addBook} updateBook={updateBook} delBook={delBook} loadBookItems={loadBookItems} applyBookImport={applyBookImport} loadBookVersions={loadBookVersions} loadBookVersionSnapshot={loadBookVersionSnapshot} pinBookVersion={pinBookVersion} updateBookItem={updateBookItem} setBookItemsDisabled={setBookItemsDisabled} reviewBookItemFlags={reviewBookItemFlags} setStockItemsDisabled={setStockItemsDisabled} rollbackStock={rollbackStock} importing={importing} importPriceBook={importPriceBook} importStockFile={importStockFile} pbRef={pbRef} settings={settings} setSettings={setSettings} gFamilies={gFamilies} inp={inp} lbl={lbl} types={types} typeLabels={typeLabels} />
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="ft-serif text-3xl">Backup &amp; restore</h2>
            <p className="text-xs text-slate-400 mt-2 max-w-xl">Download everything (customers, versions, settings, attachments) as one file. Restoring adds each customer from the file as a new entry — nothing existing is overwritten.</p>
            {settings.ops?.lastBackup && <p className="text-xs text-slate-400 mt-1">Last backup downloaded {new Date(settings.ops.lastBackup.at).toLocaleDateString()}{settings.ops.lastBackup.by ? ` by ${settings.ops.lastBackup.by}` : ""}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={exportBackup} className="flex items-center gap-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50 px-3 py-1.5 text-slate-600"><Download size={14} /> Download backup</button>
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50 px-3 py-1.5 text-slate-600"><Upload size={14} /> Restore backup</button>
              <input ref={fileRef} type="file" accept="application/json" onChange={importBackup} className="hidden" />
            </div>
          </div>
        )}
        {addingCat && (
          <Modal title="New category" onClose={() => setAddingCat(false)}>
            <label className={lbl}>Name</label>
            <input className={inp} value={catDraft.name} autoFocus placeholder="e.g. Trim, Sealer, Thresholds" onChange={(e) => setCatDraft({ ...catDraft, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && submitCategory()} />
            <div className="mt-3">{typeChips(catDraft.floorTypes, (v) => setCatDraft({ ...catDraft, floorTypes: v }), floorTypeList)}</div>
            <label className={lbl + " mt-3"}>Quantity</label>
            <div className="flex gap-2">
              {[["coverage", "Coverage", "Sq ft per unit — scales off the row's area plus waste"], ["manual", "Manual", "Typed per-row quantity — no area math"]].map(([k, t, d]) => (
                <button key={k} onClick={() => setCatDraft({ ...catDraft, math: k })} className={`flex-1 text-left rounded-lg border px-3 py-2 ${catDraft.math === k ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"}`}>
                  <div className="text-sm font-medium">{t}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{d}</div>
                </button>
              ))}
            </div>
            {catError && <div className="text-xs text-red-500 mt-2">{catError}</div>}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setAddingCat(false)} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button>
              <button onClick={submitCategory} className="text-sm rounded-lg bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700">Create category</button>
            </div>
          </Modal>
        )}
        {famSeed?.pick && (
          <Modal title="New color family" onClose={() => setFamSeed(null)}>
            <label className={lbl}>Pick a book row to seed the family</label>
            <StockSearch stock={bookItems} inp={inp} placeholder="Search the stock books for a color row…"
              onPick={(it) => setFamSeed({ bookId: it.bookId, description: it.description, forProduct: famSeed.forProduct })} />
          </Modal>
        )}
        {famSeed?.description && (
          <FamilyConfirm seed={famSeed} bookStock={bookStock} books={books} inp={inp} lbl={lbl}
            existingNames={[...gFamilies.map((f) => f.product.toLowerCase()), ...(catalog.bookFamilies || []).map((f) => f.name.toLowerCase())]}
            onClose={() => setFamSeed(null)}
            onSave={(fam) => {
              const next = { ...catalog, bookFamilies: [...(catalog.bookFamilies || []), fam] };
              // A fresh-from-ERP-pick grout needs its base companion stamped
              // here too — groutBaseList only ever reads product.base, and
              // this is the family's one save moment (base-companion shape
              // mirrors stockBaseCompanion in stock.js).
              const baseRow = fam.baseSkus.default ? (bookStock[fam.bookId] || []).find((it) => it.sku === fam.baseSkus.default) : null;
              const base = baseRow ? { sku: baseRow.sku, name: baseRow.description || baseRow.product, unit: baseRow.unit || "units", price: baseRow.price ?? 0, per: 1 } : null;
              if (famSeed.forProduct) onChange({ ...next, companies: next.companies.map((co) => co.id === famSeed.forProduct.coId ? { ...co, grouts: co.grouts.map((g) => g.id === famSeed.forProduct.gId ? { ...g, book: fam.name, ...(base ? { base } : {}) } : g) } : co) });
              else { onChange(next); setDraft((d) => ({ ...d, book: fam.name, ...(base ? { base } : {}) })); }
              setFamSeed(null);
            }} />
        )}
        {showLinkMigration && (
          <LinkMigration catalog={catalog} bookStock={bookStock} books={books}
            onClose={() => setShowLinkMigration(false)}
            onApply={(selected) => { onChange(applyProposals(catalog, selected)); setShowLinkMigration(false); }} />
        )}
      </div>
    </div>
  );
}
