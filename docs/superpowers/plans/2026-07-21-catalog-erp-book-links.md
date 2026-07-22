# Catalog fed from ERP stock books — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Catalog products (companies under Grout/Mortar/Underlayment/custom categories) link to ERP "Vendor SKU Analysis" stock-book rows — item links refresh price on every re-drop, and rule-based grout families drive colors, matched caulk, and base auto-add — so the old stock workbook can retire.

**Architecture:** A new pure module `src/booklink.js` holds all link/family logic. Grout families keep the ADR 0007 mechanics untouched: family definitions (`catalog.bookFamilies`) resolve against stock-kind book items and **project into stock-shaped items**, so the existing `groutFamilies` / `groutSnapshotPatch` / `stockCompanionBase` call sites in App.jsx and mobile.jsx work unchanged on a merged item list. Item links (`product.link = {bookId, sku}`) sync at import time via a wrapper around `applyBookImport`. Spec: `docs/superpowers/specs/2026-07-21-catalog-erp-book-links-design.md`.

**Tech Stack:** React 18 + Vite, plain JS domain modules, `node --test` for units, Supabase (read-only here — NO schema changes, NO new SQL).

## Global Constraints

- **Never push to `main`; every change lands through a PR** (CLAUDE.md non-negotiable 2). All work on branch `catalog-erp-links`.
- **Never mutate the live Supabase project** — this feature adds NO tables/columns; links live in `settings.catalog` jsonb, families in `catalog.bookFamilies`. Book items are only read (`loadBookItems`) and written through the existing `applyBookImport`.
- **Sync never renames a catalog product** — jobs resolve by name (ADR 0002/0016); sync refreshes `price`/`unit`/`sku` only.
- **Jobs never re-read prices at calc time** — all sync happens at import apply; job rows keep snapshots (ADR 0003).
- Tests: `npm test` (runs `node --test src/*.test.js`). Lint: `npm run lint`.
- Comments: conservative — only non-obvious business rules (CLAUDE.md).
- UI copy: sentence case, concise, match existing Settings tone. Tailwind slate/indigo utility classes only (theme overrides them).

---

### Task 0: Branch setup

The design spec was committed locally on `main` (commit `88305eb`, unpushed). Move to a feature branch and restore `main` to origin so nothing ever pushes to `main` directly.

- [ ] **Step 1: Create the branch (carries the spec commit) and reset local main**

```bash
cd "C:\Users\User\Documents\Claude ReadWrite\Flooring-Tracker"
git checkout -b catalog-erp-links
git branch -f main origin/main
```

- [ ] **Step 2: Verify**

Run: `git log --oneline -2` → shows `88305eb Spec: catalog fed from ERP stock books…` on `catalog-erp-links`; `git log --oneline -1 main` → shows `f9b3b90`.

---

### Task 1: booklink.js — series rules & color tokens

**Files:**
- Create: `src/booklink.js`
- Create: `src/booklink.test.js`

**Interfaces:**
- Produces: `matchRule(rule, description) -> string|null` (the color token, preserving source casing), `parseColorToken(token) -> { num, name }`, `deriveSeriesRule(description, descriptions) -> { prefix, suffix }`, `normLink(l) -> {bookId,sku}|null`, `titleWords(s) -> string`.
- A **rule** is `{ prefix, suffix }`: a row belongs to a series when its whitespace-normalized description starts with `prefix` and ends with `suffix` (case-insensitive); the varying middle is the color token. Rules are what family definitions store — never row lists.

- [ ] **Step 1: Write the failing tests** — real description samples from the seven exports:

```js
// src/booklink.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchRule, parseColorToken, deriveSeriesRule, normLink } from "./booklink.js";

const SPECTRA = [
  "0.8 GAL SPECTRALOCK PRO EPOXY GROUT FULL UNIT PART A&B",
  "3.2 GAL SPECTRALOCK PRO EPOXY GROUT COMMERCIAL UNIT PART A&B",
  "9LB SPECTRALOCK PRO 85 ALMOND PART C",
  "9LB SPECTRALOCK PRO 24 NATURAL GREY PART C",
  "9LB SPECTRALOCK PRO 53 TWILIGHT BLUE PART C",
];
const LATASIL = [
  "10.3 OZ LATASIL 85 ALMOND - 100% SILICONE CAULK",
  "10.3 OZ LATASIL  44 BRIGHT WHITE - 100% SILICONE CAULK",   // double space in the export
  "10.3 OZ LATASIL CLEAR - 100% SILICONE CAULK",              // no color number
  "10.3 OZ LATASIL 53 TWILIGHT BLUE 10.3 OZ- 100% SILICONE CAULK", // messy real row
];

test("matchRule slices the color token between prefix and suffix", () => {
  const r = { prefix: "9LB SPECTRALOCK PRO", suffix: "PART C" };
  assert.equal(matchRule(r, "9LB SPECTRALOCK PRO 24 NATURAL GREY PART C"), "24 NATURAL GREY");
  assert.equal(matchRule(r, "0.8 GAL SPECTRALOCK PRO EPOXY GROUT FULL UNIT PART A&B"), null); // base row: wrong frame
  assert.equal(matchRule(r, "10# Tec Power Grout - 910 Bright White"), null);
  // whitespace-insensitive and case-insensitive on the frame
  assert.equal(matchRule({ prefix: "10.3 OZ LATASIL", suffix: "- 100% SILICONE CAULK" }, LATASIL[1]), "44 BRIGHT WHITE");
  // a row that is ONLY the frame yields no color
  assert.equal(matchRule({ prefix: "9LB SPECTRALOCK PRO", suffix: "" }, "9LB SPECTRALOCK PRO"), null);
  // an empty rule matches nothing
  assert.equal(matchRule({ prefix: "", suffix: "" }, "anything"), null);
});

test("matchRule handles a suffix-only frame and leading separators", () => {
  const r = { prefix: "10# Tec Power Grout -", suffix: "" };
  assert.equal(matchRule(r, "10# Tec Power Grout - 910 Bright White"), "910 Bright White");
  assert.equal(matchRule(r, "10# Tec Power Grout - 934 Slate Gray/Del Gray"), "934 Slate Gray/Del Gray");
});

test("parseColorToken extracts the color number and name", () => {
  assert.deepEqual(parseColorToken("24 NATURAL GREY"), { num: "24", name: "Natural Grey" });
  assert.deepEqual(parseColorToken("910 Bright White"), { num: "910", name: "Bright White" });
  assert.deepEqual(parseColorToken("CLEAR"), { num: "", name: "Clear" });
  // the messy Latasil row still keys on its number
  assert.equal(parseColorToken("53 TWILIGHT BLUE 10.3 OZ").num, "53");
  // "93FOSSIL" (PermaColor's typo row) — glued number still splits
  assert.deepEqual(parseColorToken("93FOSSIL"), { num: "93", name: "Fossil" });
  assert.deepEqual(parseColorToken("545 Bleached Wood"), { num: "545", name: "Bleached Wood" });
});

test("deriveSeriesRule proposes the shared frame from a picked row", () => {
  const r = deriveSeriesRule("9LB SPECTRALOCK PRO 24 NATURAL GREY PART C", SPECTRA);
  assert.equal(r.prefix, "9LB SPECTRALOCK PRO");
  assert.equal(r.suffix, "PART C");
  const c = deriveSeriesRule(LATASIL[0], LATASIL);
  assert.equal(c.prefix, "10.3 OZ LATASIL");
  assert.equal(c.suffix, "- 100% SILICONE CAULK");
  // under 3 siblings: fall back to the whole description as prefix (user edits in the confirm UI)
  const d = deriveSeriesRule("Gal Custom Premixed Grout - Delorean Gray Sanded",
    ["Gal Custom Premixed Grout - Delorean Gray Sanded", "Gal Custom Premixed Grout - Natural Gray Sanded"]);
  assert.equal(d.prefix, "Gal Custom Premixed Grout - Delorean Gray Sanded");
});

test("normLink keeps only a complete bookId+sku pair", () => {
  assert.deepEqual(normLink({ bookId: "b1", sku: "07879" }), { bookId: "b1", sku: "07879" });
  assert.equal(normLink({ bookId: "", sku: "07879" }), null);
  assert.equal(normLink(null), null);
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL (cannot find module `./booklink.js`).

- [ ] **Step 3: Implement**

```js
// src/booklink.js
// Catalog ↔ ERP stock-book links (spec 2026-07-21). Pure and React-free, like
// catalog.js/stock.js, so node --test covers it. A grout FAMILY is stored as a
// matching RULE over one book's descriptions — never a row list — so a re-drop
// recomputes membership and new colors appear on their own.

const str = (v) => (v == null ? "" : String(v).trim());
const squish = (s) => str(s).replace(/\s+/g, " ");
const low = (s) => squish(s).toLowerCase();

export const normLink = (l) => {
  const bookId = str(l?.bookId), sku = str(l?.sku);
  return bookId && sku ? { bookId, sku } : null;
};

export const titleWords = (s) =>
  low(s).replace(/\b[a-z]/g, (c) => c.toUpperCase());

// The color token between a rule's prefix and suffix, sliced from the ORIGINAL
// text so display casing survives; null when the row isn't in the series (or
// is frame-only, e.g. a base row that shares the prefix but not the suffix).
export function matchRule(rule, description) {
  const d = squish(description), p = squish(rule?.prefix), s = squish(rule?.suffix);
  if (!p && !s) return null;
  const dl = d.toLowerCase(), pl = p.toLowerCase(), sl = s.toLowerCase();
  if (pl && !dl.startsWith(pl)) return null;
  if (sl && (!dl.endsWith(sl) || dl.length < pl.length + sl.length)) return null;
  const mid = d.slice(p.length, sl ? d.length - s.length : undefined).replace(/^[\s\-–·:]+|[\s\-–·:]+$/g, "");
  return mid || null;
}

// "24 NATURAL GREY" → { num: "24", name: "Natural Grey" }. The number keys the
// caulk match (Laticrete 24↔24, TEC 910↔910); name is the fallback. Handles
// the exports' glued typos ("93FOSSIL", "52TOASTED ALMOND").
export function parseColorToken(token) {
  const t = squish(token);
  const m = t.match(/(?:^|[\s#])(\d{2,3})(?=[\s]|$|[A-Za-z])/);
  const num = m ? m[1] : "";
  const name = m ? squish(t.slice(0, m.index) + " " + t.slice(m.index + m[0].length)) : t;
  return { num, name: name ? titleWords(name) : "" };
}

// Propose a series rule from one picked row: the longest token-prefix shared by
// ≥3 sibling descriptions, then the longest token-suffix common to those
// siblings. Under 3 siblings the whole description becomes the prefix — the
// confirm UI is where messy families (DOIT's premixed grout) get hand-fixed.
export function deriveSeriesRule(description, descriptions) {
  const toks = squish(description).split(" ");
  for (let n = toks.length - 1; n >= 1; n--) {
    const prefix = toks.slice(0, n).join(" ");
    const hits = (descriptions || []).filter((d) => low(d).startsWith(low(prefix)));
    if (hits.length < 3) continue;
    const tails = hits.map((d) => squish(d).split(" "));
    const suffix = [];
    for (let i = 1; ; i++) {
      const t = tails[0][tails[0].length - i];
      if (t == null || suffix.length >= toks.length - n) break;
      if (!tails.every((w) => (w[w.length - i] || "").toLowerCase() === t.toLowerCase())) break;
      suffix.unshift(t);
    }
    return { prefix, suffix: suffix.join(" ") };
  }
  return { prefix: squish(description), suffix: "" };
}
```

- [ ] **Step 4: Run to verify pass** — `npm test` → all booklink tests PASS (fix until they do; the other suites must stay green).

- [ ] **Step 5: Commit**

```bash
git add src/booklink.js src/booklink.test.js
git commit -m "feat: series rules + color tokens for ERP grout families (booklink)"
```

---

### Task 2: booklink.js — family definitions, resolution & stock-shaped projection

**Files:**
- Modify: `src/booklink.js` (append)
- Modify: `src/booklink.test.js` (append)

**Interfaces:**
- Consumes: Task 1's `matchRule`/`parseColorToken`.
- Produces:
  - `normBookFamily(f) -> { id, name, bookId, rule:{prefix,suffix}, baseSkus:{default,variant}, caulk:{bookId,prefix,suffix}|null, cache:[{color,num,sku,price,unit}] }`
  - `resolveFamily(fam, itemsByBook) -> { colors:[{color,num,sku,price,unit}], caulkByColor: Map<colorLowercase, {sku,price}>, bases:[item], usedCache: boolean }`
  - `projectFamilies(bookFamilies, itemsByBook) -> stockShapedItem[]` — items shaped for stock.js: grout colors as `{ sku, active:true, disabled:false, discontinued:false, sheet:"Grout & Caulk", section:"bookfam:"+fam.id, product:fam.name, color, price, unit, description }`; matched caulk rows the same but `product: fam.name + " Caulk"` and the GROUT's color name (so `groutCaulkItem`'s same-section same-color lookup hits); base rows as `{ sku, section:"Bulk & Base Units", product:fam.name, description, price, unit, active:true, disabled:false, discontinued:false }` (so `stockCompanionBase`/`stockBaseVariant` regexes work off `description`).
  - `familyWarnings(bookFamilies, itemsByBook) -> [{ familyId, name, kind:"zero-match"|"base-missing" }]`
  - `itemsByBook` is `{ [bookId]: normBookItem[] }` (from `useBookStock`, Task 5).

- [ ] **Step 1: Write the failing tests** — build a fake Sheet1 book from real rows; cover: colors resolved by rule (bases excluded because the suffix differs); caulk matched by number and by name fallback; the messy Latasil `53` row still matching Twilight Blue; TEC-style no-suffix rule; **zero-match → cache colors returned with `usedCache: true`**; projection emits the three item shapes above and `groutFamilies`/`groutColorItem`/`groutCaulkItem`/`groutSnapshotPatch`/`stockCompanionBase`/`stockBaseVariant` from `stock.js` behave on the projection (import them in the test — that is the whole point of the projection contract; e.g. `groutSnapshotPatch(projected, "SpectraLock Pro", "Natural Grey")` returns the Part C SKU + Latasil caulk SKU/price, and `stockCompanionBase(partCItem, projected)` returns the FULL unit with `stockBaseVariant` finding the COMMERCIAL sibling). Use item stubs shaped like `normOrderItem` output: `{ sku, active:true, disabled:false, description, price, unit:"EA" }`.

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL (`normBookFamily` not exported).

- [ ] **Step 3: Implement** — append to `src/booklink.js`:

```js
const numOr = (v, d = null) => (typeof v === "number" && Number.isFinite(v) ? v : d);

export function normBookFamily(f) {
  return {
    id: str(f?.id) || Math.random().toString(36).slice(2, 9) + Date.now().toString(36),
    name: str(f?.name),
    bookId: str(f?.bookId),
    rule: { prefix: str(f?.rule?.prefix), suffix: str(f?.rule?.suffix) },
    baseSkus: { default: str(f?.baseSkus?.default), variant: str(f?.baseSkus?.variant) },
    caulk: f?.caulk && (str(f.caulk.prefix) || str(f.caulk.suffix))
      ? { bookId: str(f.caulk.bookId) || str(f?.bookId), prefix: str(f.caulk.prefix), suffix: str(f.caulk.suffix) }
      : null,
    cache: (Array.isArray(f?.cache) ? f.cache : []).map((c) => ({
      color: str(c?.color), num: str(c?.num), sku: str(c?.sku), price: numOr(c?.price), unit: str(c?.unit),
    })),
  };
}

const liveRows = (items) => (items || []).filter((it) => it.active !== false && !it.disabled && !it.discontinued);

export function resolveFamily(fam, itemsByBook) {
  const baseSet = new Set([fam.baseSkus.default, fam.baseSkus.variant].filter(Boolean));
  const colors = [];
  for (const it of liveRows(itemsByBook?.[fam.bookId])) {
    if (baseSet.has(it.sku)) continue;
    const token = matchRule(fam.rule, it.description);
    if (!token) continue;
    const { num, name } = parseColorToken(token);
    if (!name && !num) continue;
    colors.push({ color: name || num, num, sku: it.sku, price: numOr(it.price), unit: str(it.unit) });
  }
  const caulkByColor = new Map();
  if (fam.caulk) {
    const byNum = new Map(), byName = new Map();
    for (const it of liveRows(itemsByBook?.[fam.caulk.bookId])) {
      const token = matchRule(fam.caulk, it.description);
      if (!token) continue;
      const { num, name } = parseColorToken(token);
      const entry = { sku: it.sku, price: numOr(it.price) };
      if (num && !byNum.has(num)) byNum.set(num, entry);
      if (name && !byName.has(name.toLowerCase())) byName.set(name.toLowerCase(), entry);
    }
    for (const c of colors) {
      const hit = (c.num && byNum.get(c.num)) || byName.get(c.color.toLowerCase());
      if (hit) caulkByColor.set(c.color.toLowerCase(), hit);
    }
  }
  const bases = liveRows(itemsByBook?.[fam.bookId]).filter((it) => baseSet.has(it.sku));
  // Zero matches after a re-drop (supplier rewrote every description) must not
  // blank a job's color dropdown — serve the cached colors, flagged, until the
  // rule is re-confirmed (spec §6).
  if (!colors.length && fam.cache.length) return { colors: fam.cache, caulkByColor, bases, usedCache: true };
  return { colors, caulkByColor, bases, usedCache: false };
}

// Families → stock-shaped items, so ADR 0006/0007 stock.js helpers (and every
// App/mobile call site built on them) work on [...stock, ...projected] without
// change. Caulk rows are emitted under the GROUT's color name — that is what
// groutCaulkItem matches on (same section, same color).
export function projectFamilies(bookFamilies, itemsByBook) {
  const out = [];
  for (const raw of bookFamilies || []) {
    const fam = normBookFamily(raw);
    if (!fam.name || !fam.bookId) continue;
    const { colors, caulkByColor, bases } = resolveFamily(fam, itemsByBook);
    const flags = { active: true, disabled: false, discontinued: false };
    for (const c of colors) {
      out.push({ ...flags, sku: c.sku, sheet: "Grout & Caulk", section: `bookfam:${fam.id}`, product: fam.name, color: c.color, price: c.price, unit: c.unit, description: "" });
      const ck = caulkByColor.get(c.color.toLowerCase());
      if (ck) out.push({ ...flags, sku: ck.sku, sheet: "Grout & Caulk", section: `bookfam:${fam.id}`, product: `${fam.name} Caulk`, color: c.color, price: ck.price, unit: "", description: "" });
    }
    for (const b of bases) out.push({ ...flags, sku: b.sku, sheet: "Grout & Caulk", section: "Bulk & Base Units", product: fam.name, color: "", price: numOr(b.price), unit: str(b.unit), description: str(b.description) });
  }
  return out;
}

export function familyWarnings(bookFamilies, itemsByBook) {
  const out = [];
  for (const raw of bookFamilies || []) {
    const fam = normBookFamily(raw);
    if (!fam.name || !fam.bookId) continue;
    const r = resolveFamily(fam, itemsByBook);
    if (r.usedCache || (!r.colors.length && !fam.cache.length)) out.push({ familyId: fam.id, name: fam.name, kind: "zero-match" });
    else if ((fam.baseSkus.default || fam.baseSkus.variant) && !r.bases.length) out.push({ familyId: fam.id, name: fam.name, kind: "base-missing" });
  }
  return out;
}
```

- [ ] **Step 4: Run to verify pass** — `npm test`.

- [ ] **Step 5: Commit** — `git add src/booklink.js src/booklink.test.js && git commit -m "feat: grout family resolution + stock-shaped projection from ERP books"`

---

### Task 3: booklink.js — import-time sync + migration proposals

**Files:**
- Modify: `src/booklink.js` (append), `src/booklink.test.js` (append)

**Interfaces:**
- Produces:
  - `syncLinkedCatalog(catalog, bookId, items) -> { catalog, changes:[{name, from, to, sku}], lost:[{name, sku}], newColors:[{family, count}] }` — refreshes `price`/`unit`/`sku` of item-linked products in all four kind arrays (`grouts`/`mortars`/`underlayments`/`attached`), refreshes each matching family's `cache` (and counts colors not previously in the cache as `newColors`), refreshes a grout's `base.price` when `base.sku` is a live row of this book. NEVER touches `name`, company, or category. Products linked to a now-inactive/absent SKU land in `lost` and are left untouched (keep-and-warn).
  - `linkedItemState(link, itemsByBook) -> "ok"|"inactive"|"missing"|null` — null when no link; drives the Settings warning chip.
  - `proposeLinks(catalog, itemsByBook, books) -> { proposals:[{companyId, companyName, kind, productId, name, sku, bookId, bookName}], unmatched:[{name, sku, reason:"none"|"ambiguous"}] }` — for every product with a `sku`, no `link`: exactly one active stock-kind row across all books wins; 0 → "none", >1 → "ambiguous". `books` is the `price_books` metadata list (for names + `kind === "stock"` filter).
  - `applyProposals(catalog, proposals) -> catalog` — stamps `link` on each proposal's product.

- [ ] **Step 1: Write the failing tests.** Build a small catalog literal (companies with all four kinds; one product per outcome) — cover: price+unit refresh with change entry; linked SKU absent → `lost` + product untouched; unlinked product untouched; `attached` products sync too; base price refresh via `base.sku`; family cache refresh + `newColors` count; `linkedItemState` all four outcomes; `proposeLinks` unique/none/ambiguous; `applyProposals` round-trip. Assert money compare uses the 0.005 epsilon (follow `syncCatalogPrices`).

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** — append:

```js
export function linkedItemState(link, itemsByBook) {
  const l = normLink(link);
  if (!l) return null;
  const it = (itemsByBook?.[l.bookId] || []).find((x) => x.sku === l.sku);
  return !it ? "missing" : it.active === false ? "inactive" : "ok";
}

export function syncLinkedCatalog(catalog, bookId, items) {
  const live = new Map(liveRows(items).map((it) => [it.sku, it]));
  const all = new Map((items || []).map((it) => [it.sku, it]));
  const changes = [], lost = [];
  const syncKind = (list) => (list || []).map((p) => {
    let next = p;
    const l = normLink(p.link);
    if (l && l.bookId === bookId) {
      const it = live.get(l.sku);
      if (!it) { lost.push({ name: p.name, sku: l.sku }); return p; }
      const to = numOr(it.price, numOr(parseFloat(p.price), 0));
      const from = parseFloat(p.price) || 0;
      const unit = str(it.unit) || p.unit;
      if (Math.abs(from - to) > 0.005 || unit !== p.unit || str(p.sku) !== it.sku) {
        if (Math.abs(from - to) > 0.005) changes.push({ name: p.name, from, to, sku: it.sku });
        next = { ...next, price: to, unit, sku: it.sku };
      }
    }
    // A grout base companion linked into this book rides the same refresh.
    if (next.base && str(next.base.sku) && all.has(str(next.base.sku))) {
      const b = live.get(str(next.base.sku));
      if (b && Math.abs((parseFloat(next.base.price) || 0) - numOr(b.price, 0)) > 0.005) {
        changes.push({ name: `${next.name} — base`, from: parseFloat(next.base.price) || 0, to: numOr(b.price, 0), sku: b.sku });
        next = { ...next, base: { ...next.base, price: numOr(b.price, 0) } };
      }
    }
    return next;
  });
  const companies = (catalog?.companies || []).map((co) => ({
    ...co,
    grouts: syncKind(co.grouts), mortars: syncKind(co.mortars),
    underlayments: syncKind(co.underlayments), attached: syncKind(co.attached),
  }));
  const newColors = [];
  const bookFamilies = (catalog?.bookFamilies || []).map((raw) => {
    const fam = normBookFamily(raw);
    if (fam.bookId !== bookId) return raw;
    const { colors, usedCache } = resolveFamily(fam, { [bookId]: items });
    if (usedCache || !colors.length) return raw;
    const had = new Set(fam.cache.map((c) => c.sku));
    const fresh = colors.filter((c) => !had.has(c.sku)).length;
    if (fresh && fam.cache.length) newColors.push({ family: fam.name, count: fresh });
    return { ...fam, cache: colors };
  });
  return { catalog: { ...catalog, companies, bookFamilies }, changes, lost, newColors };
}

export function proposeLinks(catalog, itemsByBook, books) {
  const stockBooks = (books || []).filter((b) => b.kind === "stock" && b.active !== false);
  const proposals = [], unmatched = [];
  for (const co of (catalog?.companies || [])) {
    for (const kind of ["grouts", "mortars", "underlayments", "attached"]) {
      for (const p of (co[kind] || [])) {
        const sku = str(p.sku);
        if (!sku || normLink(p.link)) continue;
        const hits = stockBooks.filter((b) => liveRows(itemsByBook?.[b.id]).some((it) => it.sku === sku));
        if (hits.length === 1) proposals.push({ companyId: co.id, companyName: co.name, kind, productId: p.id, name: p.name, sku, bookId: hits[0].id, bookName: hits[0].name });
        else unmatched.push({ name: p.name, sku, reason: hits.length ? "ambiguous" : "none" });
      }
    }
  }
  return { proposals, unmatched };
}

export function applyProposals(catalog, proposals) {
  const byProduct = new Map((proposals || []).map((pr) => [pr.productId, pr]));
  const companies = (catalog?.companies || []).map((co) => {
    const stamp = (list) => (list || []).map((p) => {
      const pr = byProduct.get(p.id);
      return pr ? { ...p, link: { bookId: pr.bookId, sku: pr.sku } } : p;
    });
    return { ...co, grouts: stamp(co.grouts), mortars: stamp(co.mortars), underlayments: stamp(co.underlayments), attached: stamp(co.attached) };
  });
  return { ...catalog, companies };
}
```

- [ ] **Step 4: Run to verify pass** — `npm test`.
- [ ] **Step 5: Commit** — `git add -A src && git commit -m "feat: import-time link sync + migration link proposals"`

---

### Task 4: catalog.js — carry `link` and `bookFamilies` through normalization

**Files:**
- Modify: `src/catalog.js` — the field-shape helpers around lines 349-364 and 616, `normalizeCatalog` (line 442), `seedCatalog` (line 396)
- Modify: `src/catalog.test.js` (append)

**Interfaces:**
- Consumes: `normLink`, `normBookFamily` from `booklink.js`.
- Produces: every product shape (`groutFields`/`mortarFields`/`underlayFields`/`attachedFields`) carries `link` (default null); `normalizeCatalog(catalog).bookFamilies` is a normalized array (default `[]`); `seedCatalog(...).bookFamilies = []`. `resolveCatalog` needs no change (it spreads the field helpers, so `link` rides along into `settings.grouts[name].link` etc.).

- [ ] **Step 1: Write the failing tests** (append to `catalog.test.js`): a catalog round-trip through `normalizeCatalog` keeps `link` on one product of each kind, drops an incomplete link (`{bookId:""}` → null), defaults `bookFamilies` to `[]`, and normalizes a family (id generated, cache defaulted). Also assert `resolveCatalog` surfaces `link` on the flattened maps.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement.** In `catalog.js`: `import { normLink, normBookFamily } from "./booklink.js";` then add `link: normLink(g?.link)` to `groutFields`, `mortarFields`, `underlayFields`, `attachedFields` (one property each), and in `normalizeCatalog`'s return add `bookFamilies: (Array.isArray(catalog?.bookFamilies) ? catalog.bookFamilies : []).map(normBookFamily)`; in `seedCatalog`'s return add `bookFamilies: []`. **Check `removeCategory`/`addCompany`-style helpers spread `...catalog`, so `bookFamilies` survives every existing edit path — verify by grep that no helper rebuilds the catalog object from named keys only** (`seedCatalog` is the one that does; it now includes the key).
- [ ] **Step 4: Run to verify pass** — `npm test` (the whole suite — existing catalog tests must not regress).
- [ ] **Step 5: Commit** — `git commit -am "feat: catalog carries stock-book links and family definitions"`

---

### Task 5: useBookStock — stock-kind book items cache + synced import wrapper

**Files:**
- Create: `src/usebookstock.js`
- Modify: `src/App.jsx` — hook wiring near the other hooks (~line 106), background load where books hydrate, `applyBookImport` pass-through at line 1955 and 657-area prop into SettingsWorkspace

**Interfaces:**
- Consumes: `useBooks`'s `books`, `loadBookItems`, `applyBookImport`; `syncLinkedCatalog`; App's `settings`/`setSettings`/`ping`.
- Produces (from `useBookStock({ books, loadBookItems })`):
  - `bookStock` — `{ [bookId]: normBookItem[] }` for active stock-kind books
  - `bookStockReady` — boolean
  - `loadAllBookStock()` — loads every active stock-kind book's items (call after books hydrate)
  - `refreshBookStock(bookId) -> items` — reload one book, return its items
- Produces (in App): `applyBookImportSynced(bookId, diff, opts)` — awaits `applyBookImport`, then for a stock-kind book refreshes that book's cache, runs `syncLinkedCatalog`, persists via `setSettings({ catalog })` when anything changed, and pings the spec's summary line: `"3 linked products updated, 1 link lost, 2 new colors in SpectraLock Pro"` (omit empty clauses; only ping when at least one clause is non-empty). This wrapper — not the raw `applyBookImport` — is what SettingsWorkspace receives.

- [ ] **Step 1: Implement the hook**

```js
// src/usebookstock.js
import { useRef, useState } from "react";

// Stock-kind registry books' items, cached like the ADR 0003 stock cache:
// bounded (the shop's own ERP exports, ~1k rows total), loaded in the
// background after the books metadata arrives (ADR 0026), read by the grout
// family projection, the Settings picker, and link warnings.
export function useBookStock({ books, loadBookItems }) {
  const [bookStock, setBookStock] = useState({});
  const [bookStockReady, setBookStockReady] = useState(false);
  const loading = useRef(false);

  const loadAllBookStock = async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const targets = books.filter((b) => b.kind === "stock" && b.active !== false);
      const out = {};
      for (const b of targets) { try { out[b.id] = await loadBookItems(b.id); } catch { out[b.id] = []; } }
      setBookStock(out);
      setBookStockReady(true);
    } finally { loading.current = false; }
  };

  const refreshBookStock = async (bookId) => {
    const items = await loadBookItems(bookId);
    setBookStock((m) => ({ ...m, [bookId]: items }));
    return items;
  };

  return { bookStock, bookStockReady, loadAllBookStock, refreshBookStock };
}
```

- [ ] **Step 2: Wire into App.jsx.** Import the hook + `syncLinkedCatalog` and `projectFamilies` (projection used next task). Instantiate after `useBooks` (near line 106). Find the boot effect where `hydrateBooks` lands the books metadata (grep `hydrateBooks` in App.jsx; it is called from the bootload stage-2 effect) and chain `loadAllBookStock()` after the books list is set — mirror how the stock cache stages (`stockReady`). Then define next to it:

```jsx
  const applyBookImportSynced = async (bookId, diff, opts) => {
    await applyBookImport(bookId, diff, opts);
    if (books.find((b) => b.id === bookId)?.kind !== "stock") return;
    const items = await refreshBookStock(bookId);
    const { catalog, changes, lost, newColors } = syncLinkedCatalog(settings.catalog, bookId, items);
    if (changes.length || newColors.length) setSettings({ catalog });
    const parts = [
      changes.length ? `${changes.length} linked product${changes.length === 1 ? "" : "s"} updated` : "",
      lost.length ? `${lost.length} link${lost.length === 1 ? "" : "s"} lost` : "",
      ...newColors.map((n) => `${n.count} new color${n.count === 1 ? "" : "s"} in ${n.family}`),
    ].filter(Boolean);
    if (parts.length) ping(parts.join(", "));
  };
```

Replace `applyBookImport={applyBookImport}` with `applyBookImport={applyBookImportSynced}` in the SettingsWorkspace props (App.jsx line 1955 block). Also pass `bookStock={bookStock}` `bookStockReady={bookStockReady}` `refreshBookStock={refreshBookStock}` there — Settings needs them for the picker, warnings, and migration (Tasks 7-9). (The drop-router import path in pricebooklib receives whatever prop Settings forwards — since SettingsWorkspace forwards its `applyBookImport` prop to `PriceBookLibrary` (SettingsWorkspace.jsx:657), the wrapper covers the wizard and the board drop area automatically.)

- [ ] **Step 3: Verify** — `npm test` (no regressions) and `npm run lint`. Then `npm run dev` → app boots, Settings → Price book opens, re-import of any vendor file still works (wrapper is pass-through when nothing is linked).
- [ ] **Step 4: Commit** — `git add -A src && git commit -m "feat: stock-book item cache + synced import wrapper"`

---

### Task 6: Job grid + mobile — grout families resolve from books through the projection

**Files:**
- Modify: `src/App.jsx` lines 386, 477, 1247-1266, 1316-1319, 1393; `src/mobile.jsx` lines 220, 240-252

**Interfaces:**
- Consumes: `projectFamilies`, `bookStock`, `bookStockReady`.
- Produces: `groutStock` — the merged item list `[...stock, ...projectFamilies(settings.catalog.bookFamilies, bookStock)]`; every grout-family/base call site reads `groutStock` instead of `stock`. `MobileRowSheet` gains a `groutStock` prop (its `stock` prop stays for SKU search).

- [ ] **Step 1: App.jsx merge point** — replace line 386:

```jsx
  const groutStock = useMemo(() => [...stock, ...projectFamilies(settings.catalog.bookFamilies, bookStock)], [stock, settings.catalog.bookFamilies, bookStock]);
  const gFamilies = useMemo(() => groutFamilies(groutStock), [groutStock]);
```

- [ ] **Step 2: Snapshot + base call sites.** In App.jsx swap the item-list argument `stock` → `groutStock` at: line 477 (`stockCompanionBase(it, groutStock)` — and change the guard `it.bookId ? null : …` to only skip ORDER-kind rows: `const base = stockCompanionBase(it, groutStock)` unconditionally is correct because a book row's pigment description matches the same regexes and non-pigment rows return null), line 1256/1257/1266 (`groutSnapshotPatch(groutStock, …)`), line 1316 (`findStock(groutStock, p.sku)` — lets a projected base row's variant chip resolve) and 1319 (`stockBaseVariant(stockItem, groutStock)`). Extend the `stockBusy` gate (line 1255) so a **book-backed** family also waits for its cache:

```jsx
  const isBookFam = (book) => !!book && (settings.catalog.bookFamilies || []).some((f) => f.name.toLowerCase() === book.toLowerCase());
  const stockBusy = (book) => {
    if (!book) return false;
    if (isBookFam(book)) { if (!bookStockReady) { ping(STOCK_LOADING_MSG); return true; } return false; }
    if (!stockReady || stockFailed) { ping(stockFailed ? STOCK_FAILED_MSG : STOCK_LOADING_MSG); return true; }
    return false;
  };
```

- [ ] **Step 3: Mobile.** Pass `groutStock={groutStock}` at App.jsx line 1393; in mobile.jsx add the prop at line 220 and use it in place of `stock` in lines 248/249/252's `groutSnapshotPatch` calls, and mirror the `stockBusy` extension (mobile receives `bookFamNames` the same way — pass `isBookFam` down as a prop instead of duplicating: add `isBookFam` to MobileRowSheet's props and use it in its `stockBusy`).
- [ ] **Step 4: Verify in the preview** (CLAUDE.md rule 3): `npm run dev`; in Settings hand-add to `settings.catalog.bookFamilies` nothing yet (UI comes in Task 8) — instead verify no regressions: legacy-linked grout still lists its colors, color pick still stamps SKU + caulk. `npm test` + `npm run lint`.
- [ ] **Step 5: Commit** — `git commit -am "feat: grout family call sites read the merged stock+book projection"`

---

### Task 7: Settings picker — add linked products from the stock books

**Files:**
- Modify: `src/SettingsWorkspace.jsx` — props (line 28), `fillFromStock` (101-111), add form (line 471), detail panes (`renderGroutDetail`/`renderMortarDetail`/`renderUnderlayDetail`/`renderAttachedDetail`), master hints (line 159-162)

**Interfaces:**
- Consumes: `bookStock`, `bookStockReady`, `books`, `linkedItemState`.
- Produces: the add-product `StockSearch` searches `pickerItems = [...stock, ...Object.values(bookStock).flat()]`; a picked book row stamps `draft.link = { bookId: it.bookId, sku: it.sku }`; every detail pane shows a link tag + keep-and-warn chip + Relink/Unlink.

- [ ] **Step 1: Merge the search source.** Add `bookStock = {}`, `bookStockReady`, `refreshBookStock` to the component props. Above the return: `const bookItems = Object.values(bookStock).flat();` `const pickerItems = [...stock, ...bookItems];` `const bookName = (id) => books.find((b) => b.id === id)?.name || "book";`. In `renderAddForm` (line 471) swap `stock.length > 0 && <StockSearch stock={stock} …>` → `pickerItems.length > 0 && <StockSearch stock={pickerItems} …>`. (`searchStock` already filters inactive/disabled rows and reads only fields `normOrderItem` carries, so no search.jsx change.)
- [ ] **Step 2: Stamp the link in `fillFromStock`.** Append to the returned draft patch: `...(it.bookId ? { link: { bookId: it.bookId, sku: it.sku } } : {})`, and keep the retail-first price line as-is (`it.price` is the ERP retail). Show the pending link in the add form like the existing `draft.book` chip:

```jsx
            {draft.link && (
              <div className="flex items-center gap-2 text-xs text-slate-500 rounded-md border border-indigo-100 bg-indigo-50/40 px-2.5 py-1.5">
                <Link2 size={12} className="shrink-0" /><span className="flex-1">Linked to <b>{bookName(draft.link.bookId)}</b> · <span className="ft-mono">{draft.link.sku}</span> — re-imports refresh the price</span>
                <button onClick={() => setDraft({ ...draft, link: null })} title="Don't link" className="text-slate-300 hover:text-red-500 shrink-0"><X size={13} /></button>
              </div>
            )}
```

Place it in the shared area right below the name input (it applies to all four kinds).
- [ ] **Step 3: Detail-pane link strip.** One helper rendered at the top of all four detail renderers (right under `delConfirm(...)`):

```jsx
  const linkStrip = (co, kind, p) => {
    if (!p.link) return null;
    const state = linkedItemState(p.link, bookStock);
    const unlink = () => setProduct(co.id, kind, p.id, { link: null });
    return (
      <div className={`mt-3 flex items-center gap-2 text-xs rounded-md border px-2.5 py-1.5 max-w-xl ${state === "ok" ? "border-slate-200 text-slate-500" : "border-amber-200 text-amber-600"}`}>
        {state === "ok" ? <Link2 size={12} className="shrink-0" /> : <Link2Off size={12} className="shrink-0" />}
        <span className="flex-1">
          {bookName(p.link.bookId)} · <span className="ft-mono">{p.link.sku}</span>
          {state === "inactive" && " — no longer in this book's stock; keeping last known price"}
          {state === "missing" && " — book or SKU not found; keeping last known price"}
        </span>
        <button onClick={unlink} className="text-slate-400 hover:text-red-500 shrink-0">Unlink</button>
      </div>
    );
  };
```

Import `linkedItemState` from `./booklink.js`. To **relink**, the user unlinks and re-picks via the search already present in each pane's context (grout base search / add form) — plus add a small `StockSearch` under the strip when `state !== "ok"`, `onPick={(it) => it.bookId && setProduct(co.id, kind, p.id, { link: { bookId: it.bookId, sku: it.sku }, sku: it.sku, ...(it.price != null ? { price: String(it.price) } : {}) })}` with placeholder `"Relink — search the stock books…"` and `stock={bookItems}`.
- [ ] **Step 4: Master hint.** In `masterHint` (line 159), append for mortars/attached/underlayments/grouts: when `p.link`, suffix `" · linked"` so the master list shows what's connected.
- [ ] **Step 5: Verify in the preview** — add a Mannington underlayment via search (e.g. "aquabar"): lands with name/SKU/price prefilled + link chip; product detail shows the link strip. `npm test` + lint. Screenshot for the PR.
- [ ] **Step 6: Commit** — `git commit -am "feat: Settings picker links catalog products to stock-book rows"`

---

### Task 8: Family setup UI — create a color family from a book row

**Files:**
- Modify: `src/SettingsWorkspace.jsx` — grout add form + `renderGroutDetail`; new `FamilyConfirm` modal component in the same file

**Interfaces:**
- Consumes: `deriveSeriesRule`, `matchRule`, `parseColorToken`, `resolveFamily`, `normBookFamily`; `bookStock`; `catalog.bookFamilies`.
- Produces: picking an ERP **grout** row in the grout add form (or "Link colors from a stock book" in the grout detail) opens `FamilyConfirm`; confirming appends the normalized family to `catalog.bookFamilies` and sets the grout's `book` field to the family name (the ADR 0007 field — everything downstream already works via Task 6's projection).

- [ ] **Step 1: FamilyConfirm modal.** Add to SettingsWorkspace.jsx (above the default export):

```jsx
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
  const baseCandidates = items.filter((it) => !matchRule(rule, it.description) && /part a&b|grout base|full unit|commercial unit|sanded/i.test(it.description) && new RegExp((rule.prefix.split(/\s+/).find((w) => w.length > 4) || " "), "i").test(it.description));
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
```

Imports to add at the top of SettingsWorkspace.jsx: `import { deriveSeriesRule, matchRule, parseColorToken, normBookFamily, linkedItemState } from "./booklink.js";` (linkedItemState from Task 7).
- [ ] **Step 2: Openers.** State: `const [famSeed, setFamSeed] = useState(null);`. (a) In `fillFromStock`, when `adding.kind === "grouts"` and `it.bookId` and the description looks grout-ish, offer instead of auto-linking: keep the normal fill, then `setFamSeed({ bookId: it.bookId, description: it.description, forDraft: true })` **only when the user clicks a new "Link colors…" chip** — simplest correct UX: after an ERP grout pick, render a chip in the grout add form: `<button onClick={() => setFamSeed({ bookId: draft.link.bookId, description: draftSeedDesc, forDraft: true })}>Set up color family…</button>` where `draftSeedDesc` is stashed on the draft by `fillFromStock` (`...(it.bookId ? { _desc: it.description } : {})`). (b) In `renderGroutDetail`, next to the existing `FamilySearch` row add: `{bookItems.length > 0 && <button onClick={() => setFamSeed({ pick: true, forProduct: { coId: co.id, gId: g.id } })} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium shrink-0">New family from stock book…</button>}` — when `famSeed.pick` is set, show a `StockSearch stock={bookItems}` inside the modal first to choose the seed row (reuse FamilyConfirm by only rendering it once `famSeed.description` exists; the pick step swaps `famSeed` to `{ bookId, description, forProduct }`).
- [ ] **Step 3: Save handler.** Render near the `addingCat` modal:

```jsx
        {famSeed?.description && (
          <FamilyConfirm seed={famSeed} bookStock={bookStock} books={books} inp={inp} lbl={lbl}
            existingNames={[...gFamilies.map((f) => f.product.toLowerCase()), ...(catalog.bookFamilies || []).map((f) => f.name.toLowerCase())]}
            onClose={() => setFamSeed(null)}
            onSave={(fam) => {
              const next = { ...catalog, bookFamilies: [...(catalog.bookFamilies || []), fam] };
              if (famSeed.forProduct) onChange({ ...next, companies: next.companies.map((co) => co.id === famSeed.forProduct.coId ? { ...co, grouts: co.grouts.map((g) => g.id === famSeed.forProduct.gId ? { ...g, book: fam.name } : g) } : co) });
              else { onChange(next); setDraft((d) => ({ ...d, book: fam.name })); }
              setFamSeed(null);
            }} />
        )}
```

- [ ] **Step 4: Family warnings.** In `renderGroutDetail`, the existing "book link missing" chip (line 361) already fires when `famFor(g)` finds nothing — with book families flowing through `gFamilies` via projection, a zero-match family shows cached colors instead (Task 2), so add the explicit warn: import `familyWarnings` and render an amber chip when `familyWarnings(catalog.bookFamilies, bookStock).some((w) => w.name.toLowerCase() === (g.book || "").toLowerCase())`: text `"This family's rule matched nothing in the last import — colors shown are the last known set. Re-check the rule."`
- [ ] **Step 5: Verify in the preview**: create "SpectraLock Pro" from the Sheet1 book row, confirm ~40 colors listed, bases offered, Latasil picked; grout detail shows the family colors; a job row's grout offers the colors, picking one stamps SKU + caulk (check the order summary line). Screenshot for the PR. `npm test` + lint.
- [ ] **Step 6: Commit** — `git commit -am "feat: create grout color families from stock-book rows (FamilyConfirm)"`

---

### Task 9: Migration — assisted link pass

**Files:**
- Modify: `src/SettingsWorkspace.jsx` — Materials middle column footer (near line 603) + a `LinkMigration` modal

**Interfaces:**
- Consumes: `proposeLinks`, `applyProposals`, `bookStock`, `books`.
- Produces: a "Link products to stock books…" button (only when `bookStockReady` and some product has a sku without a link) opening a modal: checkbox list of proposals (all pre-checked) grouped by company, an unmatched list labeled "no match" / "in several books", Apply → `onChange(applyProposals(catalog, selected))`.

- [ ] **Step 1: Implement** the modal (pattern-match FamilyConfirm's structure; ~60 lines — checkbox rows `[{checked}] {companyName} · {name} → {bookName} · {sku}`; footer `Apply N links`). Unmatched section lists `{name} · {sku} — {reason === "none" ? "not in any stock book" : "in several books — link it from the product page"}`. The 3 grout SKUs missing from the exports surface here as "not in any stock book" (spec §5).
- [ ] **Step 2: Verify in the preview** — with the seven books imported, run the pass: existing SKU-carrying products propose correctly; apply; product details show link strips. Screenshot. `npm test` + lint.
- [ ] **Step 3: Commit** — `git commit -am "feat: assisted migration pass links existing catalog products to stock books"`

---

### Task 10: ADR, docs, self-review, PR

**Files:**
- Create: `docs/adr/0027-catalog-stock-book-links.md`
- Modify: `docs/adr/README.md` (index line), `CLAUDE.md` (Source layout: add `booklink.js`/`usebookstock.js`; the ADR 0006/0007 paragraphs get one sentence each noting the ERP-book successor)

- [ ] **Step 1: Write ADR 0027** — status Accepted, context (workbook retiring; spec link), decision: (1) `product.link = {bookId, sku}` — IDs not text; sync at import apply only; never renames; keep-and-warn on loss. (2) `catalog.bookFamilies` — rule-stored families projected into stock-shaped items so ADR 0006/0007 mechanics are reused verbatim; cache fallback on zero-match. (3) Legacy workbook paths stay dormant until removed. Consequences: old workbook's Grout & Caulk no longer required once families are set up; `syncCatalogPrices` name-matching superseded for linked products.
- [ ] **Step 2: Update the index + CLAUDE.md.** Follow the existing README table format; keep CLAUDE.md edits to the Source-layout lines and one-sentence pointers.
- [ ] **Step 3: Full check** — `npm test`, `npm run lint`, `npm run build`. Fix anything red.
- [ ] **Step 4: Commit + PR**

```bash
git add -A && git commit -m "docs: ADR 0027 — catalog stock-book links + family rules"
git push -u origin catalog-erp-links
gh pr create --title "Catalog fed from ERP stock books: item links + grout family rules" --body "Implements docs/superpowers/specs/2026-07-21-catalog-erp-book-links-design.md ... (summarize tasks; include preview screenshots from Tasks 7-9)"
```

PR body must carry the preview screenshots (CLAUDE.md non-negotiable 3) and end with the standard generated-with footer.

---

## Self-review (done at authoring)

1. **Spec coverage:** data model §1 → Tasks 1-4; import sync §2 → Tasks 3, 5; families §3 → Tasks 2, 6, 8; picker §4 → Task 7; migration §5 → Task 9; safety nets §6 → Tasks 2 (cache), 7 (link strip), 8 (family warn); testing §7 → Tasks 1-4 units + preview proof; ADR → Task 10. Spec's "name refresh" line was corrected in the spec itself (jobs resolve by name — sync must not rename).
2. **Placeholders:** Tasks 8-9 describe two modal components with full structure for one and a pattern reference for the sibling — the sibling lists exact rows/labels/handlers, acceptable for a UI clone task. No TBDs.
3. **Type consistency:** `normLink`/`normBookFamily` shapes match between booklink.js, catalog.js normalization, sync, and UI usage; `itemsByBook`/`bookStock` is the same `{bookId: items[]}` everywhere; `applyBookImportSynced` keeps `applyBookImport`'s `(bookId, diff, opts)` signature so pricebooklib needs no change.
