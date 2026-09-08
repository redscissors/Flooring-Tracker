Status: done

Owner (2026-09-08, after PR #370 shipped the selection sheet): "open a new PR
and remove the watermark."

Removed the SELECTIONS watermark end to end: the `.ft-pwm*` / `.ft-paper`
rules in src/index.css, the per-stripe screen copies + fixed print copy and
the page-count state in EstimatePrint.jsx (and the `paperRef` that only
served them). The masthead, label-free people row, tagline, and no-footer
sheet from #370 stay as they are.

Proof — `shot.mjs` runs the 128 harness (real EstimatePaper over the 090
fixture) after the change: `sheet-print-p1.png` / `sheet-print-p2.png` (print
media, no watermark on either page, still 2 pages), `sheet-screen.png`
(Preview tab). The script's probe counts 0 screen watermark copies.

`npm test`: 1375 pass, 0 fail. `npm run lint`: 7 errors, pre-existing.
