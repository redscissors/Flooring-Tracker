# Sheoga trim & accessories — design

Date: 2026-10-02 · Status: Draft for owner review · Mockup:
`.scratch/mockups/sheoga-accessories-2026-10-02/` (throwaway; `?view=own`,
`?view=markup`, `?view=sheets`)

## Goal

Quote Sheoga's matching trim (stair nosing, shoe mold, reducer, T-mold, slip
tongue) from the Sheoga configurator, priced off Sheoga's own distributor
accessory sheet, which the team uploads to the Sheoga price book and replaces
when Sheoga sends a new one. The markup is set on the Sheoga book beside the
flooring and vent markups.

## Owner decisions (2026-10-02)

1. The sheet is **uploaded to the Sheoga vendor book** and the tab prices off
   the uploaded copy. Not hand-transcribed into `sheoga.js` like the other
   three Sheoga sheets.
2. **Plugs are left out.** The parser skips the sheet's Plugs block.
3. The new **Trim & accessories markup starts at 100%**.
4. **Texture is priced from the sheet** (amended 2026-10-02, see decision 6).
   ~~The book holds a blank, hand-entered per-piece textured charge; a
   textured build can't be added until it's filled.~~ Superseded the same
   day when Sheoga sent the texture prices.
5. **Nosing and shoe mold order as pieces of a chosen length** (e.g. 5 × 6'),
   not only bare lineal feet. Lengths offered: 3' 4' 5' 6' 7' 8' 9' 10' 12',
   plus **Random lengths** (entered in lf, Sheoga picks). Several lengths per
   piece type are allowed. Reducer and T-mold are 8' only (the sheet says so).
6. **Texture (owner, 2026-10-02, on Sheoga's updated 10/01/26 sheet).** The
   sheet's "Texture Charge" row is the only source of texture prices: nosing
   3½" and 5½" +$2.00/lf; shoe mold, reducer and T-mold "Cannot Be Textured".
   - When the trim is textured (matched from a textured floor, or picked),
     texturable pieces carry the charge.
   - Pieces Sheoga can't texture **ship smooth automatically**, each marked
     "smooth — can't be textured". Nothing blocks the add.
   - **The hand-entered Textured row is removed.** The book table shows the
     sheet's Texture row read-only.
   - A sheet edition with no Texture Charge row parses fine. Every piece
     then reads "can't be textured".

## The sheet (10/01/2026 edition)

All prices are distributor cost **per lineal foot**:

- **Species:** Beech, Cherry, Maple, Hickory, Red Oak, White Oak, Walnut,
  QR White Oak.
- **Profiles:** Rabbeted nosing 3½" and 5½" · Shoe mold ½"×¾" · Reducer
  ¾"×2½" · T-mold ¾"×2½".
- **Prefinished Charge:** a per-lf adder per profile — $2.40 / $3.75 / $1.85
  / $1.85 / $1.85. It is the same for any stain or sheen.
- **Texture Charge** (the updated 10/01/26 edition): $2.00 / $2.00 for the
  two nosings. The shoe mold, reducer and T-mold cells read "Cannot Be
  Textured" (text, not a price). It is the same for any texture.
- **Slip tongue:** $0.40/lf, any species, in 50 lf bundles.
- **Plugs:** skipped.
- **UPDATED:** an Excel date serial (46296 = 2026-10-01).
- **Quirks the parser absorbs:**
  - species names carry trailing spaces ("Maple ", "Red Oak ");
  - "QR White Oak" is our "Q/R White Oak";
  - the five price blocks sit side by side in one sheet, each headed by its
    profile name.

## 1. Stored data (no SQL)

The parsed sheet is stored on the Sheoga vendor book (`price_books.data`, kind
`vendor`, engine `sheoga`). It is written only through the existing
`updateBook(id, { dataPatch })` path:

```
data.sheets.accessories = {
  fileName, sheetDate: "2026-10-01", uploadedAt, uploadedBy,
  species: { "<species>": { nose35, nose55, shoe, reducer, tmold } },   // $/lf
  prefin:  { nose35, nose55, shoe, reducer, tmold },                    // $/lf
  tex:     { nose35, nose55, shoe, reducer, tmold },   // $/lf, or null = can't be textured
  slip:    { perLf, bundleLf },
}
data.markups     = { flooring, vents, trim }                  // trim new, default 100
```

- **No hand-entered texture slot.** Texture rides the sheet like every other
  price (decision 6).
- **Saved estimate lines never reprice** (ADR 0003 snapshot). A new upload
  changes only new picks.
- **`sheogaMarkups(books, settings)`** gains `trimMarkupPct`:
  - the book's `markups.trim` when the book exists;
  - else `DEFAULT_TRIM_MARKUP` (100).
  There is no Settings fallback field: trim needs the book anyway, for its
  prices.
- **`normVendorMarkups`** adds `trim`. Existing books without it read 100.
  Creating the book (`vendorBookSeed`) seeds 100.
- The `floortrack-data-model` skill and an ADR (amending ADR 0040, "a vendor
  book never imports") record the new keys.

## 2. Getting the sheet in

**Parser (`sheogatrim.js`, pure, tested):**

- `isSheogaAccessorySheet(sheets)`: true when the title cell reads "SHEOGA
  ACCESSORY PRICING".
- `parseAccessorySheet(sheets)` returns `{ sheet, problems[] }`:
  - Finds each profile block by its header text ("Rabbeted Nosing" with the
    3 1/2" / 5 1/2" sub-headers, "Shoe Mold", "Reducer", "T-Mold").
  - Reads the species rows under each block and the "Prefinished Charge" row.
  - Reads the optional "Texture Charge" row: a positive number is the $/lf
    charge, and "Cannot Be Textured" (or any non-number, or no row at all)
    means `null`.
  - Reads "Slip Tongue" with its price and the "50LF" bundle note (default 50
    if the note changes), plus the UPDATED date.
  - Every one of the 8 species × 5 profiles, the 5 prefinish charges and slip
    tongue must be present as positive numbers. Anything missing or
    non-numeric becomes a named problem ("Walnut — T-mold price missing").
  - Any problem **blocks Save**.

**Book page → new "Price sheets" tab** (`VendorBookPage`):

- Lists the accessory sheet: file name, sheet date, who uploaded it and when,
  with **Upload…** / **Replace…** (button or drag a file onto the card).
- Lists the other three Sheoga sheets as "built into the app" with their
  dates.
- Picking a file opens an inline review:
  - the parsed table, species × profile plus the Prefinished row;
  - slip tongue;
  - on a replace, each changed price is highlighted with its old value, plus
    a count ("12 prices changed");
  - problems, if any.
- **Save** writes `sheets.accessories`. **Cancel** discards.
- The table's **+ Textured** row comes from the sheet and is read-only. A
  null reads "can't be textured". Texture changes are highlighted in the
  replace diff like any other price.

**Library "Drop sheets" zone:** `ImportRouter` recognizes the accessory sheet
(`isSheogaAccessorySheet`) and routes it to the Sheoga vendor book, reading
"Sheoga accessory sheet → Sheoga Hardwood". Its run step is the same review +
Save instead of the item-import wizard. With no Sheoga book the row says to
create one first. Other files in the same drop route as today.

## 3. The Trim & accessories tab

A new mode `trim` in `MODES`, labeled "Trim & accessories", after Dampers. It
uses the configurator's existing parts (Sect/Chips/Seg/MorphSelect, BuildCard
look, price-level lens, basket, mobile price bar/sheet).

**Match floor:**
- **On by default.** Species, finish, stain, sheen and texture follow the
  last-open floor or stocked tab (`floorSrc`, the vents' "Copy floor" source).
  The pickers lock while matching.
- **Pick my own** unlinks the tab.
- **Species map:** Live Sawn White Oak → White Oak. Everything else maps by
  name (Q/R White Oak matches the sheet's QR).
- A stocked color's texture ("Cattail · Sawcut") carries over as in
  `ventFromFloor`.
- **The link is live only inside one popup session.** A saved build reopens
  with Match floor **off**, showing the values it was added with. The floor
  tab's default state must never silently re-species a placed kit. The
  "Match floor" button relinks it.

**Picks:**
- **Species:** 8 chips.
- **Finish:** Unfinished | Prefinished. Prefinished shows Stain color (the
  sheet's colors + Custom…) and Sheen pickers; both are order text only.
- **Texture:** the TEXTURES list.

**Pieces:**
- **Nosing 3½", nosing 5½", shoe mold:** one or more runs per piece. A run is
  `N pcs × L'` (L in 3–10, 12) or `N lf` at Random lengths. "+ another
  length" adds a run.
- **Reducer, T-mold:** a count of 8' pieces.
- **Slip tongue:** a count of 50 lf bundles. Species, finish and texture
  don't apply to it.
- Each row shows the sell $/lf (and $/pc where fixed). Rows with qty 0 are
  ignored.

**Pricing:**
- Cost per lf = species price + (prefinished ? prefin charge : 0) +
  (textured ? texture charge : 0).
- A piece's unit cost:
  - a run of length L: lf cost × L;
  - Random lengths: lf cost per lf;
  - reducer/T-mold: lf cost × 8;
  - slip tongue: perLf × bundleLf.
- Unit cost is rounded to cents, then `sellOf(unitCost, trimMarkup)`. The
  same rounding as every Sheoga price.
- The tier lens is display only. Lines land retail (ADR 0018).

**Pieces that can't be textured** (decision 6):
- When the build is textured, a piece whose sheet texture charge is null
  prices and orders smooth.
- Its build-card block and rail row say "smooth — can't be textured", and
  its order text omits the texture.
- Texturable pieces show "Textured — {texture} +$X/lf" and carry the
  texture in the order text.
- Nothing is ever blocked. Slip tongue never takes texture.

**Build card:**
- Header: "Sheoga trim — {species}" plus the sheet date ("accessory sheet ·
  Oct ’26").
- One block per line: description, cost breakdown, qty math ("15 pcs × 8' =
  120 lf"), cost → sell per unit, line total.
- Footer: total cost → +markup% → total sell.
- Buttons: Add to basket · Add N product lines.
- The markup box in the footer reads "Trim markup", seeded from the book.

**No sheet uploaded / no Sheoga book:** the tab shows one card: "Upload
Sheoga's accessory sheet on the Sheoga price book (Price books → Sheoga
Hardwood → Price sheets)" or "Create the Sheoga vendor book first". Nothing
prices.

## 4. Product lines and kits

- **One build lands as one kit** (ADR 0035): one product line per piece type
  and length, stamped with one kitId. The first line is the **anchor**,
  carrying `sheoga: { mode: "trim", cfg }`. The others carry
  `sheoga: { mode: "trim", part: true }` (no cfg). They are companions, the
  fee-line idiom: filed as Sheoga special order, not reconfigurable alone.
- **Reconfigure** on the anchor reopens the whole build. Add replaces the
  whole kit (`landKitLines`). The basket stages a single entry
  `{ kind: "single", snap: { mode: "trim", cfg } }`. `normBasketEntry`
  accepts it unchanged.
- **Row shape:**
  - `type: "hardwood"`, `qtyType: "count"`, `qty` = pieces / lf / bundles;
  - `priceSqft` = sell per unit, `costSqft` = cost per unit, `markupPct`;
  - `sellUnit` "PC" | "LF" | "BDL";
  - `sizeText` = the profile size;
  - `brandColor` = "Sheoga {profile} · {length} pcs · {species} · {finish} ·
    {sheen} · {texture}" (texture only on pieces that take it).
  - No waste on these count lines. The plan verifies `lineWastePct` leaves
    count rows alone, as for vents.
- **Order text** example: `T-mold ¾"×2½" · 8' pcs · White Oak · Prefinished
  Toasted Acorn · 30 sheen · Wire brushed`. `descParts` returns null for
  `trim` (like vents), so order entry uses the row text.
- **Where the sheet comes from:** pricing needs the uploaded sheet, so
  `calcConfig(snap, sf, { trim })` takes it as an option. The configurator
  gets a `trimBook` prop (the uploaded sheet, which carries the texture rates) from App.jsx /
  AppsWorkspace beside the existing markup props. Every in-popup caller
  passes it: BuildCard, basket view, placed-kit view, `lineItems`. A trim
  snap priced without a sheet returns null ("sheet not uploaded").

## 5. Testing and proof

**Unit tests (`sheogatrim.test.js`, node --test):**
- The parser reads the real 10/01/26 file (the updated edition, committed as
  the main fixture): all 40 prices, 5 prefinish charges, the Texture row
  (2/2/null/null/null), slip tongue, the date, and the QR/trailing-space
  normalization. The first edition (no Texture row) stays as a second
  fixture and parses with every texture null.
- A copy with a blanked cell and one with a renamed header each yield the
  named problem and no sheet.
- Pricing:
  - a 6' nosing run, Random lengths, reducer at 8', a slip bundle;
  - prefinish + markup, matching the sell figures the mockup shows;
  - textured nosing +$2.00/lf; textured shoe/reducer/T-mold price and
    order smooth with the "can't be textured" note; slip never textured.
- `lineItems`: anchor/companion markers, row shapes.
- `normVendorMarkups` / `sheogaMarkups` with and without `trim`.
- Basket entry round-trip.

**Preview proof (non-negotiable 3):**
- `sheoga-preview.html` and `vendor-book-preview.html` gain the trim tab and
  the Price sheets tab over local state.
- Screenshots of: the tab matching a textured floor (textured nosing, smooth
  shoe/reducer/T-mold with the note), Pick my own, the book upload review with diffs, a parse failure, and phone
  width.

## Out of scope

- Plugs.
- Moving the flooring, vent or damper sheets into the book.
- Storing the original .xlsx file (only the parsed prices are kept).
- A hand-entered texture price, or one that overrides the sheet (owner
  decision 6).
- Stair-tread / landing pieces not on this sheet.
