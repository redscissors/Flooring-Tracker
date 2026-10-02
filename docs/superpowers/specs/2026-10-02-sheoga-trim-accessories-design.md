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
4. **Texture is designed in now, with no price yet.** Sheoga's textured-trim
   price and availability are unconfirmed. The book holds a blank per-piece
   textured charge. Until it's filled, a textured build can't be added
   (Ship smooth or wait). Build now with it blank; don't hold the feature.
5. **Nosing and shoe mold order as pieces of a chosen length** (e.g. 5 × 6'),
   not only bare lineal feet. Lengths offered: 3' 4' 5' 6' 7' 8' 9' 10' 12',
   plus **Random lengths** (entered in lf, Sheoga picks). Several lengths per
   piece type are allowed. Reducer and T-mold are 8' only (the sheet says so).

## The sheet (10/01/2026 edition)

All prices are distributor cost **per lineal foot**:

- **Species:** Beech, Cherry, Maple, Hickory, Red Oak, White Oak, Walnut,
  QR White Oak.
- **Profiles:** Rabbeted nosing 3½" and 5½" · Shoe mold ½"×¾" · Reducer
  ¾"×2½" · T-mold ¾"×2½".
- **Prefinished Charge:** a per-lf adder per profile — $2.40 / $3.75 / $1.85
  / $1.85 / $1.85. It is the same for any stain or sheen.
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
  slip:    { perLf, bundleLf },
}
data.trimTexture = { nose35, nose55, shoe, reducer, tmold }   // $/lf or null; hand-entered
data.markups     = { flooring, vents, trim }                  // trim new, default 100
```

- **`trimTexture` sits outside `sheets`** so replacing the sheet never wipes
  the hand-entered textured charge.
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
- Below the table, a **Textured** row of five $/lf inputs with its own Save
  writes `trimTexture`. It is labeled "not on Sheoga's sheet — enter from
  Sheoga".

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

**Texture with no charge set:**
- The rail shows "Textured trim price not set — ask Sheoga, then enter it on
  the Sheoga price book" with **Ship smooth**, which sets texture to smooth
  for this build.
- The build card lists the textured row as "not set".
- Add / Add to basket stay disabled while blocked.
- Slip tongue alone is never blocked.

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
    {sheen} · {texture}".
  - No waste on these count lines. The plan verifies `lineWastePct` leaves
    count rows alone, as for vents.
- **Order text** example: `T-mold ¾"×2½" · 8' pcs · White Oak · Prefinished
  Toasted Acorn · 30 sheen · Wire brushed`. `descParts` returns null for
  `trim` (like vents), so order entry uses the row text.
- **Where the sheet comes from:** pricing needs the uploaded sheet, so
  `calcConfig(snap, sf, { trim })` takes it as an option. The configurator
  gets a `trimBook` prop (sheet + texture rates + markup) from App.jsx /
  AppsWorkspace beside the existing markup props. Every in-popup caller
  passes it: BuildCard, basket view, placed-kit view, `lineItems`. A trim
  snap priced without a sheet returns null ("sheet not uploaded").

## 5. Testing and proof

**Unit tests (`sheogatrim.test.js`, node --test):**
- The parser reads the real 10/01/26 file (committed as a fixture): all 40
  prices, 5 prefinish charges, slip tongue, the date, and the QR/trailing-space
  normalization.
- A copy with a blanked cell and one with a renamed header each yield the
  named problem and no sheet.
- Pricing:
  - a 6' nosing run, Random lengths, reducer at 8', a slip bundle;
  - prefinish + markup, matching the sell figures the mockup shows;
  - texture blocked while null and priced when set.
- `lineItems`: anchor/companion markers, row shapes.
- `normVendorMarkups` / `sheogaMarkups` with and without `trim`.
- Basket entry round-trip.

**Preview proof (non-negotiable 3):**
- `sheoga-preview.html` and `vendor-book-preview.html` gain the trim tab and
  the Price sheets tab over local state.
- Screenshots of: the tab matching a textured floor (blocked), Ship smooth,
  Pick my own, the book upload review with diffs, a parse failure, and phone
  width.

## Out of scope

- Plugs.
- Moving the flooring, vent or damper sheets into the book.
- Storing the original .xlsx file (only the parsed prices are kept).
- A per-job texture override beyond Ship smooth.
- Stair-tread / landing pieces not on this sheet.
