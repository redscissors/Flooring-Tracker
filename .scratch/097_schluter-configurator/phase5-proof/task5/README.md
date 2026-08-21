# Task 5 render check — Compare tab in the wedi popup

Working shots, not the change-control proof (that is Task 7's, off the real app).
Captured against `npx vite --port 5199` + Playwright chromium.

| shot | page | what it proves |
|---|---|---|
| `compare-tab-no-room.png` | `wedi-preview.html` | the 4th tab exists, opens full-width (build column + drawings rail step aside), no room typed → one faint cell per column, `—` totals, no delta, no quote footer (the harness passes no `onQuoteOptions`) |
| `compare-tab-books-not-ready.png` | `wedi-preview.html` | room + kit on screen: wedi column priced ($1,480.94, 10/10 stocked), Schluter column faint "Loading the Schluter price books…" — the harness passes no registry bag yet (Task 7 extends it). No crash, which is the gate |
| `compare-wedi-host.png` | throwaway harness (not committed) | the same popup WITH the registry bag forwarded: both columns priced, $1,480.94 / $759.75, delta line, all three diffnotes, quote footer enabled |
| `compare-quote-modal.png` | throwaway harness | the quote-options confirm modal; Confirm fired `onQuoteOptions` with 10 wedi + 12 Schluter lines, label "Master bath", both anchors keeping their `wedi` / `schluter` reconfigure markers |

Builder lens on the same room: $1,214.38 / $698.96.

Leaving Compare for Custom shower restores `.buildcol` (1) and the rail's 2 SVGs —
the pane swap is not one-way.
