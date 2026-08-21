# Phase-4 preview proof (repo rule 3) — both configurators, one switch

The Stock only / Full catalog switch is now the shared `SourceSwitch`
(widgets.jsx) mounted in BOTH popup headers. Shots from the two dev
harnesses (`wedi-preview.html`, `schluter-preview.html`).

| Shot | Configurator | What it proves |
|---|---|---|
| w1-kits-stockonly | wedi | Kits under Stock only: the three special-order neo modules (36/42/54) gray out; every pan stays |
| w2-custom-3660-full | wedi | 36×60 linear under Full catalog: three options — the stocked linear base + two 36″ SO module layouts |
| w3-custom-3660-stockonly | wedi | Same room, switch flipped: the SO module layouts leave the pool, the stocked linear base re-ranks alone |
| w4-browse-full / w5-browse-stockonly | wedi | Browse "brass": 11 rows → the 3 stocked ones; the switch is a hard constraint (P2) |
| s1-schluter-stockonly-rerank | Schluter | The P2 demo under the SHARED switch: exact LTS 48×48 is special order, Stock only re-ranks to the stocked 55×55 deep cut |

Engine changes are pinned by tests: wedi `solve` with no source deepEquals
Full catalog; Schluter's pinned truth-table total is unchanged; stock-only
never silently drops a role (`pickFrom`), and a SO covering curb loses to
stocked multiples cut end-to-end (the P2 60″→2×48″ example).
