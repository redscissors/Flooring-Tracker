# Sheoga Trim & Accessories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Trim & accessories" tab in the Sheoga configurator, priced off
Sheoga's distributor accessory sheet. The team uploads that sheet to the
Sheoga vendor book, which also carries a third markup (trim, default 100%).

**Architecture:**
- **`src/sheogatrim.js`** is a new pure module. It parses the sheet, diffs
  two editions, maps a floor build onto trim, and prices a trim build into
  product-row payloads.
- **Imports run one way:** it imports constants from `sheoga.js`, and
  `sheoga.js` never imports it.
- **The parsed sheet lives on the vendor book's `data`** (no SQL) and reaches
  the configurator as a `trimBook` prop.
- **The trim tab is a new mode** whose UI lives in a new
  `src/SheogaTrim.jsx`, mounted by `SheogaConfigurator.jsx`.

**Tech Stack:** React 18, Vite 5, Tailwind, `xlsx` 0.18, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-02-sheoga-trim-accessories-design.md`
(mockup: `.scratch/mockups/sheoga-accessories-2026-10-02/`)

## Global Constraints

- Never run SQL or write to the live Supabase project. This feature needs no
  SQL (`price_books.data` is jsonb).
- Never push to `main`. Work on `claude/stoic-fermi-isi2ga`, land through a
  PR, and attach preview screenshots before merge.
- Book writes go only through `updateBook(id, { dataPatch })`.
- Profile ids are fixed:
  - `nose35` "Rabbeted nosing 3½"" (size `3½"`);
  - `nose55` "Rabbeted nosing 5½"" (size `5½"`);
  - `shoe` "Shoe mold ½" × ¾"" (size `½" × ¾"`);
  - `reducer` "Reducer ¾" × 2½"" (size `¾" × 2½"`);
  - `tmold` "T-mold ¾" × 2½"" (size `¾" × 2½"`).
- Species, in this order: Beech, Cherry, Maple, Hickory, Red Oak, White Oak,
  Walnut, Q/R White Oak.
- Run lengths: 3 4 5 6 7 8 9 10 12 (feet), plus `"rl"` = Random lengths
  (qty in lf). Reducer/T-mold are 8' only. Slip tongue is sold in bundles
  (`bundleLf`, 50 on this sheet).
- `DEFAULT_TRIM_MARKUP = 100`.
- Plugs are never parsed or offered.
- Prices round with `round2`, then `sellOf(unitCost, markupPct)` from
  `sheoga.js`. Lines land retail (ADR 0018).
- Comments: only for non-obvious business rules (CLAUDE.md "Code Comments").
- Theme: reuse existing Tailwind slate/indigo classes and `--ft-*` vars, and
  the configurator's existing rail primitives (Sect/Chips/Seg/MorphSelect).

## Review Focus

1. **The file uploaded is not the accessory sheet.** Expect a single problem
   ("Not Sheoga's accessory pricing sheet") and no Save. Covered: Task 1.
2. **UPDATED written as text ("10/01/2026"), not an Excel serial.** Expect the
   same `sheetDate`. Covered: Task 1.
3. **Junk quantities typed in a run** (blank, negative, `2.7`, a length not in
   the list). Expect them clamped to whole counts ≥ 0, with an unknown length
   treated as 8'. Never a NaN price. Covered: Task 2.
4. **Reopening a placed trim kit after the book was deleted or its sheet
   removed.** Expect the "upload the sheet" empty state, no crash, and the
   placed lines untouched. Covered: Task 2 (`calcTrim(cfg, null)`) + Task 6
   UI step.
5. **Matching a stocked prefinished floor with a texture in its color**
   ("Cattail · Saw Cut"), or a Live Sawn floor. Expect texture `sawcut`,
   stain "Cattail", species White Oak. Covered: Task 2.

---

### Task 1: Accessory-sheet parser and diff

**Files:**
- Create: `src/sheogatrim.js`
- Create: `src/sheogatrim.test.js`
- Create: `src/testdata/sheoga-accessory-20261001.xlsx` (copy of the owner's
  upload, `/root/.claude/uploads/945756a5-7fa9-5119-8764-5caac5140b8e/8fd3b227-Sheoga_Accessory_Pricing_-_Distributor_-_20261001.xlsx`)

**Interfaces:**
- Produces:
  - `TRIM_PROFILES: { id, name, short, size, fixedLen?: 8 }[]`, in the
    Global Constraints order. Reducer and T-mold have `fixedLen: 8`.
  - `TRIM_SPECIES: string[]`
  - `isSheogaAccessorySheet(sheets): boolean`
  - `parseAccessorySheet(sheets): { sheet: AccSheet | null, problems: string[] }`
  - `diffAccessorySheets(prev: AccSheet|null, next: AccSheet): { label: string, from: number, to: number }[]`
- `AccSheet` is:
  ```
  { sheetDate: "YYYY-MM-DD" | "",
    species: { [species]: { nose35, nose55, shoe, reducer, tmold } },
    prefin: { nose35, nose55, shoe, reducer, tmold },
    slip: { perLf, bundleLf } }
  ```
- `sheets` is `readXlsxSheets`' shape: `[{ name, rows: any[][] }]`.

- [ ] **Step 1: Copy the fixture and write the failing tests.**
  - Load the fixture with
    `XLSX.read(fs.readFileSync(path))` → `wb.SheetNames.map((name) => ({ name, rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null }) }))`.
  - Tests:
    - `parse: reads the 10/01/26 sheet`:
      - `problems` is `[]` and `sheetDate === "2026-10-01"`;
      - `species["White Oak"].tmold === 2.16`;
      - `species["Q/R White Oak"].nose55 === 12.31`;
      - `species["Maple"].shoe === 1.07` (the trailing-space name);
      - `species["Red Oak"].nose35 === 3.61`;
      - `prefin` deep-equals `{ nose35: 2.4, nose55: 3.75, shoe: 1.85, reducer: 1.85, tmold: 1.85 }`;
      - `slip` deep-equals `{ perLf: 0.4, bundleLf: 50 }`;
      - `Object.keys(species)` equals `TRIM_SPECIES`;
      - the result has no `plugs` key.
    - `parse: a blanked price is a named problem`: set the Walnut T-mold
      cell (the row starting "Walnut", T-mold column) to `null`. Expect
      `sheet === null` and `problems` to include
      `"Walnut — T-mold price missing"`.
    - `parse: a renamed block header is a named problem`: rename `"T-Mold"`
      to `"T Molding"`. Expect `problems` to include
      `"T-mold block not found"`.
    - `parse: not the accessory sheet`:
      `[{ name: "x", rows: [["SKU","Price"],["A",1]] }]` gives
      `{ sheet: null, problems: ["Not Sheoga's accessory pricing sheet"] }`,
      and `isSheogaAccessorySheet` is false for it and true for the fixture.
    - `parse: a text UPDATED date reads the same`: replace the serial
      `46296` with `"10/01/2026"`. Expect `sheetDate === "2026-10-01"`.
    - `diff: names changed prices`: prev = parsed fixture; next = a clone
      with White Oak tmold `2.30` and prefin shoe `1.95`. Expect exactly
      `[{ label: "White Oak — T-mold", from: 2.16, to: 2.3 }, { label: "Prefinished — Shoe mold", from: 1.85, to: 1.95 }]`
      (species rows first, then prefin, then slip). `diff(null, next)` is `[]`.

- [ ] **Step 2: Run `node --test src/sheogatrim.test.js`.** Expected: FAIL
  (module not found).

- [ ] **Step 3: Implement the parser in `src/sheogatrim.js`.**
  - **Scan, don't index.** Find each block header cell by case-insensitive
    text: `rabbeted nosing`, `shoe mold`, `reducer`, `t-mold`. Its "Species"
    row is the next row at the same column.
  - **Nosing has two price columns.** The sub-header containing `3 1/2`
    maps to `nose35` and `5 1/2` to `nose55`. The other blocks take the
    column right of Species.
  - **Species rows** run until a row whose block column is empty or reads
    "Prefinished Charge" (that row supplies `prefin`).
  - **Species names:** trim and collapse spaces, and compare with `/` and
    spaces removed, case-insensitively, against `TRIM_SPECIES` (so
    "QR White Oak" → "Q/R White Oak").
  - **Slip tongue:** the cell after "Slip Tongue". `bundleLf` comes from
    `/(\d+)\s*LF/i` in the cell after that, defaulting to 50.
  - **UPDATED:** the first non-null cell below "UPDATED". A number is an
    Excel serial (`Date.UTC(1899,11,30) + n*86400000`); a string parses
    `M/D/YYYY`.
  - **Title test:** a cell matching `/sheoga accessory pricing/i`.
  - Any non-positive or non-numeric required price is a problem, worded
    `"<Species> — <short> price missing"` or `"<short> block not found"`.
    `short` is "Nosing 3½"", "Nosing 5½"", "Shoe mold", "Reducer",
    "T-mold". `"Prefinished — <short> charge missing"` and
    `"Slip tongue price missing"` cover the rest.

- [ ] **Step 4: Run `node --test src/sheogatrim.test.js`.** Expected: PASS.

- [ ] **Step 5: Commit** — `git add src/sheogatrim.js src/sheogatrim.test.js src/testdata && git commit -m "sheoga trim: accessory-sheet parser + diff"`

### Task 2: Trim pricing engine

**Files:**
- Modify: `src/sheogatrim.js`
- Modify: `src/sheoga.js` (the `MODES` entry + a `defaultConfig("trim")`
  branch only)
- Test: `src/sheogatrim.test.js`

**Interfaces:**
- Consumes:
  - from `sheoga.js`: `sellOf`, `TEXTURES`, `STAIN_COLORS`, `LIVE_SAWN_SP`;
  - from Task 1: `TRIM_PROFILES`, `TRIM_SPECIES`, `AccSheet`.
- Produces:
  - `TRIM_LENGTHS = [3,4,5,6,7,8,9,10,12]`, `DEFAULT_TRIM_MARKUP = 100`.
  - `defaultConfig("trim")` (in sheoga.js) →
    ```
    { match: true, sp: "White Oak", prefin: false, stain: "", stainCustom: false,
      sheen: "30", sheenCustom: false, tex: "smooth",
      runs: { nose35: [{ n: 0, len: 8 }], nose55: [{ n: 0, len: 8 }], shoe: [{ n: 0, len: 8 }] },
      reducer: 0, tmold: 0, slip: 0 }
    ```
    `MODES` gains `{ id: "trim", label: "Trim & accessories" }` last.
  - `TrimBook` = `{ sheet: AccSheet, tex: { [profileId]: number|null } }`
  - `trimFromFloor(snap): Partial<cfg> | null` — `{ sp?, prefin, stain,
    stainCustom, sheen, tex }` from a floor/stocked/hb snap.
  - `effectiveTrimCfg(cfg, floorSnap)` → the cfg with the floor patch
    applied when `cfg.match`, always returned with `match: false`. This is
    what gets staged and stored.
  - `calcTrim(cfg, trimBook) → TrimBuild | null` (null when `!trimBook?.sheet`)
    ```
    TrimBuild = { sp, finishText, texName, texBlocked: bool, costTotal,
      lines: [{ key, profile, unit: "pc"|"lf"|"bdl", qty, len: number|"rl"|null,
        unitCost, lfCost, sizeText, desc, qtyText, rows: [[label, amountText]] }] }
    ```
  - `trimLineItems(cfg, trimBook, markupPct)` → product payloads (`[]` when
    `calcTrim` is null or `texBlocked`).

- [ ] **Step 1: Write the failing tests.**
  - **Fixture build:** `book = { sheet: parsed, tex: {} }`; `wo` = cfg with
    `sp: "White Oak", prefin: true, stain: "Toasted Acorn", sheen: "30"`.
  - `calcTrim: White Oak prefinished pieces` with
    `runs.nose35 = [{ n: 2, len: 6 }]`,
    `runs.shoe = [{ n: 15, len: 8 }, { n: 30, len: "rl" }]`, `tmold: 2`,
    `slip: 1`. Lines, in profile order then slip:
    - nose35: `unit: "pc", qty: 2, unitCost: 49.56`;
    - shoe: `unit: "pc", qty: 15, unitCost: 25.68`;
    - shoe Random lengths: `unit: "lf", qty: 30, unitCost: 3.21`;
    - tmold: `unit: "pc", qty: 2, unitCost: 32.08`;
    - slip: `unit: "bdl", qty: 1, unitCost: 20`.
  - `sellOf` at 100 on those unit costs gives 99.12 / 51.36 / 6.42 / 64.16 /
    40.
  - `calcTrim: unfinished Red Oak reducer` gives `unitCost: 13.36`
    (1.67 × 8), with no prefinished row.
  - `calcTrim: texture blocks until priced`:
    - `tex: "sawcut"`, `book.tex = {}` → `texBlocked: true`, a row
      `["Textured — Saw Cut", "not set"]`, and `trimLineItems(...)` deep-equals
      `[]`.
    - With `book.tex.nose35 = 1` and only a nose35 run → `texBlocked: false`,
      `lfCost: 9.26`.
    - Slip alone with any texture → not blocked.
  - `calcTrim: junk quantities clamp`: runs `[{ n: -3, len: 6 }, { n: 2.7, len: 11 }, { n: "", len: 8 }]`
    → one line, `qty: 2, len: 8`. No NaN anywhere in the result
    (`JSON.stringify` has no "NaN"/"null" unitCost).
  - `calcTrim: no sheet` → `calcTrim(wo, null) === null`,
    `calcTrim(wo, { tex: {} }) === null`.
  - `trimLineItems: rows and markers` (one nose35 run + tmold 2):
    - two payloads;
    - `[0].sheoga` deep-equals `{ mode: "trim", cfg: { ...cfg, match: false } }`;
    - `[1].sheoga` deep-equals `{ mode: "trim", part: true }`;
    - each payload has `type: "hardwood", qtyType: "count", sku: ""`;
    - `[0]` has `sellUnit: "PC", qty: "2", priceSqft: "99.12", costSqft: "49.56", markupPct: "100", sizeText: '3½"'`;
    - `[0].brandColor === 'Sheoga Rabbeted nosing 3½" · 6\' pcs · White Oak · Prefinished Toasted Acorn · 30 sheen'`;
    - a Random-lengths line has `sellUnit: "LF"`, slip `sellUnit: "BDL"`,
      slip `brandColor === "Sheoga Slip tongue · 50 lf bundle"` and
      `sizeText: ""`. Slip carries no species, finish or texture.
  - `trimFromFloor`:
    - a floor snap `{ mode: "floor", cfg: { sp: "Live Sawn White Oak", tex: "sawcut", finish: "est", stain: "Cattail", sheen: "20" } }`
      → `{ sp: "White Oak", prefin: true, stain: "Cattail", stainCustom: false, sheen: "20", tex: "sawcut" }`.
    - A stocked snap `{ mode: "stocked", cfg: { sp: "Hickory", color: "Cattail · Saw Cut", sheen: "20" } }`
      → `sp: "Hickory", prefin: true, stain: "Cattail", tex: "sawcut"`.
    - `finish: "unf"` → `prefin: false, stain: ""`.
    - `finish: "nat"` → stain "Natural".
    - A vent snap → `null`.
  - `effectiveTrimCfg`: `match: true` + the floor snap above → species White
    Oak and `match: false`. `match: false` keeps its own `sp`.

- [ ] **Step 2: Run `node --test src/sheogatrim.test.js`.** Expected: the new
  tests FAIL.

- [ ] **Step 3: Implement in `src/sheogatrim.js`, plus the two `sheoga.js`
  additions.**
  - **Cost per lf:** `lfCost = round2(species + (prefin ? prefin[p] : 0) + (textured ? tex[p] : 0))`.
  - **`unitCost`:**
    - a run: `round2(lfCost × len)`;
    - `"rl"`: `lfCost`;
    - reducer/T-mold: `× 8`;
    - slip: `round2(perLf × bundleLf)`.
  - **Clamping:** `n` → `Math.max(0, Math.floor(Number(n) || 0))`. A length
    not in `TRIM_LENGTHS` and not `"rl"` → 8.
  - **Blocking:** textured = `tex !== "smooth"`. Blocked when any non-slip
    line has a null/blank `tex[profile]`.
  - **`texName`:** the TEXTURES name with " (standard)" stripped.
  - **`finishText`:** "Prefinished {stain} · {sheen} sheen" or
    "Unfinished". Texture is appended when textured.
  - **`brandColor`:** `"Sheoga " + [profile name, "{len}' pcs" | "random lengths", sp, finishText].join(" · ")`.
    For reducer/T-mold use "8' pcs".
  - **`trimFromFloor`:** mirrors `ventFromFloor`'s stocked "color · texture"
    split. Its species map is `{ [LIVE_SAWN_SP]: "White Oak" }`, otherwise
    the same name if it is in `TRIM_SPECIES`, else the species is omitted.

- [ ] **Step 4: Run `npm test`.** Expected: all pass (sheoga.test.js
  unaffected).

- [ ] **Step 5: Commit** — `git commit -am "sheoga trim: pricing engine + trim mode"` (add the test file).

### Task 3: Sheoga book — trim markup and trim book accessor

**Files:**
- Modify: `src/vendorbook.js`
- Test: `src/vendorbook.test.js`

**Interfaces:**
- Consumes: `DEFAULT_TRIM_MARKUP` (Task 2).
- Produces:
  - `normVendorMarkups(raw) → { flooring, vents, trim }`;
  - `sheogaMarkups(books, settings) → { markupPct, ventMarkupPct, trimMarkupPct, book }`;
  - `trimBookOf(books) → TrimBook | null` — the Sheoga vendor book's
    `{ sheet: data.sheets?.accessories, tex: normTrimTexture(data.trimTexture) }`,
    null without a book or a sheet;
  - `normTrimTexture(raw) → { nose35..tmold: number|null }` — blank, 0,
    negative or NaN → null;
  - `vendorBookSeed` data gains `markups.trim: DEFAULT_TRIM_MARKUP`.

- [ ] **Step 1: Write the failing tests.**
  - `normVendorMarkups({ flooring: 40, vents: 50 }).trim === 100`, and
    `normVendorMarkups({ trim: 80 }).trim === 80`.
  - `sheogaMarkups([], {}).trimMarkupPct === 100`, and with a book carrying
    `markups.trim: 120` → `120`.
  - `trimBookOf([])` and `trimBookOf([bookWithoutSheet])` are `null`. With
    `data.sheets.accessories = S` and `data.trimTexture = { nose35: "1.25", shoe: "" }`
    → `{ sheet: S, tex: { nose35: 1.25, nose55: null, shoe: null, reducer: null, tmold: null } }`.
  - `vendorBookSeed("sheoga", {}).data.markups.trim === 100`.

- [ ] **Step 2: Run `node --test src/vendorbook.test.js`.** Expected: FAIL.

- [ ] **Step 3: Implement the five changes in `src/vendorbook.js`.**

- [ ] **Step 4: Run `npm test`.** Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -am "sheoga book: trim markup + trimBookOf"`

### Task 4: Book page — Markup field and Price sheets tab

**Files:**
- Create: `src/sheogasheets.jsx` (`AccessorySheetCard`, `SheetReview`)
- Modify: `src/vendorbook.jsx` (third markup field; new tab; `userName`
  and `pendingSheet` props)
- Modify: `src/pricebooklib.jsx:419,623` (accept `userName`; pass it plus
  `pendingSheet` to `VendorBookPage`)
- Modify: `src/App.jsx` (pass `userName={profile.name || session email}` to
  `PriceBookLibrary`, the same name `confirmBook` stamps)
- Modify: `src/vendorbookpreview.jsx` + `vendor-book-preview.html` if needed
  (`?sheet=1` fetches `/src/testdata/sheoga-accessory-20261001.xlsx` and opens
  the review)

**Interfaces:**
- Consumes:
  - `parseAccessorySheet`, `diffAccessorySheets`, `TRIM_PROFILES`,
    `TRIM_SPECIES` (Task 1);
  - `normVendorMarkups`, `normTrimTexture` (Task 3);
  - `readXlsxSheets` (`src/fileread.js`).
- Produces:
  - `<VendorBookPage … userName pendingSheet={{ fileName, parsed } | null} onPendingDone />`.
    A non-null `pendingSheet` opens the Price sheets tab straight into
    review (used by Task 5).
  - `<SheetReview prev={AccSheet|null} fileName parsed={{ sheet, problems }} onSave={(sheet) => …} onCancel />`.
- **Writes:**
  - Save: `updateBook(id, { dataPatch: { sheets: { ...book.data.sheets, accessories: { ...sheet, fileName, uploadedAt: Date.now(), uploadedBy: userName } } } })`.
  - Textured Save: `updateBook(id, { dataPatch: { trimTexture } })`.
  - Markup Save: `markups: { flooring, vents, trim }`.

- [ ] **Step 1: Markup card.** Add a third field, "Trim & accessories". Its
  example is "White Oak T-mold, prefinished", cost
  `sheet ? round2(sheet.species["White Oak"].tmold + sheet.prefin.tmold) : 4.01`,
  per " /lf". The tab summary reads `flooring X% · vents Y% · trim Z%`.

- [ ] **Step 2: Price sheets tab.**
  - **Tab summary:** `accessories {Mon ’YY}` or "accessories — not
    uploaded" (tone `attn` when missing).
  - **Card list:**
    - the accessory row: file name, "sheet dated M/D/YY", "uploaded {date}
      by {name}", and an **Upload… / Replace…** button that takes a hidden
      `.xlsx,.xls` input plus drag-drop onto the card;
    - three "built into the app" rows: Flooring & stocked prefinished
      (Jan ’26), Wood vents (Feb ’22), Dampers (Jul ’26).
  - **When a sheet is stored:** the species × profile table, the
    "+ Prefinished" row, then a "+ Textured" row of five inputs with the note
    "not on Sheoga's sheet — enter from Sheoga" and its own Save. Below that,
    "Slip tongue $0.40/lf in 50 lf bundles".
  - **Help:** standing help goes behind a `HelpTip` on the section heading
    (ADR 0045): "An uploaded sheet prices the configurator's Trim &
    accessories tab. Replace it when Sheoga sends a new one — new picks use
    the new prices, saved estimates keep theirs."

- [ ] **Step 3: `SheetReview`.**
  - **Problems:** the red list "Couldn't read this sheet:" + `problems`,
    with Save disabled.
  - **Otherwise:**
    - the parsed table, with cells in `diffAccessorySheets(prev, sheet)`
      highlighted (amber) and titled `was $X`;
    - a summary line: "N prices changed" / "First upload — 40 prices" /
      "No prices changed";
    - the sheet date;
    - **Save sheet** and **Cancel**.

- [ ] **Step 4: Verify in the harness.**
  - Run `npx vite --port 5199` and open
    `http://localhost:5199/vendor-book-preview.html?book=1&sheet=1`.
  - Expected: the review shows the "First upload — 40 prices" line.
  - Save it; then the stored table shows White Oak T-mold 2.16, and the
    Markup tab shows trim 100%.
  - Run `npm test` and `npm run build`. Expected: both pass.

- [ ] **Step 5: Commit** — `git commit -am "sheoga book: Price sheets tab + trim markup field"` (add the new file).

### Task 5: Library drop zone routes the accessory sheet

**Files:**
- Modify: `src/pricebooklib.jsx`:
  - `ImportRouter` `readRow` and the route-step row UI;
  - `startRun`, plus the route step's continue button when the only runnable
    rows are accessory rows;
  - `PriceBookLibrary` state `pendingSheet`.
- Modify: `src/headerpreview.jsx` (a mock Sheoga vendor book, for the proof)

**Interfaces:**
- Consumes: `isSheogaAccessorySheet`, `parseAccessorySheet` (Task 1),
  `vendorBookFor` (existing), and the `VendorBookPage pendingSheet` prop
  (Task 4).
- Produces: an `ImportRouter` prop `onSheogaSheet(file, parsed)`.

- [ ] **Step 1: Read and route accessory files.** In `readRow`, after
  reading xlsx sheets, if `isSheogaAccessorySheet(parsed.sheets)` return:
  - `{ file, sheoga: parseAccessorySheet(parsed.sheets), target: SHEOGA_SHEET, reason: "Sheoga accessory sheet → Sheoga Hardwood" }`,
    where `SHEOGA_SHEET = "__sheoga_acc__"`;
  - with no Sheoga vendor book instead:
    `{ file, error: "Sheoga accessory sheet — create the Sheoga vendor book first" }`.

- [ ] **Step 2: Keep accessory rows out of the item import.**
  - Accessory rows render with the reason text and no book select.
  - `flat` excludes `target === SHEOGA_SHEET`.
  - On run, call `onSheogaSheet(row.file, row.sheoga)` for each such row.
    If `runnable` is empty, close the router.
  - The library's handler sets `setSel(sheogaBook.id)` and
    `setPendingSheet({ fileName: file.name, parsed })`.

- [ ] **Step 3: Verify.**
  - Run `npm test` and `npm run build`. Expected: both pass.
  - Then add a Sheoga vendor book (`vendorBookSeed("sheoga", {})`, kind
    `vendor`) to `src/headerpreview.jsx`'s mock `books`. That harness mounts
    the REAL `PriceBookLibrary` with no Supabase.
  - Open `header-preview.html` and give the library's hidden drop input the
    fixture via Playwright `setInputFiles`.
  - Expected: one route row "Sheoga accessory sheet → Sheoga Hardwood", and
    Continue lands on the Sheoga book page showing the review ("First upload
    — 40 prices").

- [ ] **Step 4: Commit** — `git commit -am "price books: drop zone routes the Sheoga accessory sheet"`

### Task 4b: Texture priced from the sheet (owner amendment 2026-10-02)

> Inserted after Tasks 1–5 were built. Sheoga's updated 10/01/26 sheet adds
> a "Texture Charge" row (spec decision 6). This task reworks the
> already-built Tasks 1–4 code so texture comes only from the sheet.
> Untexturable pieces ship smooth with a note, and nothing ever blocks.
> Where this task contradicts Task 2–4 text above, this task wins.

**Files:**
- Replace: `src/testdata/sheoga-accessory-20261001.xlsx` with the updated
  edition
  (`/root/.claude/uploads/945756a5-7fa9-5119-8764-5caac5140b8e/4f2bc172-Sheoga_Accessory_Pricing_-_Distributor_-_20261001.xlsx`).
  Keep the first edition as `src/testdata/sheoga-accessory-20261001-notexture.xlsx`
  (`git mv` the old file first, then copy the new one in).
- Modify: `src/sheogatrim.js`, `src/sheogatrim.test.js`
- Modify: `src/vendorbook.js`, `src/vendorbook.test.js` (remove
  `normTrimTexture` and the `trimTexture` slot)
- Modify: `src/sheogasheets.jsx`, `src/vendorbook.jsx`,
  `src/vendorbookpreview.jsx` (remove the Textured input row and its Save;
  the table's "+ Textured" row reads the sheet)

**Interfaces (changes):**
- `AccSheet` gains `tex: { nose35, nose55, shoe, reducer, tmold }`, each
  `number | null`. Null means "Cannot Be Textured", a non-number cell, or no
  Texture Charge row at all. The row is optional, so its absence is never a
  problem.
- `TrimBook` becomes `{ sheet: AccSheet }`; `trimBookOf(books)` returns
  `{ sheet }` or null. `normTrimTexture` is deleted, and nothing reads
  `data.trimTexture`.
- `diffAccessorySheets` also lists texture changes, after prefin and before
  slip, labeled `"Textured — <short>"`. `from` / `to` may be `null` (shown
  as "—" / "can't be textured" in the review).
- `TrimBuild` drops `texBlocked`. Each line gains `textured: boolean` (the
  texture was applied to this line). `trimLineItems` never returns `[]` for
  texture reasons.

- [ ] **Step 1: Write the failing tests** (update the existing ones that
  assert the old behavior; delete the "texture blocks until priced" tests).
  - **Parser:**
    - `parse: reads the 10/01/26 sheet` additionally asserts that `tex`
      deep-equals `{ nose35: 2, nose55: 2, shoe: null, reducer: null, tmold: null }`.
    - New: `parse: a sheet without a Texture row` — the `-notexture` fixture
      gives `problems: []` and `tex` all null, with every other price equal to
      the main fixture's.
  - **Diff:** `diff: names texture changes` — clone with `tex.nose35 = 2.5` and
    `tex.shoe = 1` gives `[{ label: 'Textured — Nosing 3½"', from: 2, to: 2.5 }, { label: "Textured — Shoe mold", from: null, to: 1 }]`.
  - **Pricing** (`book = { sheet: parsed }`, `wo` as in Task 2, `tex: "sawcut"`):
    - nose35 run `{ n: 2, len: 6 }` → `lfCost: 10.26` (5.86 + 2.40 + 2.00),
      `unitCost: 61.56`, `textured: true`, a row
      `["Textured — Saw Cut", "+$2.00/lf"]`.
    - shoe `{ n: 15, len: 8 }` → `unitCost: 25.68`, `textured: false`, a row
      `["Smooth — can't be textured", ""]`. Its payload `brandColor` has no
      "Saw Cut".
    - tmold 2 and reducer 1 → smooth, the same note.
    - The nose35 payload `brandColor` ends `" · Saw Cut"`.
    - Slip with `tex: "sawcut"` → no texture row.
    - `trimLineItems` returns every line, and `calcTrim(...)` has no
      `texBlocked` key.
    - With the `-notexture` fixture, every line is `textured: false` with the
      note.
  - **Book:**
    - `trimBookOf` with `data.sheets.accessories = S` deep-equals `{ sheet: S }`.
    - `normTrimTexture` is no longer exported:
      `assert.equal(typeof vb.normTrimTexture, "undefined")` via
      `import * as vb`.

- [ ] **Step 2: Run `npm test`.** Expected: the new and changed tests FAIL.

- [ ] **Step 3: Implement.**
  - **Parser:** read the "Texture Charge" row like "Prefinished Charge": in
    each block's column, a positive number becomes the rate, anything else
    null. It looks in the rows after "Prefinished Charge" within the block
    and stops at the next non-blank label.
  - **Pricing:** `lfCost = round2(species + (prefin ? prefin[p] : 0) + (textured && sheet.tex[p] != null ? sheet.tex[p] : 0))`.
    `finishText` per line carries the texture only when that line is
    textured.
  - **Book page:**
    - The "+ Textured" row is read-only from `sheet.tex`, with "—" and a
      `title="can't be textured"` for null, and highlighted in the replace
      diff.
    - Remove the inputs, their Save, and the `normTrimTexture` import.
    - The harness `?sheet=replace` should also change one texture value so
      the highlight shows.

- [ ] **Step 4: Verify.**
  - Run `npm test`. Expected: all pass.
  - Run `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=x npm run build`.
    Expected: succeeds.
  - In the harness `vendor-book-preview.html?book=1&sheet=1`, the review
    shows the Texture row (2.00 / 2.00 / — / — / —), and no texture inputs
    remain. Screenshot it to the scratchpad.

- [ ] **Step 5: Commit** — `git commit -am "sheoga trim: texture priced from the sheet; untexturable pieces ship smooth"` (add the moved fixture).

### Task 6: Configurator Trim & accessories tab

**Files:**
- Create: `src/SheogaTrim.jsx` (`TrimRail`, `TrimCard`, `TrimEmpty`)
- Modify: `src/SheogaConfigurator.jsx`:
  - props `trimBook`, `trimMarkupDefault`;
  - a `trimMarkup` state beside `ventMarkup`;
  - `activeMarkup` covers `mode === "trim"`;
  - the rail/card/mobile branches;
  - the `basketEntryView` and `placedView` trim branches;
  - `pickMode` leaves `floorSrc` alone on trim;
  - the job size input is hidden on trim (count lines).
- Modify: `src/App.jsx:3047-3050` and `:2856-2857`, and
  `src/AppsWorkspace.jsx:127-131` (pass `trimBook={trimBookOf(books)}` and
  `trimMarkupDefault={sheogaMarkups(books, settings).trimMarkupPct}`).
- Modify: `src/sheogapreview.jsx`. Fetch and parse the fixture into a
  `trimBook`, and pass it. `?tab=trim` opens on the tab: seed a
  `{ mode: "trim", cfg }`, or use a new `initialMode` prop if the seed path
  would turn Match off.

**Interfaces:**
- Consumes: `calcTrim`, `trimLineItems`, `trimFromFloor`,
  `effectiveTrimCfg`, `TRIM_PROFILES`, `TRIM_LENGTHS`, `TRIM_SPECIES`
  (Task 2); `trimBookOf`, `sheogaMarkups().trimMarkupPct` (Task 3).
- Produces: nothing downstream.

- [ ] **Step 1: The rail (`TrimRail`).** Built to the mockup
  (`.scratch/mockups/sheoga-accessories-2026-10-02/mock.jsx`, `AccessoryTab`
  rail) with the real primitives:
  - **Match banner:** the Pick my own / Match floor button. While matching,
    show chips of the effective values from `trimFromFloor(lastFloorSnap)`;
    `lastFloorSnap = { mode: floorSrc, cfg: cfgs[floorSrc] }`.
  - **Pickers:** Species chips; Finish Seg; Stain (the STAIN_COLORS +
    Custom…); Sheen (SHEENS + Custom…); Texture (TEXTURES). All locked
    while matching.
  - **Texture notes (amended by Task 4b):** when the build is textured,
    each untexturable piece row shows a muted "smooth — can't be textured".
    Texturable rows show their sell including the texture charge. There is
    no blocking and no Ship smooth button.
  - **Pieces box:**
    - three run rows: n input, a length MorphSelect ("3' pieces" … "12'
      pieces", "Random lengths"), "= N lf", a per-piece sell, ×, and
      "+ another length";
    - two 8'-piece rows showing "$X/8' pc";
    - a slip-tongue row showing "$X/bdl".
  - The sell shown is `tsell(unitCost)` (the tier lens).

- [ ] **Step 2: The card (`TrimCard`).**
  - Header: "Sheoga trim — {sp}" · "accessory sheet · {Mon ’YY}".
  - One block per `TrimBuild.lines` entry.
  - Footer: cost → +markup% → sell, and a line count.
  - Buttons **Add to basket** and **Add N product line(s)**, disabled when
    there are no lines.
  - Add → `onAdd(trimLineItems(effectiveTrimCfg(cfg, lastFloorSnap), trimBook, trimMarkup), snap)`.
  - The basket stages `{ kind: "single", snap: { mode: "trim", cfg: effectiveTrimCfg(...) }, markupPct: trimMarkup, sf: 0 }`.
  - `basketEntryView` for trim prices via `calcTrim(entry.snap.cfg, trimBook)`.
    Title "Sheoga trim — {sp}", meta "{n} lines". `lines()` →
    `trimLineItems(...)`. "Sheet not uploaded" with price 0 when null.

- [ ] **Step 3: Empty and mobile states.**
  - **`TrimEmpty`:** `trimBook == null` shows "Upload Sheoga's accessory
    sheet on the Sheoga price book (Price books → Sheoga Hardwood → Price
    sheets)".
  - **Mobile:** the price bar shows "{n} trim lines · {sp}" and the total
    sell; `TrimCard` goes in `MobileBuildSheet`. The Grid button is hidden.
  - **Reopen:** a seed `{ mode: "trim", cfg }` opens with `match: false`
    (the stored cfg already carries it).

- [ ] **Step 4: Verify.**
  - Run `npm test` and `npm run build`. Expected: both pass.
  - Harness checks, at `sheoga-preview.html?tab=trim` at 1440×900 and
    390×844:
    - the match state with a textured floor (set the floor tab to Saw Cut
      first) shows textured nosing (+$2.00/lf) and smooth shoe, reducer and
      T-mold with the "can't be textured" note;
    - Add lands N rows on the harness area;
    - Reconfigure on the anchor reopens with the same pieces and Match off;
    - Remove deletes all of the kit's rows.

- [ ] **Step 5: Commit** — `git commit -am "sheoga configurator: Trim & accessories tab"` (add the new file).

### Task 7: Records, proof, and PR

**Files:**
- Create: `docs/adr/0056-sheoga-book-holds-uploaded-accessory-sheet.md`
  (amends ADR 0040's "never imports"; records owner decisions 1–5 from the
  spec)
- Modify:
  - `docs/adr/README.md` (index line);
  - `docs/adr/0040-vendor-kind-price-book.md` (an "Amended by 0056" line);
  - `.claude/skills/floortrack-data-model/SKILL.md` (vendor-book `data`
    gains `sheets.accessories` (incl. `tex`), `markups.trim`; Product
    `sheoga` gains `{ mode: "trim", cfg }` anchors and
    `{ mode: "trim", part: true }` companions);
  - `src/CLAUDE.md` (entries for `sheogatrim.js`, `SheogaTrim.jsx`,
    `sheogasheets.jsx`; update the `vendorbook.js`/`vendorbook.jsx`/
    `SheogaConfigurator.jsx` notes);
  - `.scratch/` issue folder `167_sheoga-trim-accessories/` (ticket +
    `Status: done` + proof shots), numbered after the highest existing
    `.scratch/NNN_` directory.

- [ ] **Step 1: Write the ADR and doc updates.**

- [ ] **Step 2: Capture the proof screenshots** with Playwright
  (`/opt/node-tools/node_modules/playwright`) into the issue folder:
  1. the trim tab matching a textured floor (textured nosing, smooth shoe,
     reducer and T-mold with notes);
  2. the same tab unfinished / smooth;
  3. Pick my own;
  4. phone width;
  5. the book review with diffs (replace using a fixture clone edited in
     the harness);
  6. a parse failure;
  7. the stored sheet with the sheet's read-only Textured row;
  8. the Markup tab.

- [ ] **Step 3: Final verification.** Run `npm test` and `npm run build`.
  Expected: all tests pass and the build succeeds. Paste both outputs'
  summary lines into the PR body.

- [ ] **Step 4: Commit, push, and open the PR.**
  - `git push -u origin claude/stoic-fermi-isi2ga`.
  - Open a PR to `main` with the template if present, the screenshots, and
    "No SQL to run".
  - Subscribe to PR activity.
