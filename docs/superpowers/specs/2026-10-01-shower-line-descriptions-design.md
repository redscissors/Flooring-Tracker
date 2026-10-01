# Shower line descriptions — wedi and Schluter rows read size · name · SKU — design

**Date:** 2026-10-01 · **Status:** implemented (ADR 0054; plan `docs/superpowers/plans/2026-10-01-shower-line-descriptions.md`)
· **Mockup of the problem:** `.scratch/165_shower-line-descriptions/compare.png`
(the same lines printed with configurator names and with stock-book names)
· **Supersedes:** the 2026-08-06 naming ask recorded in `wedi.js` (`makeEntry`:
bases and panels "by the foot, SKU and inches on the second line") — to be recorded
as an ADR with this change
· **Builds on:** ADR 0035 (kit landing), ADR 0037/0038 (wedi registry-driven),
ADR 0041 (Schluter EFT import), ADR 0052 (Compare set), spec 2026-09-30 (selection
sheet columns), `.scratch/160` (popup label: size first, brand words dropped)

## Problem

A wedi or Schluter part reads differently depending on how it reached the job:

- A **search pick** from the stock book lands the ERP description with the shop's
  own codes stripped ("Wedi Building Panel", size "4'x5'", thickness lost).
- The **wedi configurator** lands its own names: bases and panels by the foot with
  the inches on the muted second line ("wedi — 3'x5'x1/2" Building Panel ·
  36"×60"×1/2""), everything else the wedi price list's marketing name
  ("wedi® Subliner Dry Mixing Valve Seal"). Sizes sit in the name on some lines
  and in the Size field on others (the 60" Lean Curb has no size at all).
- The **Schluter configurator** lands whatever the imported book said, vendor code
  still inline ("Kerdi Drain Flange Kit - KD3FLKE Stainless"), so the same tray
  reads two ways depending on which book it came from.

The owner's read (2026-10-01): the lines are duplicative and confusing in the
project and on the print. Inches repeat the feet, brand marks repeat the brand,
dashes and ® clutter, and the size is not reliably in the Size field.

## Owner decisions (2026-10-01)

1. **Size lives in the Size field; the Product field carries no size.** The grid's
   Size column sits left of Product, so a row reads size first. (Not: bake the size
   into the name.)
2. **Product field pattern.** wedi: `wedi <Part>[, <qualifier>]`. Schluter:
   `<PRODUCT-LINE> <Part>[, <qualifier>]` with **no brand word** — "KERDI-SHOWER-T
   Tray", "ALL-SET Thin-set" are recognizable without "Schluter". No dashes as
   separators, no ® or ™, no "Fundo", no repeated "Wedi", a qualifier (finish,
   drain placement, pack count, coverage) goes after a comma.
3. **Measure first, everything the trade needs, nothing twice.** Panels keep their
   thickness (¼", ½" and 2" share a footprint). **Bases show their thickness.**
   **Extensions always show width and length.** Odd sizes read in inches
   (38"x64"), foot sizes in feet (3'x5'). A quantity-sold part puts its quantity in
   the Size field (100 ct, 20 oz, 25 lb, 10 ct).
4. **Print:** a wedi or Schluter row is one dark line, `size + name`, then `SKU n`
   in the muted color. That is all — no inches line, no coverage. `SKU` and its
   number never split across a line break (on every row, not just these).
5. **Old rows are untouched.** Rows already on saved projects keep their text until
   their kit is re-landed or reconfigured.
6. **Schluter gets the full cleanup in this same change**, not a later pass.

## The naming rule

### wedi

Every line the wedi configurator lands, across the six representative builds
(36×60 point, 32×72 linear, 36×60 curbless offset, 48×78 extend, 60×36 S-Dry
membrane, tube sealant + bench). Size is the Size field; Product is the Product
field. Blank size means the Size field is empty.

| SKU | Today (name · muted line) | Size | Product |
|---|---|---|---|
| 1504156 | wedi — 3'x5' Shower Base · 36"×60"×1 37/64" | 3'x5'x1-37/64" | wedi Shower Base |
| 1504162 | wedi — 4'x5' Shower Base · 48"×60"×1 37/64" | 4'x5'x1-37/64" | wedi Shower Base |
| 1512228 | wedi — 3'x5' Curbless Shower Base — Offset Drain · 36"×60"×1 1/8" | 3'x5'x1-1/8" | wedi Curbless Shower Base, Offset Drain |
| 1518075 | wedi — 3'2"x5'4" S-Dry Shower Base · 38"×64" | 38"x64" | wedi S-Dry Shower Base |
| 47700 | wedi — 3'x5'x1/2" Building Panel · 36"×60"×1/2" | 3'x5'x1/2" | wedi Building Panel |
| 26895 | wedi — 4'x8'x2" Building Panel · 48"×96"×2" | 4'x8'x2" | wedi Building Panel |
| 29118 | wedi — 60" Lean Curb · (none) | 60" | wedi Lean Curb |
| 1504181 | wedi — 4"x4" Drain Cover — Stainless | 4"x4" | wedi Stainless Drain Cover |
| 28955 | wedi — 27" Linear Drain Cover — Stainless | 27" | wedi Stainless Linear Drain Cover |
| 1504179 | wedi Fundo® Linear Shower Module 32" · 32"×5 3/4" | 32"x5-3/4" | wedi Linear Shower Module |
| 29075 | wedi Fundo® Linear Shower Extension 32" · 32"×66 3/4" | 32"x66-3/4" | wedi Linear Shower Extension |
| 29244 | wedi Fundo® Shower Extension 24"x48" · 48"×24" | 24"x48" | wedi Shower Extension |
| 28960 | wedi® Fastener Kit · 100 ct 1 5/8" Screws & 100 ct. Washers with Tabs | 100 ct | wedi Fastener Kit, Screws & Washers with Tabs |
| 29647 | wedi® Joint Sealant Sausage · 20 oz foil sausage | 20 oz | wedi Joint Sealant Sausage |
| 47735 | wedi® Joint Sealant Tube · 10.5 oz cartridge | 10.5 oz | wedi Joint Sealant Tube |
| 1518109 | wedi®PRO-SET™ Tile Adhesive · 25 lbs. Bag | 25 lb | wedi Pro-Set Tile Adhesive |
| 26897 | wedi® Subliner Dry Mixing Valve Seal | | wedi Subliner Dry Mixing Valve Seal |
| 26896 | wedi® Subliner Dry Pipe Seal | | wedi Subliner Dry Pipe Seal |
| 47822 | wedi® Corner Putty Knife | | wedi Corner Putty Knife |
| 29542 | wedi® Subliner Dry 53 ft2 · 53 sft roll | 39"x16' | wedi Subliner Dry Roll, 53 sf |
| 29264 | wedi® Subliner Dry Inside Corner · 2 per bag | | wedi Subliner Dry Inside Corner, 2 per bag |
| 1518087 | wedi — 72" Wedi S-Dry Curb Full | 72" | wedi S-Dry Curb |
| 1518080 | wedi — S-Dry Drain Cover — Stainless | | wedi S-Dry Stainless Drain Cover |
| 1518096 | wedi — 50"x25' Wedi S-Dry Membrane 104sf · 50"×300" | 50"x25' | wedi S-Dry Membrane, 104 sf |
| 1518095 | wedi — 5"x32' Wedi S-Dry Tape · 5"×384" | 5"x32' | wedi S-Dry Tape |
| 1518098 | Wedi S-Dry Seal | | wedi S-Dry Seal |
| 1518099 | wedi — 3/16"x5/32" Wedi S-Dry Seal Trowel · 3/16"×5/32" | 3/16"x5/32" | wedi S-Dry Seal Trowel |
| 1518089 | Wedi S-Dry 90° Inside Corner 2 per/bg | | wedi S-Dry Inside Corner, 2 per bag |
| 1518091 | Wedi S-Dry 90° Outside Corner 2 per/bg | | wedi S-Dry Outside Corner, 2 per bag |
| 1518093 | Wedi S-Dry Mixing Valve Collar | | wedi S-Dry Mixing Valve Collar |
| 1518094 | Wedi S-Dry Shower Pipe Collar | | wedi S-Dry Pipe Collar |

Rules the table encodes, so a part not listed lands the same way:

- **Bases** (`pan`): `w'xd'xt"` (feet when a side is a whole number of feet,
  otherwise inches, `t` from the parsed thickness; no `t` when the sheet gives
  none). Family word: Shower Base / Curbless Shower Base / Linear Shower Base /
  S-Dry Shower Base. Qualifier `, Offset Drain` when the drain is offset.
- **Panels** (`panel`): `w'xd'xt"`, "Building Panel" or "Vapor 85 Building Panel".
  Panel kits keep their own name (unchanged).
- **Modules, extensions, ramps, corner extensions**: both parsed dimensions,
  run first (`32"x66-3/4"`, `24"x48"`).
- **Covers**: the channel length (linear) or `4"x4"` (point) in Size; the finish
  word moves in front of the part ("Stainless Drain Cover", "Matte Black Linear
  Drain Cover").
- **Curbs**: length in Size; "Lean Curb", "S-Dry Curb" (the sheet's "Full" is the
  only S-Dry curb and reads as noise).
- **Niches**: outer `w"xd"` in Size, "Shower Niche" / "Cathedral Shower Niche"; the
  interior size is dropped from the row (the popup still shows it).
- **Subliner, S-Dry rolls, tapes**: roll size in Size, coverage as the qualifier
  (`, 53 sf`, `, 104 sf`).
- **Sealant, adhesive, fasteners**: the pack quantity in Size (`20 oz`, `25 lb`,
  `100 ct`), the pricelist's content words as the qualifier only where they add
  something ("Screws & Washers with Tabs"; the "20 oz foil sausage" repeat is
  dropped).
- **Everything else**: the pricelist's name with brand marks, "Fundo", "®", "™"
  and dash separators removed; `2 per/bg` → `, 2 per bag`.
- Spelling: `x` between dimensions, `'` and `"` marks, mixed numbers hyphenated
  (`1-37/64"`, the engine's own `inch()` spelling), no spaces inside a size.

### Schluter

Schluter has no name table today: the landed name is the imported book's
description, so the same part reads differently from the stock export and the
EFT sheet. The engine already decodes every part number into a group and its
dimensions (`classify`), so the name derives from the code and the book's text
only fills gaps the code does not carry. "Today" shows one of the shapes seen.

| Part no. | Today | Size | Product |
|---|---|---|---|
| KST965/1525 | Kerdi-Shower-T Tray 38 X 60 Pvc | 38"x60" | KERDI-SHOWER-T Tray |
| KST965/1525S | KERDI-SHOWER-TS Tray 38"×60" offset drain | 38"x60" | KERDI-SHOWER-TS Tray, Offset Drain |
| KST965BF | Kerdi-Shower-Tt Tray 38 X 38 Pvc | 38"x38" | KERDI-SHOWER-TT Tray, Curbless |
| KSLT9151830S | KERDI-SHOWER-LTS TRAY 36X72 PERIMETER DRAIN 36 INCH SIDE | 36"x72" | KERDI-SHOWER-LTS Tray, Linear Drain on 36" Side |
| KD2FLKPVC | KERDI-DRAIN flange kit 2" PVC | 2" | KERDI-DRAIN Flange Kit, PVC |
| KD3FLKE | Kerdi Drain Flange Kit - KD3FLKE Stainless | 3" | KERDI-DRAIN Flange Kit, Stainless |
| KD4GRKE | KERDI-DRAIN grate 4" stainless | 4" | KERDI-DRAIN Grate, Stainless |
| KLVRID5EB122 | KERDI-LINE-VARIO 4' floral, brushed SS · cut to length | 4' | KERDI-LINE-VARIO Channel, Floral, Brushed Stainless |
| KLVR2FLK | KERDI-LINE-VARIO flange kit 2" | 2" | KERDI-LINE-VARIO Flange Kit |
| KERDI200/10M | Kerdi Membrane Roll · 3'3"×33' = 108 sf | 3'3"x33' | KERDI Membrane, 108 sf |
| KERDI200/7M | KERDI membrane roll · 3'3"×23' = 75 sf | 3'3"x23' | KERDI Membrane, 75 sf |
| KEBA100/125/10M | KERDI-BAND 5" seam band · 32'10" roll | 5"x33' | KERDI-BAND |
| KERECK/FI10 | 90 Kerdi Kereck F Inside - KERECK/FI10 10/pk | 10 ct | KERDI-KERECK-F Inside Corner |
| KMSMV / KMSPS | Kerdi-Seal-MV … / Kerdi-Seal-PS … | | KERDI-SEAL-MV Valve Seal / KERDI-SEAL-PS Pipe Seal |
| KBSC1151501524 | KERDI-BOARD-SC curb 60" · 6"×4½"×60" | 60"x6"x4-1/2" | KERDI-BOARD-SC Curb |
| KB1212202440 | KERDI-BOARD 1/2" panel · 48"×96" = 32 sf | 48"x96"x1/2" | KERDI-BOARD Panel |
| KB506252440 | KERDI-BOARD 2" panel · 2"×24.5"×96" | 24-1/2"x96"x2" | KERDI-BOARD Panel |
| KBZS35GT32Z100 | KERDI-BOARD screws + washers · 100 ct | 100 ct | KERDI-BOARD Screws & Washers |
| KB12SN305711 | Schluter KERDI-BOARD-SN Niche 12"x28" | 12"x28" | KERDI-BOARD-SN Niche |
| KBSB410TA | Schluter Kerdi-Board-SB Bench Triangular · 16"x16"x20" | 16"x16"x20" | KERDI-BOARD-SB Bench, Triangular |
| SETA50W | Schluter ALL-SET modified thin-set · 50 lb bag | 50 lb | ALL-SET Thin-set |

Rules:

- **Trays** (`tray`): `w"xd"` from the code; family from the code (T, TS, TT, LTS);
  qualifiers `, Offset Drain`, `, Curbless` (the thin BF tray), `, Linear Drain on
  N" Side` (LTS, N = the channel edge). Schluter trays are sloped, so no thickness.
- **Point drains** (`drain`, point): pipe size from the code's digit (KD2/KD3/KD4)
  in Size; "Flange Kit" or "Grate"; material qualifier from the suffix (PVC, ABS,
  E = Stainless, EB = Brushed Stainless). *Grammar addition:* the pipe size and
  material suffix are not parsed today.
- **Linear drains** (`drain`, linear): channel length in Size (`4'`, `8'`); design
  and finish words from the existing `LINE_STYLE` / finish tables.
- **Membrane**: roll size in Size (3'3" wide, length from the roll code: 5M 16'5",
  7M 23', 10M 33', plain 98'5"); coverage as the qualifier.
- **Band**: `width"xlength'` from the code (`5"x33'`). Corners: the pack count in
  Size (`10 ct`, `2 ct`), "Inside Corner" / "Outside Corner". Seals: no size.
- **Curbs, boards, benches**: the engine's parsed size (`60"x6"x4-1/2"`,
  `48"x96"x1/2"`, bench dims); "Curb", "Panel", "Bench, Triangular".
  *Grammar addition:* the niche code's millimetre pair (305×711 → `12"x28"`).
- **Thin-set**: `50 lb`, "ALL-SET Thin-set"; KERDI-FIX "KERDI-FIX Adhesive".
- **Fallback** for a code the grammar does not size: the book description with
  the vendor code dropped (what a search pick lands today), brand word removed.
- "Mortar bed" and "by others" placeholder lines are unchanged.

## Where it lives

### wedi engine (`src/wedi.js`)

- `makeEntry` sets `e.name` to the brand-free, size-free Product text (with its
  comma qualifier) and `e.sizeText` to the Size text, per the rules above. One
  place, so the popup, the Compare tab, the basket and the landed rows all agree.
- `lineItems` lands `brandColor: "wedi " + e.name` and `sizeText: e.sizeText`.
  The `"wedi — "` / `"wedi US… — "` leads go. A special-order (non-stock) line
  still lands with an empty `sku`; its US part number stays reachable from the
  marker (`wedi.key` / `wedi.part`, stamped on every line since 2026-09-02), and
  the print shows it in the SKU slot (below). `rowItemKey`'s name-regex fallback
  stays for legacy rows only.
- `orderCopyLines`'s description branch composes `size + "wedi " + name`.
- The popups keep `kitLabel(e.name, e.sizeText)` (`.scratch/160`): with no size
  in the name, the label's size comes from the hint, which `kitLabel` already
  supports (`fromHint`). The popup display is unchanged in meaning.

### Schluter engine (`src/schluter.js`, `src/schluteradapter.js`)

- A new `nameOf(e)` / `sizeOf(e)` pair derives the Product and Size text from the
  classified entry per the rules; `catalogOf` stores them on the entry as `name` and
  `size` (today's fields, so every consumer keeps working), keeping the book's raw
  description on `e.desc` for the fallback and for search.
- `brandName` goes; `lineItems` lands `brandColor: e.name`, `sizeText: e.size`.
  `orderCopyLines` composes `size + name`.
- Grammar additions in `classifyCode`: point-drain pipe size and material suffix;
  niche millimetre pair; the KERECK pack count from the code (`/FI10`, `/FA2`).

### Print (`src/EstimateColumns.jsx`, `src/printcols.js`)

- A row carrying a `wedi` or `schluter` marker is a **brand row**. Its product cell
  renders one dark line: `sizeText` verbatim (not `tightSize` — the owner wants
  "3'x5'", and `tightSize` would turn it into 36×60″), a space, `brandColor`.
  Its muted tail is `SKU <sku>` for a stocked line, else the vendor part number
  from the marker (`US9100004`, `KST965/1525`) for a special-order line. No
  `specLine` (no inches, no coverage).
- `SKU` and its number render inside one no-wrap span on **every** row, brand or
  not, so a wrap moves "SKU 28862" as a unit.
- The one-line / two-line fit (`isOneLine`) treats the brand row's tail as its spec
  text, so short rows still sit on one line.
- The legacy cards layout (`EstimatePrint.jsx`, not selected) is untouched.

### Grid (`src/App.jsx`)

No change. Size sits left of Product; once the engine fills both fields the row
reads size first. The Size cell is already editable on misc rows.

### Order entry (`src/orderentry.js`)

`orderDescription` already composes size parts, then the brand-led name, then the
SKU; with the size in `sizeText` and no size in the name, the ERP description reads
`3'x5'x1/2" wedi Building Panel 47700` without duplicating the dimensions. No
code change expected; the descfit tests confirm.

### Old rows (ADR 0035 landing)

Nothing rewrites a saved row. `landKitLines` replaces a kit's lines on reconfigure
and `appendKitLines` lands new ones, so a kit gets the new text when the
salesperson next lands or reconfigures it. `normP` is untouched.

## Testing

- `wedi.test.js`: the name assertions (lines 202–219 today) move to the new
  `name` / `sizeText` pairs; one table-driven test pins every row of the wedi
  table above through `kitFor` + `lineItems` (so the spec table and the code
  cannot drift). The marker golden tests (`wedimarkergolden`, `wallsysgolden`)
  compare quantities, not names, and stay green.
- `schluter.test.js`: a table-driven test pins the Schluter table through
  `catalogOf` + `buildKit` + `lineItems` over stock-export-shaped and EFT-shaped
  rows (the two book shapes); the `brandColor` assertions at 473–481 move to the
  new rule.
- `schluteradapter.test.js`: the grammar additions (pipe size, material, niche
  mm pair, corner count).
- `kitlabel.test.js`: a size-free name with a size hint labels size-first.
- `printcols.test.js` / `print.test.js`: brand rows produce `size + name` and the
  SKU or part-number tail; a non-brand row is unchanged; the SKU span is no-wrap.
- `orderentry` descfit tests: the composed description carries the size once.
- Preview proof before merge (non-negotiable 3): the `.scratch/165` harness re-shot
  with the new names — grid screenshot of a landed wedi kit and a Schluter kit, and
  the printed sheet with a forced narrow product column to show "SKU 28862"
  wrapping as a unit.

## Records

- ADR: "wedi and Schluter rows read size · name · SKU; the engine derives the
  name from the part, not the book" — supersedes the 2026-08-06 by-the-foot /
  inches-on-the-second-line naming, records the no-brand-word Schluter rule, and
  the brand-row print treatment as a deliberate exception to the standard product
  line (name bold, size · coverage · SKU muted).
- `src/CLAUDE.md`: the `wedi.js`, `schluter.js`, `kitlabel.js`, `EstimateColumns.jsx`
  notes updated.
- Issue `.scratch/165_shower-line-descriptions/ticket.md` → the implementation
  ticket for this change.

## Out of scope

- Renaming rows already saved on projects (owner decision 5).
- The search pick's own label (`stockPatch` → `label`): a part searched in from the
  stock book still lands the stock description. Making the pick borrow the
  configurator's name needs a lookup the boot path can afford (the engines are
  lazy chunks) and is its own change.
- The popup's row display (`kitlabel.js`), the Compare print, and the basket
  drawer: they keep reading the entry's `name` / size and change only in that the
  name no longer carries a size or a brand word.
- The Sheoga configurator's names.
