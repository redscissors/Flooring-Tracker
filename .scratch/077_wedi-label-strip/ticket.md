# 077 — wedi configurator: drop the drawing labels and the print's chrome

Status: done (2026-08-03)
Opened: 2026-08-03 (owner)
Area: wedi configurator (issue 066)

## The ask (owner)

> On the wedi configurator, It does not need to say Top down or Isometric on
> the drawing or configurator. On the wedi print, it does not need to have
> faint instructions at the bottom or the the wedi shower base at the top. It
> also does not need to say floor track

Follow-on to 076 — the same trim, one layer up: the drawings name themselves,
and the print sheet carries a title banner and a boilerplate footer.

## What changed

`src/WediConfigurator.jsx` only.

1. **Rail** — dropped the `Top-down layout` and `Isometric` `dc-h` headers over
   the two drawings. A drawing of a shower in plan next to one in 3-D doesn't
   need to be told apart in words. `.diagcol svg + svg{margin-top:10px}`
   replaces the spacing the second header was providing.
2. **Empty state** — its prose named the two views (`the top-down layout and
   isometric view draw here`); now just "the drawings render here". The
   `The shower` header stays — it labels the rail, not a drawing.
3. **Add-wall toast** — "Click an edge on the **top-down** drawing" → "on the
   drawing". The hint chip already sits directly over the drawing that takes
   the click.
4. **Print head** — dropped the `wedi shower layout` title and the `FloorTrack`
   sub. The sheet now heads with the area name (bumped to the title's weight)
   and the date over the rule. The room/drain/walls line under it is unchanged
   — that's job data, not chrome.
5. **Print diagram labels** — the same two `dh` captions gone, with their CSS.
6. **Print footer** — dropped the `ps-note` paragraph (joint sealant, fastener
   spacing, pre-sloped extension trim, "prices are the Jan 1 2026 book") and
   its CSS. Install instructions belong on wedi's own literature; the sheet's
   own **Cuts & install notes** section still prints whatever is specific to
   *this* build. The sheet now ends on the totals row.

## Proof

`node .scratch/077_wedi-label-strip/shoot.mjs after` (the 076 harness against
`wedi-preview.html`) — shots in `shots/`:

| shot | shows |
|---|---|
| `after-2-rail.png` | both drawings, no headers, spacing held |
| `after-3-rail-custom.png` | same over a solved custom shower |
| `after-4-print.png` | head is `Master bath` + date; no diagram captions; ends on the totals row |

`npm test` — 889 pass.
