# Shower Line Descriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every wedi and Schluter line a configurator lands carries its measure in the Size field and a clean brand-led (wedi) or brand-free (Schluter) name in the Product field, and the print shows such a row as one dark `size name` line with a muted, never-split `SKU n` tail.

**Architecture:** Each engine derives `{ size, name }` from the classified catalog entry in one place (wedi `makeEntry`, Schluter `catalogOf`), so popups, Compare, basket, landed rows and order copy all read the same text. `lineItems` lands those two fields; nothing rewrites saved rows. The print recognizes a row by its `wedi` / `schluter` marker and swaps the standard name + spec line for the brand-row treatment.

**Tech Stack:** React 18 + Vite 5, `node --test` (`npm test`), Playwright (`/opt/node22/lib/node_modules/playwright`, chromium at `/opt/pw-browsers/chromium`) for preview proof.

**Spec:** `docs/superpowers/specs/2026-10-01-shower-line-descriptions-design.md`

## Global Constraints

- Size spelling: `x` between dimensions, `'` and `"` marks, mixed numbers hyphenated (`1-37/64"`), no spaces inside a size; a side that is a whole number of feet reads in feet (`3'`), any other side in inches (`38"`, `32"`); thickness last.
- Product spelling: wedi rows start `wedi ` (lowercase); Schluter rows carry no brand word; no `—`/`-` separators, no `®`/`™`, no "Fundo"; a qualifier follows a comma (`, Offset Drain`, `, 108 sf`, `, 2 per bag`).
- Saved rows are never rewritten (`normP`, `normA`, `normC` untouched).
- The print prints a brand row's `sizeText` verbatim (never `tightSize`).
- `main` is never pushed to; every change lands through a PR; UI/print changes carry preview proof (CLAUDE.md non-negotiables).
- No comments explaining what the code says; keep the existing file-level comment style.

## Review Focus

1. A wedi part with no dimensions and no pack quantity (a putty knife) must land an empty Size field and a clean name, never `undefined` or the word "Wedi" twice. → Task 2 test.
2. A special-order wedi line (not stocked, `sku` empty) must still print its US part number in the SKU slot, and `rowItemKey` must still resolve legacy `wedi US… —` rows. → Task 2 and Task 6 tests.
3. A Schluter code the grammar sizes but whose book description is empty (a bare EFT row) must still land a full name from the code alone. → Task 4 test.
4. A Settings mortar line in a Schluter build (no classifier group) must land its own name unchanged, no brand word added or removed. → Task 4 test.
5. A hand-typed misc row with a wedi-looking name but no marker must print exactly as today (standard name + spec line). → Task 6 test.

---

### Task 1: wedi entry naming — `name` and `sizeText` per the rule

**Files:**
- Modify: `src/wedi.js:3961-3982` (add `measure`, `ftIn`, `sizeOf` beside `inch`/`ftLbl`), `src/wedi.js:4184-4330` (`makeEntry`)
- Test: `src/wedi.test.js:195-220` (replace the existing name assertions)

**Interfaces:**
- Consumes: `item(key)` (wedi.js:4415), `inch(n)`, `classify`, `FIN_SHORT`, `SDRY_COVER_NAMES`, `contentOf`, `cleanDesc`.
- Produces: every catalog entry `e` has `e.name` (Product text without the `wedi ` lead) and `e.sizeText` (Size text, `""` when none). Exported `sizeOf(w, d, t)` → string (`sizeOf(36, 60, 0.5)` = `3'x5'x1/2"`, `sizeOf(38, 64, null)` = `38"x64"`, `sizeOf(32, 66.75, null)` = `32"x66-3/4"`).

- [ ] **Step 1: Replace the name assertions in `src/wedi.test.js` with the new pairs**

```js
test("wedi entry text: size in sizeText, brand-free name, per the 2026-10-01 rule", () => {
  const t = (key, size, name) => assert.deepEqual([item(key).sizeText, item(key).name], [size, name], key);
  t("US9100004", "3'x5'x1-37/64\"", "Shower Base");
  t("US9100005", "3'x6'x1-37/64\"", "Shower Base, Offset Drain");
  t("1504159", "42\"x42\"x1-37/64\"", "Shower Base");
  t("US9200007", "3'x5'x1-1/8\"", "Curbless Shower Base, Offset Drain");
  t("US9310001", "3'x5'x1-37/64\"", "Linear Shower Base");
  t("1518075", "38\"x64\"", "S-Dry Shower Base");
  t("US8000014", "4'x5'x1/2\"", "Building Panel");
  t("US8000032", "32\"x4'x1/2\"", "Building Panel");
  t("US8000026", "4'x8'x1/2\"", "Vapor 85 Building Panel");
  t("US4000001", "", "Tub & Shower Wall Kit");
  t("US3000038", "60\"", "Lean Curb");
  t("US1000057", "4\"x4\"", "Stainless Drain Cover");
  t("676797048", "27\"", "Stainless Linear Drain Cover");
  t("1504179", "32\"x5-3/4\"", "Linear Shower Module");
  t("US9330001", "32\"x66-3/4\"", "Linear Shower Extension");
  t("073783528", "24\"x48\"", "Shower Extension");
  t("US5000070", "100 ct", "Fastener Kit, Screws & Washers with Tabs");
  t("US5000010", "20 oz", "Joint Sealant Sausage");
  t("US5000013", "10.5 oz", "Joint Sealant Tube");
  t("US5076012", "25 lb", "Pro-Set Tile Adhesive");
  t("US5000000", "", "Subliner Dry Mixing Valve Seal");
  t("US5000044", "", "Corner Putty Knife");
  t("US5000001", "39\"x16'", "Subliner Dry Roll, 53 sf");
  t("US5076001", "72\"", "S-Dry Curb");
  t("US1076002", "", "S-Dry Stainless Drain Cover");
  t("US5076009", "50\"x25'", "S-Dry Membrane, 104 sf");
  t("US5076002", "", "S-Dry Inside Corner, 2 per bag");
  t("US5076006", "", "S-Dry Pipe Collar");
  t("US5076011", "", "S-Dry Seal");
  t("US5076010", "3/16\"x5/32\"", "S-Dry Seal Trowel");
});
```

Keep the test's catalog source as the surrounding tests use it (the transcribed `WEDI_STOCK`/`WEDI_SO` default); if a key above is not in that source, resolve it the way `item()` does by shop number instead. The 1504159 pan is the off-foot 42×42 base the old test called "3'6\"x3'6\"".

- [ ] **Step 2: Run it to see it fail**

Run: `node --test src/wedi.test.js 2>&1 | grep -A3 "entry text"`
Expected: FAIL (today's names carry the size and the finish after a dash).

- [ ] **Step 3: Implement `measure(n)`, `ftIn(n)`, `sizeOf(w, d, t)` in `src/wedi.js` beside `inch`**

`measure(n)` = `inch(n)` with its one space turned into a hyphen. `ftIn(n)` = whole feet → `${n/12}'`, else `${measure(n)}"`. `sizeOf(w, d, t)` = `[ftIn(w), ftIn(d)]` (smaller side first for panels, as today's `e.name` ordered them; bases keep `w`×`d`) joined by `x`, plus `x${measure(t)}"` when `t` is a number.

- [ ] **Step 4: Rewrite the naming branches of `makeEntry` so `e.sizeText` and `e.name` follow the spec rules**

Per group: `pan` → `sizeOf(w, d, t)` + family word + `, Offset Drain`; `panel` → `sizeOf` + "Building Panel"/"Vapor 85 Building Panel" (kits keep their cleaned name, empty size); `module`/`modExt`/`extension`/`cornerExt`/`ramp` → both dims via `sizeOf(a, b, null)`; `cover`/`coverFrame` → length or `4"x4"` in size, finish word (`FIN_SHORT`) before "Drain Cover"/"Linear Drain Cover"; `curb` → the length in size, name from the `CURBS` label with the length and "Full"/"Foam AT" words removed to "Lean Curb"/"Full Foam Curb"/"Curb Cap"; `niche` → outer `w"xd"` in size, "Shower Niche"/"Cathedral Shower Niche"; `subliner`/`sdry` rolls → roll size in size, `, N sf` qualifier when `sf` parsed; sealant/adhesive/fastener → the pack quantity (`20 oz`, `10.5 oz`, `25 lb`, `100 ct`) in size, the pricelist's content words after a comma only for the fastener kit; everything else → `cleanName(x)`: strip `wedi`/`Wedi`, `®`, `™`, `Fundo`, dash separators, `2 per/bg` → `, 2 per bag`, collapse spaces. `SDRY_COVER_NAMES` covers become `S-Dry ${finish} Drain Cover`.

- [ ] **Step 5: Run the wedi tests**

Run: `node --test src/wedi.test.js src/wediadapter.test.js src/wedisdry.test.js src/wediequivalence.test.js src/wedimarkergolden.test.js src/wallsysgolden.test.js src/kitlabel.test.js 2>&1 | tail -8`
Expected: all pass. The golden tests compare quantities and keys, not names. If a `kitlabel.test.js` case asserts on a wedi name that no longer exists in the catalog, update its input string, not `kitlabel.js`.

- [ ] **Step 6: Commit**

```bash
git add src/wedi.js src/wedi.test.js
git commit -m "wedi: catalog entries carry a size field and a brand-free name (spec 2026-10-01)"
```

---

### Task 2: wedi landing — `lineItems` writes size and `wedi `-led name, no dashes

**Files:**
- Modify: `src/wedi.js:6516-6545` (`lineItems`), `src/wedi.js` `orderCopyLines` (grep `export function orderCopyLines`)
- Test: `src/wedi.test.js:865-880` (the "line payloads" test) + one new table test

**Interfaces:**
- Consumes: Task 1's `e.name` / `e.sizeText`; `kitFor`, `solve`, `lineItems`, `rowItemKey`.
- Produces: `lineItems(build, opts)` rows with `brandColor: "wedi " + e.name`, `sizeText: e.sizeText`; a non-stock line has `sku: ""` and no name lead; the marker still carries `key`/`part`.

- [ ] **Step 1: Add the table test and amend the payload test**

```js
test("wedi landed rows: Size field + 'wedi ' name, the 2026-10-01 table", () => {
  const rows = (o, extra) => lineItems(kitFor(o.pan.key, { option: o, room: o.room, mode: "custom", ...extra }));
  const by = (list, sku) => list.find((r) => r.sku === sku);
  const point = rows(solve({ w: 36, d: 60, curb: "curbed", drain: "any" })[0]);
  assert.deepEqual([by(point, "1504156").sizeText, by(point, "1504156").brandColor], ["3'x5'x1-37/64\"", "wedi Shower Base"]);
  assert.deepEqual([by(point, "47700").sizeText, by(point, "47700").brandColor], ["3'x5'x1/2\"", "wedi Building Panel"]);
  assert.deepEqual([by(point, "29118").sizeText, by(point, "29118").brandColor], ["60\"", "wedi Lean Curb"]);
  assert.deepEqual([by(point, "1504181").sizeText, by(point, "1504181").brandColor], ["4\"x4\"", "wedi Stainless Drain Cover"]);
  assert.deepEqual([by(point, "28960").sizeText, by(point, "28960").brandColor], ["100 ct", "wedi Fastener Kit, Screws & Washers with Tabs"]);
  assert.deepEqual([by(point, "29647").sizeText, by(point, "29647").brandColor], ["20 oz", "wedi Joint Sealant Sausage"]);
  assert.deepEqual([by(point, "47822").sizeText, by(point, "47822").brandColor], ["", "wedi Corner Putty Knife"]);
  assert.deepEqual([by(point, "1518109").sizeText, by(point, "1518109").brandColor], ["25 lb", "wedi Pro-Set Tile Adhesive"]);
  const linear = rows(solve({ w: 32, d: 72, curb: "curbed", drain: "linear" })[0]);
  assert.deepEqual([by(linear, "29075").sizeText, by(linear, "29075").brandColor], ["32\"x66-3/4\"", "wedi Linear Shower Extension"]);
  assert.deepEqual([by(linear, "28955").sizeText, by(linear, "28955").brandColor], ["27\"", "wedi Stainless Linear Drain Cover"]);
  const sdry = rows(solve({ w: 60, d: 36, system: "sdry" })[0], { wallSys: "membrane" });
  assert.deepEqual([by(sdry, "1518075").sizeText, by(sdry, "1518075").brandColor], ["38\"x64\"", "wedi S-Dry Shower Base"]);
  assert.deepEqual([by(sdry, "1518096").sizeText, by(sdry, "1518096").brandColor], ["50\"x25'", "wedi S-Dry Membrane, 104 sf"]);
  assert.deepEqual([by(sdry, "1518089").sizeText, by(sdry, "1518089").brandColor], ["", "wedi S-Dry Inside Corner, 2 per bag"]);
  assert.ok(point.concat(linear, sdry).every((r) => !/[—®™]|\bFundo\b|wedi.*\bwedi\b/i.test(r.brandColor) && r.sizeText !== undefined));
  // a special-order line: no shop sku, no lead, the US number stays on the marker
  const so = point.concat(linear, sdry).find((r) => r.sku === "");
  if (so) { assert.ok(/^wedi [A-Z]/.test(so.brandColor)); assert.ok(/^US\d+$/.test(so.wedi.part || so.wedi.key)); }
});
```

Amend the existing payload test's `so.every((r) => /^wedi US/.test(r.brandColor))` to `so.every((r) => /^wedi [^U]/.test(r.brandColor) && /^US\d+$/.test(r.wedi.part || r.wedi.key))`.

- [ ] **Step 2: Run it to see it fail**

Run: `node --test src/wedi.test.js 2>&1 | grep -B2 -A6 "landed rows"`
Expected: FAIL on the `wedi — ` lead.

- [ ] **Step 3: Change `lineItems` and `orderCopyLines` in `src/wedi.js`**

`lineItems`: `brandColor: "wedi " + e.name`, `sizeText: e.sizeText || ""`; delete the `lead` expression. `orderCopyLines`' description branch: `[e.sizeText, "wedi " + e.name].filter(Boolean).join(" ")`. Leave `rowItemKey`'s legacy `/^wedi (US\d+) —/` regex in place.

- [ ] **Step 4: Run the wedi tests**

Run: `node --test src/wedi.test.js src/usejobshowers.test.js src/compareset.test.js src/comparekit.test.js src/compareprint.test.js 2>&1 | tail -6`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/wedi.js src/wedi.test.js
git commit -m "wedi: landed rows read size · wedi name · SKU, no dashes (spec 2026-10-01)"
```

---

### Task 3: Schluter grammar additions — drain pipe size and material, niche size, corner count

**Files:**
- Modify: `src/schluter.js:245-330` (`classifyCode`: the `KD`, `KERECK`, `KB12SN` branches)
- Test: `src/schluteradapter.test.js` (new test at the end)

**Interfaces:**
- Consumes: `classify(item)`, `mmExactTokens`, `MM_IN`.
- Produces: point drains carry `pipe` (2 | 3 | 4) and `material` ("PVC" | "ABS" | "Stainless" | "Brushed Stainless" | ""); `KERECK` corners carry `ct` (number); niches carry `w`, `d` (inches) and `size` (`12"x28"`).

- [ ] **Step 1: Write the failing test**

```js
test("grammar additions (2026-10-01): point-drain pipe + material, corner count, niche size", () => {
  const c = (sku) => classify({ sku, name: "" });
  assert.deepEqual([c("KD2FLKPVC").pipe, c("KD2FLKPVC").material], [2, "PVC"]);
  assert.deepEqual([c("KD3FLKE").pipe, c("KD3FLKE").material], [3, "Stainless"]);
  assert.deepEqual([c("KD4GRKE").pipe, c("KD4GRKE").material, c("KD4GRKE").part], [4, "Stainless", "grate"]);
  assert.equal(c("KD2ABSEKIT").material, "ABS");
  assert.equal(c("KERECK/FI10").ct, 10);
  assert.equal(c("KERECK/FA2").ct, 2);
  assert.deepEqual([c("KB12SN305711A1").w, c("KB12SN305711A1").d, c("KB12SN305711A1").size], [12, 28, '12"x28"']);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test src/schluteradapter.test.js 2>&1 | grep -A4 "grammar additions"`
Expected: FAIL (`pipe` undefined).

- [ ] **Step 3: Extend the three branches in `classifyCode`**

`KD`: `pipe` from the digit after `KD` (`/^KD\w*?(\d)/` → 2/3/4), `material` from the suffix letters: `PVC` → "PVC", `ABS` → "ABS", `EB` → "Brushed Stainless", `E` → "Stainless", else `""`. `KERECK`: `ct` from the digits after `/FI` or `/FA`. `KB12SN`: `mmExactTokens` on the digits after `KB12SN` → `w`, `d` (smaller first) and `size`.

- [ ] **Step 4: Run the Schluter tests**

Run: `node --test src/schluteradapter.test.js src/schluter.test.js src/schluterquery.test.js 2>&1 | tail -6`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/schluter.js src/schluteradapter.test.js
git commit -m "schluter: grammar reads drain pipe size and material, corner count, niche size"
```

---

### Task 4: Schluter entry text — `partText(e)` derived from the code; `lineItems` lands it

**Files:**
- Modify: `src/schluter.js:392-394` (`catalogOf`), `src/schluter.js:1478` (`brandName`, delete), `src/schluter.js:1486-1491` (`orderCopyLines`), `src/schluter.js:1506-1525` (`lineItems`), `src/schluter.js:1257-1262` (`pointGrateLabel`: read `e.desc` not `e.name`)
- Test: `src/schluter.test.js:460-481` (the `lineItems` test) + one new table test

**Interfaces:**
- Consumes: Task 3's fields; `classify`, `THICK_IN`, `VARIO_DESIGN`, `FINISH_LABEL`, `curbLen`, `bandLf`, `membraneSf`, `boardDims`.
- Produces: `export function partText(e)` → `{ size: string, name: string }` for a classified entry (brand-free). `catalogOf(items)` returns entries with `desc` = the book's raw name, `name` = `partText(e).name`, `size` = `partText(e).size`. `lineItems` lands `brandColor: e.name` (`e.name` unchanged for a line with no `g`), `sizeText: e.size || ""`.

- [ ] **Step 1: Write the table test over the two book shapes**

```js
test("Schluter landed rows: Size field + brand-free name, the 2026-10-01 table", () => {
  const row = (sku, description, size = "", vendorSkus) => normOrderItem({ bookId: "bk", sku, description, size, vendorSkus, price: 10, cost: 7 });
  const stock = [
    row("1509821", "KERDI-SHOWER-T TRAY 38 X 60 PVC", "", ["KST965/1525"]),
    row("1509762", "KERDI-DRAIN flange kit 2\" PVC", "", ["KD2FLKPVC"]),
    row("1509800", "Kerdi Drain Flange Kit - KD3FLKE Stainless", "", ["KD3FLKE"]),
    row("1509763", "KERDI-DRAIN grate 4\" stainless", "", ["KD4GRKE"]),
    row("1509783", "KERDI MEMBRANE ROLL", "3'3\"×33' = 108 sf", ["KERDI200/10M"]),
    row("1509779", "KERDI-BAND 5\" seam band", "32'10\" roll", ["KEBA100/125/10M"]),
    row("1509790", "90 Kerdi Kereck F Inside - KERECK/FI10 10/pk", "", ["KERECK/FI10"]),
    row("1509757", "KERDI-BOARD-SC curb 60\"", "6\"×4½\"×60\"", ["KBSC1151501524"]),
    row("1509749", "KERDI-BOARD 1/2\" panel", "48\"×96\" = 32 sf", ["KB1212202440"]),
    row("1509759", "KERDI-BOARD screws + washers", "100 ct", ["KBZS35GT32Z100"]),
    row("1509751", "", "", ["KB12SN305711A1"]),
    row("23051", "Schluter ALL-SET modified thin-set", "50 lb bag", ["SLRSETA50W"]),
  ];
  const eft = [row("SLRKSLT9151830S", "KERDI-SHOWER-LTS TRAY 36X72 PERIMETER DRAIN 36 INCH SIDE"), row("SLRKST965BF", "Schluter Kerdi-Shower-TT Tray Center Drain Placement", "38x38"), row("SLRKBSB410TA", "Schluter Kerdi-Board-SB Bench Triangular", "16\"x16\"x20\"")];
  const cat = catalogOf([...adaptBookRows(stock, { stock: true }), ...adaptBookRows(eft, { stock: false })]);
  const t = (code, size, name) => { const e = cat.find((x) => x.sku === code); assert.deepEqual([e.size, e.name], [size, name], code); };
  t("KST965/1525", '38"x60"', "KERDI-SHOWER-T Tray");
  t("SLRKSLT9151830S", '36"x72"', 'KERDI-SHOWER-LTS Tray, Linear Drain on 36" Side');
  t("SLRKST965BF", '38"x38"', "KERDI-SHOWER-TT Tray, Curbless");
  t("KD2FLKPVC", '2"', "KERDI-DRAIN Flange Kit, PVC");
  t("KD3FLKE", '3"', "KERDI-DRAIN Flange Kit, Stainless");
  t("KD4GRKE", '4"', "KERDI-DRAIN Grate, Stainless");
  t("KERDI200/10M", "3'3\"x33'", "KERDI Membrane, 108 sf");
  t("KEBA100/125/10M", "5\"x33'", "KERDI-BAND");
  t("KERECK/FI10", "10 ct", "KERDI-KERECK-F Inside Corner");
  t("KBSC1151501524", '60"x6"x4-1/2"', "KERDI-BOARD-SC Curb");
  t("KB1212202440", '48"x96"x1/2"', "KERDI-BOARD Panel");
  t("KBZS35GT32Z100", "100 ct", "KERDI-BOARD Screws & Washers");
  t("KB12SN305711A1", '12"x28"', "KERDI-BOARD-SN Niche");
  t("SLRKBSB410TA", '16"x16"x20"', "KERDI-BOARD-SB Bench, Triangular");
  t("SLRSETA50W", "50 lb", "ALL-SET Thin-set");
  assert.ok(cat.every((e) => !/schluter|—|®/i.test(e.name) && typeof e.desc === "string"));
  // landed: brandColor is the name, sizeText the size; a Settings mortar line keeps its own name
  const c = { w: 60, d: 38, curbed: true, drain: "point", wallSys: "membrane", walls: [{ on: true, len: 60, h: 84 }, { on: true, len: 38, h: 84 }, { on: true, len: 38, h: 84 }] };
  const rows = lineItems({ ...buildKit(c, cat, { source: "all" }), mode: "kit", cfg: c }, {});
  const tray = rows.find((r) => r.sku === "1509821");
  assert.deepEqual([tray.sizeText, tray.brandColor], ['38"x60"', "KERDI-SHOWER-T Tray"]);
  const mortar = { name: "60 lb deck mud", price: 12, cost: 12, stock: true, sfPerBagAt15: 8 };
  assert.equal(lineItems({ lines: [{ item: mortar, qty: 4 }], cfg: c }, {})[0].brandColor, "60 lb deck mud");
});
```

Import `normOrderItem` from `./orderbook.js` and `adaptBookRows` from `./schluteradapter.js` at the top of `schluter.test.js` if not already there. Stock rows pass the shop number as `sku` and the mfg code in `vendorSkus`; EFT rows pass the dealer's `SLR`-prefixed code as `sku` with no `vendorSkus` (the two shapes `schluteradapter.test.js` pins). `adaptRow` keeps the `SLR` prefix on an EFT entry's `sku`, so the lookups above use it. Replace the old `lineItems` test's `brandColor` assertions (lines 473–481) with: every row's `brandColor` has no `Schluter — ` lead, the grate line reads `KERDI-DRAIN Grate, Stainless`, and the mortar line is unchanged.

- [ ] **Step 2: Run it to see it fail**

Run: `node --test src/schluter.test.js 2>&1 | grep -B2 -A8 "landed rows"`
Expected: FAIL (`e.size` undefined / name is the book text).

- [ ] **Step 3: Implement `partText(e)` in `src/schluter.js` and wire it**

`partText(e)` by `e.g`: `tray` → size `${w}"x${d}"`, name "KERDI-SHOWER-T Tray" (point, no `thin`), "-TS … , Offset Drain" (offset), "-TT … , Curbless" (`thin`), "-LTS Tray, Linear Drain on N" Side" (linear, N = `w`); `drain` point → size `${pipe}"`, name `KERDI-DRAIN ${part === "grate" ? "Grate" : "Flange Kit"}` + `, ${material}`; `drain` linear channel → size `${len/12}'`, name `KERDI-LINE-VARIO Channel, ${VARIO_DESIGN[design]}, ${FINISH_LABEL[finish]}`; linear flange → size `2"`, "KERDI-LINE-VARIO Flange Kit"; `membrane` → size `3'3"x${len}'` from `roll` (`5M` 16'5", `7M` 23', `10M` 33', `12M` 39'5", `20M` 65'7", `30M`/plain 98'5"), name `KERDI Membrane, ${sf} sf`; `seam` band → size `${width/25.4 rounded}"x${lf}'`, "KERDI-BAND"; corner → size `${ct} ct`, "KERDI-KERECK-F Inside Corner"/"Outside Corner"; seal → "KERDI-SEAL-MV Valve Seal"/"KERDI-SEAL-PS Pipe Seal"; `curb` → size from `e.size` normalized to the Global spelling (`60"x6"x4-1/2"`), "KERDI-BOARD-SC Curb" (ramp → "KERDI-SHOWER-R Ramp"); `board` panel → size `${bw}"x${bl}"x${THICK_IN[thickMm]}` (mixed numbers hyphenated), "KERDI-BOARD Panel"; fastener → `${ct} ct`, "KERDI-BOARD Screws & Washers"; `extra` niche → `size`, "KERDI-BOARD-SN Niche"; bench → size from `e.size`, "KERDI-BOARD-SB Bench, Triangular"/", Rectangular"; `set` → "50 lb" when the text says so, "ALL-SET Thin-set" / "KERDI-FIX Adhesive"; `line` → size from `len`, name from `part` and `STYLE_WORD`; anything else (`kit`, unknown) → fallback: the book description with the vendor code words, a leading "Schluter", `®` and dash separators dropped, `size` = `e.size`.
`catalogOf`: `items.map(classify).filter(Boolean).map((e) => { const t = partText(e); return { ...e, desc: e.name, name: t.name, size: t.size }; })`. `lineItems`: `brandColor: e.name`, `sizeText: e.size || ""`; delete `brandName`; `orderCopyLines`' description branch joins `[e.size, e.name]`. `pointGrateLabel` reads `e.desc || e.name`.

- [ ] **Step 4: Run every Schluter-touching test**

Run: `node --test src/schluter.test.js src/schluteradapter.test.js src/schluterkitview.test.js src/schluterdraw.test.js src/schluterquery.test.js src/compareset.test.js src/comparekit.test.js src/compareprint.test.js src/usejobshowers.test.js src/kitlabel.test.js 2>&1 | tail -6`
Expected: all pass. A test that matched a fixture name regex (e.g. `/floral/` on `e.name`) now reads `e.desc`; update the assertion, not the engine.

- [ ] **Step 5: Commit**

```bash
git add src/schluter.js src/schluter.test.js
git commit -m "schluter: entry text derives from the part code; landed rows read size · name · SKU"
```

---

### Task 5: Popup label — a size-free name with a size hint reads size first

**Files:**
- Test: `src/kitlabel.test.js` (one new test)
- Modify: `src/kitlabel.js` only if the test fails

**Interfaces:**
- Consumes: `kitLabel(name, hint)` (kitlabel.js:143).
- Produces: nothing new; pins that the popups keep reading right.

- [ ] **Step 1: Write the test**

```js
test("a size-free entry name labels from its size hint (2026-10-01 entries)", () => {
  assert.deepEqual(pick(kitLabel("Building Panel", "3'x5'x1/2\"")), { size: "36×60×½″", name: "Building Panel" });
  assert.deepEqual(pick(kitLabel("Shower Base, Offset Drain", "3'x5'x1-37/64\"")), { size: "36×60×1 37/64″", name: "Shower Base, Offset Drain" });
  assert.deepEqual(pick(kitLabel("KERDI-SHOWER-T Tray", '38"x60"')), { size: "38×60″", name: "Shower tray" });
  assert.deepEqual(pick(kitLabel("Joint Sealant Sausage", "20 oz")), { size: "", name: "Joint Sealant Sausage" });
});
```

`pick` = `({ size, name }) => ({ size, name })`. If the file already has a helper with that shape, reuse it. If the `1 37/64` rendering differs (`fmtIn` prints a 64th as `1 37/64`), take the actual `fmtIn` output and pin that.

- [ ] **Step 2: Run it**

Run: `node --test src/kitlabel.test.js 2>&1 | tail -5`
Expected: PASS without changes (`hintOf` handles a hyphenated mixed number via `NUM`'s `[ -]\d+\/\d+`). If "20 oz" returns a `unit` label instead of `""`, pin that output instead; if a hyphenated mixed number fails to parse, extend `NUM` in `kitlabel.js` and rerun.

- [ ] **Step 3: Commit**

```bash
git add src/kitlabel.test.js src/kitlabel.js
git commit -m "kitlabel: pin size-first labels for size-free entry names"
```

---

### Task 6: Print — brand rows read `size name` + muted `SKU n`; the SKU never splits

**Files:**
- Modify: `src/printcols.js:14-17` (`specLine` → add `specParts`), `src/printcols.js` (add `brandRow`), `src/EstimateColumns.jsx:96-115` (the product cell)
- Test: `src/printcols.test.js`

**Interfaces:**
- Consumes: `p.wedi` / `p.schluter` markers (`{ key }` on the anchor, `{ part }` on companions; legacy `{ part: true }`), `p.sizeText`, `p.brandColor`, `p.sku`.
- Produces: `export function brandRow(p)` → `{ lead: string, tail: string } | null`; `export function specParts(p, c)` → `string[]` (`[size, coverage, "SKU n"]` with empties removed; `specLine` = `specParts(...).join(" · ")`).

- [ ] **Step 1: Write the failing tests**

```js
test("brandRow: a wedi/Schluter marker prints size + name and a muted SKU or part number", () => {
  const w = { ...newProduct(), type: "misc", sizeText: "3'x5'x1/2\"", brandColor: "wedi Building Panel", sku: "47700", wedi: { part: "US8000017" } };
  assert.deepEqual(brandRow(w), { lead: "3'x5'x1/2\" wedi Building Panel", tail: "SKU 47700" });
  const so = { ...w, sku: "", wedi: { key: "US9100004", mode: "kit", cfg: {} } };
  assert.deepEqual(brandRow(so), { lead: "3'x5'x1/2\" wedi Building Panel", tail: "US9100004" });
  const s = { ...newProduct(), type: "misc", sizeText: '38"x60"', brandColor: "KERDI-SHOWER-T Tray", sku: "1509821", schluter: { part: "KST965/1525" } };
  assert.deepEqual(brandRow(s), { lead: '38"x60" KERDI-SHOWER-T Tray', tail: "SKU 1509821" });
  assert.deepEqual(brandRow({ ...w, sizeText: "" }), { lead: "wedi Building Panel", tail: "SKU 47700" });
  assert.deepEqual(brandRow({ ...so, wedi: { part: true } }), { lead: "3'x5'x1/2\" wedi Building Panel", tail: "" });
  // no marker → not a brand row, however wedi-looking the text
  assert.equal(brandRow({ ...newProduct(), type: "misc", brandColor: "wedi — 60\" Lean Curb", sku: "29118" }), null);
});

test("specParts: the SKU is its own part so the sheet can keep it on one line", () => {
  const tile = { ...newProduct(), type: "tile", L: "12", W: "24", thickness: "0.375", qtyType: "sqft", qty: "120", cartonSf: "11.6", cartonUnit: "CT", priceSqft: "10.92", sku: "1504065" };
  assert.deepEqual(specParts(tile, printProduct(tile, s)), ['12"×24"', "11.6 SF/ct", "SKU 1504065"]);
  assert.equal(specLine(tile, printProduct(tile, s)), '12"×24" · 11.6 SF/ct · SKU 1504065');
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test src/printcols.test.js 2>&1 | grep -B1 -A4 "brandRow\|specParts"`
Expected: FAIL (`brandRow`/`specParts` not exported).

- [ ] **Step 3: Implement `brandRow` and `specParts` in `src/printcols.js`**

`brandRow(p)`: `m = p.wedi || p.schluter`; return `null` unless `m` is an object. `lead` = `[p.sizeText, p.brandColor].map(trim).filter(Boolean).join(" ")`. `tail` = `p.sku ? "SKU " + p.sku : (typeof m.key === "string" && m.key) || (typeof m.part === "string" && m.part) || ""`. `specParts` returns the three strings filtered; `specLine` joins them with `" · "`.

- [ ] **Step 4: Render brand rows in `src/EstimateColumns.jsx`**

In the product-row renderer (lines 96–115): `const br = brandRow(p)`. When `br` is set, `name` = `br.lead` (dark, weight 800, no type suffix) and the spec node is `br.tail` rendered in a `<span style={{ color: MUTED, whiteSpace: "nowrap" }}>`. When `br` is null, render `specParts(p, c)` joined with `" · "` as today, except the `SKU …` part sits in its own `whiteSpace: "nowrap"` span. Keep `isOneLine` as is (a brand row has no material cells and no `q.sub`/`pr.sub` on a misc line, so it already lands on one line when short). `specialRow(p)`'s ◆ is unchanged.

- [ ] **Step 5: Run the print tests and the build**

Run: `node --test src/printcols.test.js src/print.test.js src/compareprint.test.js 2>&1 | tail -5 && npm run build 2>&1 | tail -3`
Expected: all pass; build clean.

- [ ] **Step 6: Commit**

```bash
git add src/printcols.js src/printcols.test.js src/EstimateColumns.jsx
git commit -m "print: wedi and Schluter rows read size · name with a muted no-split SKU"
```

---

### Task 7: Order entry — the composed description carries the size once

**Files:**
- Test: `src/descfit.test.js` or `src/orderentry.test.js` (whichever holds the `orderDescription` cases; one new test)
- Modify: `src/orderentry.js` only if the test fails

**Interfaces:**
- Consumes: `orderEntryRow(...)` / `orderDescription(r, limit)` (orderentry.js:181) as the existing tests call them.
- Produces: nothing new; pins `3'x5'x1/2" wedi Building Panel 47700`-shaped output.

- [ ] **Step 1: Write the test, modeled on the file's existing `orderDescription` case**

Row: `{ ...newProduct(), type: "misc", qtyType: "count", qty: "5", sizeText: "3'x5'x1/2\"", brandColor: "wedi Building Panel", sku: "47700", priceSqft: "54.66", wedi: { part: "US8000017" } }`. Assert the full-width description's `main` equals `3'x5'x1/2" wedi Building Panel 47700` (adjust the separator to what the file's other cases show, e.g. a `·` before the SKU), and that `1/2"` appears exactly once.

- [ ] **Step 2: Run it**

Run: `node --test src/descfit.test.js src/orderentry.test.js 2>&1 | tail -5`
Expected: PASS. If `sizeParts` turns `3'x5'x1/2"` into something else or drops it, fix `sizeParts` in `orderentry.js` so a brand row's `sizeText` passes through verbatim as one part, rerun, and keep the fix minimal.

- [ ] **Step 3: Commit**

```bash
git add src/descfit.test.js src/orderentry.test.js src/orderentry.js
git commit -m "order entry: pin a brand row's description reads size · name · SKU once"
```

---

### Task 8: Preview proof, records, and the full suite

**Files:**
- Modify: `.scratch/165_shower-line-descriptions/preview.jsx`, `shot.mjs`, `compare.mjs` (drop the `?names=stock` branch; shoot `after.png`/`after.pdf`; compose `before-after.png` from the committed `configurator.png` and the new `after.png`)
- Create: `.scratch/165_shower-line-descriptions/grid/vite.config.mjs`, `fakesupabase.js`, `preview.html`, `shot.mjs` (copied from `.scratch/164_selection-sheet-dynamic-columns/` and `.scratch/162_selection-sheet-columns/entry.jsx`; the seed's shower area holds `lineItems(kitFor("US9100004"))` rows and a Schluter `lineItems(buildKit(...))` over the Task 4 test rows, each spread over `newProduct()`), producing `grid-wedi-schluter.png` (the grid) and `print-narrow.png` (the print preview with the product column forced to 150px to show "SKU 28862" wrapping as a unit)
- Create: `docs/adr/0054-shower-rows-read-size-name-sku.md`
- Modify: `docs/adr/README.md` (append the 0054 row), `src/CLAUDE.md:929` (wedi.js note: entries carry `sizeText` + brand-free `name`, `lineItems` lands `wedi ` + name, the 2026-08-06 by-the-foot/inches-second-line rule superseded by ADR 0054), `src/CLAUDE.md:1801` (schluter.js: `partText`, `desc`), `src/CLAUDE.md:504` and `:153` (EstimateColumns/printcols: `brandRow`, `specParts`, the no-split SKU), `src/CLAUDE.md:1756` (kitlabel: hint-first for size-free names), `.scratch/165_shower-line-descriptions/ticket.md` (status → done, link the proof files), the spec's Status line → implemented

**Interfaces:**
- Consumes: everything above.
- Produces: the proof images reviewers look at before merge.

- [ ] **Step 1: Run the whole suite and lint**

Run: `npm test 2>&1 | tail -8 && npm run lint 2>&1 | tail -3`
Expected: `# fail 0` with the count above 2005; lint clean.

- [ ] **Step 2: Shoot the print proof**

Run: `(npx vite --port 5199 --strictPort > /dev/null 2>&1 &) ; sleep 6 ; node .scratch/165_shower-line-descriptions/shot.mjs && node .scratch/165_shower-line-descriptions/compare.mjs`
Expected: `after.png`, `after.pdf`, `before-after.png` written; the console echo of the paper shows `3'x5'x1-37/64" wedi Shower Base` and `38"x60" KERDI-SHOWER-T Tray`; open `before-after.png` and check the SKU tails are muted and every size leads its name.

- [ ] **Step 3: Shoot the grid proof**

Run: `pkill -f "vite --port 5199"; (npx vite --config .scratch/165_shower-line-descriptions/grid/vite.config.mjs > /dev/null 2>&1 &) ; sleep 6 ; node .scratch/165_shower-line-descriptions/grid/shot.mjs ; pkill -f "vite --config"`
Expected: `grid-wedi-schluter.png` shows the Size column filled on every landed row and Product free of sizes; `print-narrow.png` shows a wrapped row with "SKU 28862" intact on one line.

- [ ] **Step 4: Write ADR 0054 and update the records**

ADR 0054 in the 0053 format: Status Accepted, Date 2026-10-01, Scope wedi/Schluter engines + print, Related the spec. Decision: a wedi/Schluter row reads `size · name · SKU`, the Size field holds the measure, the engine derives the name from the part code (not the book's text), wedi rows lead with `wedi`, Schluter rows carry no brand word, the print's brand-row treatment is a deliberate exception to the standard product line. Considered: bake the size into the name (rejected: Size column unused); rename saved rows on load (rejected: quotes change under people); stock-book descriptions on landed rows (rejected: loses thickness and finish, see `.scratch/165/compare.png`). Consequences: the 2026-08-06 by-the-foot/inches-on-the-second-line names are superseded; saved rows keep their text until re-landed; search picks still land the stock description (out of scope). Then the README row, the `src/CLAUDE.md` notes, the ticket status, and the spec status.

- [ ] **Step 5: Commit**

```bash
git add .scratch/165_shower-line-descriptions docs/adr src/CLAUDE.md docs/superpowers/specs/2026-10-01-shower-line-descriptions-design.md
git commit -m "Shower line descriptions: preview proof, ADR 0054, src map notes"
```

- [ ] **Step 6: Push the branch and hand off**

Run: `git push -u origin claude/upbeat-cray-b98zs0`
Then follow the finishing-a-development-branch skill: open the PR against `main` with the two proof images linked in its body; never push to `main`.
