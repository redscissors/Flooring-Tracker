# Schluter Configurator UI Implementation Plan (Phase 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/SchluterConfigurator.jsx` — the production Schluter popup
(Kits / Custom shower / Browse over the shared build column and the
`showerdraw` rail) — fed by the mandatory registry→engine adapter, wired
into row search, reconfigure chips, and the Apps hub.

**Architecture:** The engine (phase 2, `src/schluter.js`) is inert until a
caller feeds it rows. This phase builds that caller in three layers:
(1) `src/schluteradapter.js` maps live registry rows (`normOrderItem` /
`normBookItem` shape) and the Settings mortar pick into the engine's
fixture shape — the ADR 0032 first deliverable, landed and tested BEFORE
any JSX; (2) `src/schluterdraw.js` maps a Schluter build into the shared
`showerdraw` geometry (`o`/`dWalls`/curb segs) the wedi rail already
renders; (3) `SchluterConfigurator.jsx` is the popup itself, a `React.lazy`
chunk mirroring the wedi popup's shell idioms, with the prototype
(`.scratch/097_schluter-configurator/prototype.html`, the approved spec)
as the reference implementation for every surface. Where this plan and the
prototype disagree, the prototype wins.

**Tech Stack:** React 18 + the repo's Tailwind-override theme, `node --test`
for every non-JSX module, the wedi-preview harness pattern for preview proof.

## Global Constraints

- Branch: this session's designated branch off latest `main` (needs PRs
  #320 + #321 merged — both are). One PR; never push to `main`.
- No Supabase writes anywhere; registry reads go through the existing
  `useBooks`/`useBookStock` paths (`loadBookItems`, the `bookStock` cache).
  Anything reading the stock-book cache checks `bookStockReady` first.
- `schluter.js` / `schluteradapter.js` / `schluterdraw.js` /
  `SchluterConfigurator.jsx` never load at boot (ADR 0026): the popup is a
  `React.lazy` chunk; the only boot-side piece stays `schluterquery.js`,
  which must never import any of them. None of the Schluter modules may
  import `wedi.js` (chunk hygiene, ADR 0033) — shared drawing code comes
  from `showerdraw.js`/`.jsx` only.
- Owner decisions 1–8 (`.scratch/097_schluter-configurator/README.md`)
  are binding. Decision 4's third option (premade KERDI-BOARD-SB bench)
  lands HERE as a UI add-on pick. Decision 2's mortar fallback maps the
  Settings → Materials pick into `cfg.mortarItem`
  (`{name, price, cost, stock, sfPerBagAt15}`).
- Ride-alongs assigned to this phase by the final reviews: `lineItems`
  gets the wedi-shaped `(build, opts)` signature + a real `mode: "kit"`
  in the same move; `buildKit`'s text/number lookups get promoted into
  classifier facts; `brandColor` gets its vendor lead decided ("Schluter — "
  on rows that don't already start with a Schluter word, the wedi idiom);
  weak-word + size queries hitting BOTH configurators' pinned rows is
  resolved as: both rows render (the `vendorRows` array already supports
  it), wedi listed first.
- Every commit: `npm test` green (the repo's full `node --test` list).
- Preview proof before merge (repo rule 3): screenshots of the harness
  against the prototype's surfaces ride the PR.

## File Structure

- `src/schluteradapter.js` (new) — pure mapping, no React: live rows →
  engine rows; Settings mortar pick → `cfg.mortarItem`.
- `src/schluteradapter.test.js` (new) — driven by REAL `normOrderItem`
  rows built through `orderbook.js`.
- `src/schluterdraw.js` (new) — pure geometry glue: cfg/candidate →
  the shared drawing props. No React.
- `src/schluterdraw.test.js` (new).
- `src/schluter.js` (modify) — `lineItems` signature + kit mode;
  classifier facts for the buildKit lookups.
- `src/schluter.test.js` (modify) — updated for both.
- `src/SchluterConfigurator.jsx` (new) — the popup, lazy chunk.
- `src/schluterpreview.jsx` + `schluter-preview.html` (new) — dev-only
  harness over adapter(fixture-shaped live rows), the wedipreview pattern.
- `src/grid.jsx`, `src/mobile.jsx` (modify) — third pinned vendor row.
- `src/App.jsx` (modify) — `schluterPop` state, mount, `addSchluterLines`,
  reconfigure chip, `ft-open-layer` restore, mortar mapping props.
- `src/AppsWorkspace.jsx` (modify) — Schluter hub tab.
- `src/CLAUDE.md` (modify) — entries for every new/changed file.

---

### Task 1: `schluteradapter.js` — the registry→engine adapter

**Files:**
- Create: `src/schluteradapter.js`, `src/schluteradapter.test.js`

**Interfaces:**
- Consumes: `normOrderItem` rows (`orderbook.js`) — `description`,
  `vendorSkus`, `sku` (shop/ERP code on stock exports), `price`, `cost`,
  `size`, `unit`, `leadTime`, plus a caller-supplied stock flag (the row's
  book is stock-kind); `classify` from `./schluter.js`.
- Produces:
  - `adaptRow(row, { stock }) -> engineRow | null` — an engine-shaped
    object `{ sku, erp, name, size, unit, price, cost, stock, lead }`
    where `sku` is the FIRST code `classify()`'s grammar actually
    recognizes, tried in order: the row's own `sku`, then each
    `vendorSkus` entry; `null` when nothing parses (a non-shower row).
    `erp` = the shop's own `sku` when it differs from the chosen code.
  - `adaptBookRows(rows, { stock }) -> engineRow[]` — map + drop nulls.
  - `mortarItemFrom(name, mortarSettings) -> cfg.mortarItem | null` —
    `{ name, price, cost, stock: true, sfPerBagAt15: MORTAR_BED_SF_PER_BAG }`
    from a Settings `mortars` entry (`{tier1,tier2,tier3,unit,price}`).
    The Settings shape has no bed-coverage field (ADR 0032), so the rate
    is the module constant `MORTAR_BED_SF_PER_BAG = 8` (the prototype's
    ≈8 sf/bag at 1-1/2″), exported so the popup can caption it. `cost`
    mirrors `price` — a Settings material carries one number; the Cost
    tier must not read $0.
- Tests build rows through the REAL `normOrderItem` (ADR 0032's
  requirement), e.g. an ERP-stock-export tray whose `sku` is the shop
  code `1509824` with `KST965BF` in `vendorSkus`, and an EFT order row
  whose `sku` IS the mfg code (`SLRKSLT1220S`) with no `vendorSkus`.
  Pin: adapted stock row classifies as the 38×38 TT tray with
  `erp: "1509824"` and `stock: true`; adapted EFT row keeps `stock: false`;
  a non-shower row (`sku: "DITRA..."`, description "DITRA underlayment")
  adapts to `null`; `mortarItemFrom("Schluter All Set", settings.mortars)`
  carries the Settings price on both price and cost and rate 8.

Steps: failing tests → run (`node --test src/schluteradapter.test.js`,
FAIL: module not found) → implement → tests green → `npm test` → commit
`Schluter registry→engine adapter (ADR 0032 first deliverable)`.

---

### Task 2: engine ride-alongs — kit mode, wedi-shaped `lineItems`, classifier facts

**Files:**
- Modify: `src/schluter.js`, `src/schluter.test.js`

**Interfaces:**
- `lineItems(build, opts)` — the wedi shape. `build.mode`
  (`"kit" | "custom"`, default `"custom"`) and `build.cfg` ride the build
  object (the popup composes `{ ...buildKit(...), mode, cfg }`); the old
  `(build, cfg, opts)` positional cfg is gone. `opts.builderPct` as today.
  `brandColor` gains the wedi-idiom lead: `"Schluter — " + name` unless
  the name already starts with a Schluter family word
  (`/^\s*(schluter|kerdi|kereck|kers-b|all-set)/i`).
- `classify` gains derived facts so `buildKit` stops text-matching its own
  catalog: `corner: "inside" | "outside"` on KERECK rows (FI = inside,
  FA = outside), `seal: "pipe" | "valve"` on KMS rows (KMS172 pipe,
  KMSMV valve), `fastener: true` + `ct` (the "N ct" count from size) on
  KBZS screw rows, and `adhesive: true` on KERDIFIX. `buildKit` reads
  `i.corner === "inside"` etc. instead of `/inside corner/i.test(i.name)`;
  the board-panel pick keys on the largest-sf ½″ panel
  (`g === "board" && !thick2 && !fastener`, max `sf`) instead of
  `sf === 32`, and fasteners on `i.fastener` with the biggest `ct`
  instead of `size === "100 ct"`.
- Pinned totals (the truth-table tests) must NOT move: the same catalog
  yields the same picks. Update call sites/tests to the new signature.

Steps: update tests first (signature + facts + an unchanged-total
assertion) → red → implement → green → `npm test` → commit
`Schluter engine: kit mode + wedi-shaped lineItems, classifier facts`.

---

### Task 3: `schluterdraw.js` — build → shared drawing shape

**Files:**
- Create: `src/schluterdraw.js`, `src/schluterdraw.test.js`

**Interfaces:**
- Consumes: a cfg (`{w, d, curbed, drain, wallSys, walls:[{name,on,len,h}],
  bench}`), a tray candidate from `trayCandidates`, and the build's
  add-on state; `showerdraw.js` constants only (never `wedi.js`).
- Produces (all pure, node-testable):
  - `schluterDiag(cfg, cand) -> o` — the `showerdraw` diagram:
    `room: {w: cfg.w, d: cfg.d}`, one `pieces` entry
    `{ kind: "pan", item: {name: tray.name, sku}, x: 0, y: 0, w: cfg.w,
    d: cfg.d, cut: cand.cut ? { w: tray.w, d: tray.d } : null }` (the
    cut-down shape wedi's cutdownOption uses, so cut edges draw dashed),
    `drain` at the UNCUT tray's moulded position clamped into the room
    (point: `{type:"point", x: min(tray.w/2, w-2), y: tray.d/2 or
    tray.d*0.27 offset}`; linear: `{type:"linear", x: w/2, y: 2.75,
    len: min(w-8, channel len), axis: "w"}`), a warning line when the
    drain lands >1″ off room centre after a cut, `title` = tray name;
    mortar fallback: no pieces cut, `title: "Mortar bed + KERDI"`.
  - `schluterWalls(cfg) -> dWalls` — `[{side, len, h, at: "lo",
    faces: "in", wid, courses}]` for the on walls (back/left/right);
    `courses` = 32″ panel-course tick heights when `cfg.wallSys ===
    "board"` (KERDI-BOARD 48×96 laid landscape → ticks every 48″ up the
    wall height), `[]` on membrane walls (the roadmap rule: course ticks
    only on board walls).
  - `schluterCurb(cfg) -> {segs, diags, h, w}` — curbed:
    one entry-edge seg `{side:"entry", from:0, len:cfg.w, ext0:0, ext1:0}`
    with the KBSC profile (`h: 4.5, w: 6`); curbless: empty segs (the
    ramp is a build line, not a curb band).
- Tests pin: a 60×38 room on the 60×38 tray → `cut: null`, centred drain;
  the same room on a 72×48 tray → `cut: {w:72,d:48}` + off-centre warning;
  board walls carry courses, membrane walls don't; curbless has no segs.

Steps: red → implement → green → `npm test` → commit
`Schluter drawing glue: build → shared showerdraw shape`.

---

### Task 4: `SchluterConfigurator.jsx` — the popup

**Files:**
- Create: `src/SchluterConfigurator.jsx`
- Reference: the prototype's `renderPopup` (every surface, verbatim
  behavior), `WediConfigurator.jsx` (shell/TierBar/rail idioms).

**Props (the wedi contract + catalog sourcing):**
`{ seed, tier, onTierChange, schluterBuilderPct, onAdd, onClose, areaName,
projectName, onConfigChange, embedded, stockRows, bookStockReady, books,
loadBookItems, mortars, mortarDefault }`
- `stockRows`: App's flattened stock-cache items (`stockItems` memo).
- `books` + `loadBookItems`: on open, the popup fetches every active
  order-kind book whose name or `data.brandLabel` says `/schluter/i`
  (the EFT special-order rows) — ADR 0026's re-fetch-on-open pattern —
  and unions: `catalogOf(adaptBookRows(stockRows, {stock:true})
  .concat(adaptBookRows(orderRows, {stock:false})))`. Stock rows win a
  SKU collision (the shelf copy of an EFT row). Until `bookStockReady`
  and the fetch settle, the popup shows the stock-loading empty state;
  an empty catalog after settle says which book to import (ADR 0032's
  inert-without-rows consequence, surfaced instead of a blank screen).
- `mortars` + `mortarDefault`: Settings mortars map + catalog default
  name; the mortar-bed fallback card carries a product `<select>` over
  the map's names seeded to the default, mapped through `mortarItemFrom`
  into `cfg.mortarItem`.

**Surfaces (prototype-faithful):**
- Header: idblock ("Vendor configurator / Schluter shower systems"),
  Source seg (Stock only / Full catalog → the engine's `source`
  "stock"/"all"), TierBar (the wedi component idiom: Retail "1.5× cost" /
  Builder "−`schluterBuilderPct`%" / Cost, mirroring the job tier via
  `tier`/`onTierChange` like wedi, local retail-seeded preview when
  `embedded`), close ×.
- Tabs: **Kits** — every tray as a `kitrow` (size · drain · stock/special
  tag · sku+name · kit price through the tier lens); clicking seeds the
  room to the tray and lands on Custom (the prototype behavior). Trays
  gray out under Stock only when unstocked. **Custom shower** — Room
  (w×d, Entry curbed/curbless, Drain point/offset/linear), the wall-system
  fork (KERDI over backer vs KERDI-BOARD with the explainer line), Walls
  (three rows, on/off + len × h + sf; back length follows `w`, sides
  follow `d`), ranked option cards from `trayCandidates` (Exact / Cut
  down / Deep cut / mortar Fallback, stock dot + tier price; click picks),
  Add-ons chip bar (every `g:"extra"` catalog row — niches, the premade
  SB benches (decision 4's third option), bench corner kit — toggling a
  manual line), Site-built bench chips (framed / 2″ build-up →
  `cfg.bench`). **Browse** — search bar + the `SLT_SECTIONS` filter board
  (Trays/Drains/Waterproofing/Build/Extras/Factory kits — factory kits
  ONLY here, decision 5), the thin-set/KERDI figurer card, rows with
  stock tint, on-shelf/special-order line, stepper quantities feeding the
  manual list.
- Build column: grouped lines (Base/Drain/Walls/Seams/Curb/Setting/
  Extras) from `buildKit(cfg, cat, {source, pick})` + manual lines,
  special-order tags, the from-stock meter, tier totals, and
  **Add to product lines** → `onAdd(lineItems({...build, mode, cfg},
  {builderPct: schluterBuilderPct}))`; `mode` is `"kit"` while the build
  is an untouched Kits-tab pick, `"custom"` once the room is edited.
- Rail: `TopDown`/`Iso` from `showerdraw.jsx` fed by Task 3's builders
  (`o`, `wallOn` keyed by wall index, `dWalls`, `curbs`/`curbDiags`/
  `curbW`/`curbH`; no benches array — the premade bench is a build line,
  drawn via the diag's extras marker warning list instead; `itemFn`/
  `normBenchFn` therefore not required), plus the cut list
  (tray cut, Vario trim, curb cuts, backer-by-others, curbless note —
  the prototype's `cutList` rows).
- Seed: `seedFromQuery` output (`{tab, input, search}`) or a saved
  `product.schluter` marker `{mode, cfg}` (reconfigure) — cfg restores
  the room + wall system + bench; `onConfigChange` mirrors wedi's
  open-layer refresh contract.

No node tests for the JSX (the repo pattern); its logic lives in the
tested modules above. Commit: `SchluterConfigurator popup (phase 3 UI)`.

---

### Task 5: wiring — search rows, App.jsx, Apps hub, docs

**Files:**
- Modify: `src/grid.jsx`, `src/mobile.jsx` — import the three
  recognizer functions from `./schluterquery.js` (never `schluter.js`)
  and append the third `vendorRows` entry
  `{ id: "schluter", attr: "data-schluter-entry", title: "Schluter shower
  systems — kits, custom rooms, catalog", sub: schluterQuerySummary(...) }`;
  `onVendor(query, "schluter")`. Both configurators' rows may render at
  once — that's the resolved phase-3 call.
- Modify: `src/App.jsx` — `import { seedFromQuery as schluterSeed } from
  "./schluterquery.js"`; `const SchluterConfigurator = lazy(...)`;
  `schluterPop` state (the wedi shape `{aid, pid, seed}`); `onVendor`
  branches on `which === "schluter"`; `addSchluterLines` (identical to
  `addWediLines`); the reconfigure chip on
  `p.schluter?.cfg && !p.schluter.part` (`data-schluter-reconfig`);
  `ft-open-layer` save/restore gains the `"schluter"` kind; the mount
  passes `schluterBuilderPct` from `normPricing`, `tier` like wedi,
  `stockRows={stockItems}`, `bookStockReady`, `books`, `loadBookItems`,
  `mortars={settings.mortars}`,
  `mortarDefault={settings.catalog?.defaults?.mortar}`.
- Modify: `src/AppsWorkspace.jsx` — a Schluter tab beside wedi
  (lazy chunk, `embedded`, `requestCommit` destination prompt); App
  passes the same catalog props through.
- Modify: `src/CLAUDE.md` — entries for `schluteradapter.js`,
  `schluterdraw.js`, `SchluterConfigurator.jsx`, `schluterpreview.jsx`;
  amend the `schluter.js` entry (kit mode, facts, adapter reference).

`npm test` + `npm run build` green. Commit:
`Wire the Schluter configurator: search entry, reconfigure, Apps hub`.

---

### Task 6: preview harness + proof

**Files:**
- Create: `src/schluterpreview.jsx`, `schluter-preview.html` (the
  wedi-preview pattern: dev-only, no Supabase, not part of the app build).
  The harness feeds the popup `stockRows` built by running the FIXTURE
  rows backwards through `normOrderItem` (shop-code sku + mfg code in
  `vendorSkus` for stocked rows; EFT-shaped rows for special order), so
  the preview exercises the REAL adapter path end to end.
- Screenshots (Playwright, the repo's chromium): Kits tab, Custom curbed
  60×38 point (exact tray), Custom 48×48 linear under Stock only (the
  55×55 deep-cut re-rank — the P2 demo), mortar fallback with a Settings
  mortar picked, Browse with the filter board open, and the build column
  with a premade SB bench add-on. Compared side-by-side with the
  prototype's surfaces in the PR body.

`npm test` + `npm run build` green. Commit the harness; screenshots ride
the PR (committed under `.scratch/097_schluter-configurator/phase3-proof/`).

## Self-Review

- Spec coverage: adapter (ADR 0032 consequences) — Task 1; decisions 2
  (mortar pick), 4 (bench forms incl. premade), 5 (factory kits only in
  Browse), 6 (TT ranking — engine, already pinned), 7 (registry reads),
  8 (geometry convention — the shared drawing module carries it) —
  Tasks 3–4; ride-alongs — Tasks 2, 4, 5; P2's source switch ships in
  the popup header (the shared-shell generalization to wedi is phase 4,
  unchanged). P3 compare is phase 5 — out of scope here.
- The fixture's `free` (on-shelf count) has no live-row equivalent —
  Browse shows the stock tag without a count on live rows; the harness
  matches.
- Type consistency: `lineItems(build, opts)` everywhere after Task 2;
  `cfg.mortarItem` shape identical across adapter, engine, popup.
