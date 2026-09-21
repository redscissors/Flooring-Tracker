---
issue_type: Feature
summary: Order-entry cleanup — the ERP field focused on open with "ERP #" as
  its gray placeholder, the special-order zebra gone, a copied line's whole row
  pale moss in both lists, and one wedi / one Schluter band in place of the
  per-group eyebrows.
status: done
labels: [ready-for-human]
---

# Order-entry cleanup

Owner, 2026-09-21, three asks on the order-entry panel (issue 147's bar):

1. **The ERP field is live on open** — focus lands in it so the number can be
   typed straight away (mouse-and-keyboard screens only; a phone's keyboard
   would rise over the list). The bold "ERP #" prefix inside the field is gone;
   "ERP #" is now the light-gray placeholder, typed over. The amber required
   border and the fine print under the field are unchanged.
2. **Flat rows, copied rows pale moss** — the every-other cream zebra on the
   special-order rows is dropped; every row sits on white. A copied line's
   whole row wears the Order summary's `--ft-tint`, in the Special list and
   the Stock list alike, however it was copied (its own button, Copy selected,
   Copy remaining). A stock row ticked but not yet copied only shows its
   checkbox (owner: green means it's in ERP). An assumed-quantity row keeps
   its amber edge bar over the tint.
3. **One wedi band, one Schluter band** — `lineGroup` files every wedi line
   under "wedi" and every Schluter line under "Schluter"; the catalog group /
   family survives as `sub`, the rank inside the band (pans, drains, curbs,
   building panels… / boards, trays, drains…), then SKU. Owner: the
   "wedi · Pans / Drains / Curbs" eyebrows made a wedi order "insanely busy".

Files: `src/orderentry.jsx`, `src/orderlines.js` (+ `orderlines.test.js`).

## Preview proof

`shot.mjs` over `order-entry-preview.html` (Vite on :5199):
`focus.png` (numbered, no order — the focused field and its placeholder),
`typed.png` (the number typed with no click first), `keyed.png` (one order,
four stamped lines — tinted rows in both lists, single wedi and Schluter
bands), `copy-all.png` (after Copy remaining — every stock line tinted),
`compact.png` (the Compact view — flat rows and the tint in its one run;
Compact has no vendor bands by design), `fold.png` (phone width).
