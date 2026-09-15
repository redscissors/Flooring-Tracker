---
issue_type: Feature
summary: The phone's project header is the desktop one-bar folded to the Z Fold 5
  cover screen (344px) — a two-column band with a tier dropdown beside the
  total; the Edit / Print preview tabs, the stat strip and the bottom-bar
  Print are gone on the phone.
status: done
labels: [ready-for-human]
---

# Mobile project header at Fold 5 cover width

Owner, 2026-09-15: "Let's work on improving the mobile version. I would like
it to be designed with the width of a fold 5 front screen. Right now I think
we could drop the top print swap. I would also like to play with the idea of
the header looking more like the main header. Show me some low padding
compact versions."

Board: `.scratch/mockups/mobile-fold5-header-2026-09-15.html` — three drafts at
344 CSS px beside the current layout, header stacks measured in a browser
(Now 166px, A 156, B 77, C 186). Owner picked C, then (rev 2): versions and
attachments to the ⋯ button, drop Save, move the bottom Print to ⋯, price
levels as a dropdown with the total fitting to its right at the same height.
Rev 2 measures 164px.

## What changed

- `src/mobile.jsx` — `MobileProjectBand`: Customer / Salesperson boxes down the
  left (106px); Project (name, address, N-number), the tier-coloured price
  dropdown + Total box (24px, label stacked over the money), and the All $ /
  Samples / Freight minis down the right. Same props and write paths as
  `ProjectHeaderBar` (`updateProject` only). `TierDrop` and `PrintDrop` ride
  `DotMenu` (new `align="left"`). Product rows tighten to 7 × 10px.
- `src/App.jsx` — the mobile shell renders the band instead of the stat
  strip; the top bar tightens and reads "Customer › Project" with no total;
  the Edit / Print preview tab row renders only when wide; the bottom bar is
  Area + Product (Print lives in the ⋯ sheet's footer, where it already was);
  "Print this option…" on the phone prints straight away and the scope resets
  after the print; the area band is 6 × 11px and its name 18px on the phone;
  page gutter 8px.
- `src/headerpreview.jsx` — the band in a 344px frame (preview proof).

## Proof

`preview-band.png`, `preview-tier-open.png`, `preview-print-open.png` — the
real component in `header-preview.html` at 344px (Chromium, 2×). Every
control measures within its width (scrollWidth ≤ clientWidth). The App.jsx
shell changes (top bar, tabs, bottom bar) have no Supabase-free harness; the
board is their prototype proof.
