# Phase 5 · Task 4 — CompareTab render checks

Working shots captured while implementing `src/CompareTab.jsx` (not the final
change-control proof — that is Task 7's deliverable). All driven with the repo's
Playwright chromium against `npx vite` (`PORT=5199`) on the dev harnesses.

| file | what it shows |
|---|---|
| `compare-schluter-host.png` | `schluter-preview.html` → Compare tab, host = Schluter: both columns priced, 7-category rail, totals, delta line, three diffnotes cards. No `onQuoteOptions` in that harness, so no footer — the tab renders without it. |
| `compare-so-rows.png` | 48″×48″ linear room — the special-order LTS tray row in rust (`.ln.so`). |
| `compare-missing-column.png` | 300″×300″ room — wedi solves nothing: one faint explanatory cell, `—` total, delta line suppressed, no crash. |
| `compare-wedi-host-modal.png` | throwaway `host="wedi"` harness (deleted after the check): host column = the live wedi kit, Schluter column = derived house kit, quote-options confirm modal open. Confirm logged 9 wedi + 12 Schluter lines with anchors `wedi.cfg.panKey = US9100007` and `schluter.cfg.w = 60`. |
