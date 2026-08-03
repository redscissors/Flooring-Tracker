# 076 — wedi configurator: strip the drawing prose, centre the isometric

Status: done (2026-08-02)
Opened: 2026-08-02 (owner)
Area: wedi configurator (issue 066)

## The ask (owner)

> Let's also get rid of the text and the drawings. and also the text below the
> drawings. And let's also make sure that the isometric view is a bit more
> centered.

Three things: the prose annotations drawn **on** the two rail drawings, the
legend paragraph **below** them, and the isometric sitting off-centre.

## What changed

`src/WediConfigurator.jsx` only.

1. **TopDown** — dropped the corner `note` line (`pan falls ¼"/ft to drain ·
   2" waste at the channel centre · curb laps ½" over pan`). It was set at a
   fixed `x=6, y=13`, so on a wide room the wall band drew straight over it.
2. **Iso** — dropped the top `hl` line (`walls 4" thick, to 96" · green hatch =
   wedi · joints dotted`) and the bottom `hl2` assembly note (`curb 3 1/2" ·
   pan 1 37/64" · ½" lap · fall ¼"/ft to drain`).
3. **Rail** — dropped the `dc-legend` paragraph under the isometric and its CSS
   rule. It restated the whole drawing vocabulary on every build.
4. **Iso centring** — the projected diamond is much narrower than it is tall, so
   `Math.min` always picks the vertical fit and the leftover width was all
   dumped on the right (a 36×36 shower drew 149px wide in a 328px box, hard
   against the left edge). `offX`/`offY` now split the slack on whichever axis
   didn't set the scale.

5. **Pan label vs the drain box** (owner follow-up) — the piece's part number and
   size sat at the piece centre, and the drain paints *after* the pieces, so a
   centre drain buried the size line. The pair now slides to whichever side of
   the drain (and its callout) has room, and stays put when the two don't
   actually collide.

Measurements, dimension strings, drain callouts, `CURB`, `↓ entry` and the bench
labels all stay — those are figures, not prose.

The two drawings are shared with the print sheet, so 1 and 2 land there too. The
print sheet keeps its own `Cuts & install notes` section and its footer rule
line; the fall arrows are still drawn on the top-down.

## Preview proof

```
node_modules/.bin/vite --port 5199 --strictPort
node .scratch/076_wedi-iso-cleanup/shoot.mjs        before|after
node .scratch/076_wedi-iso-cleanup/shoot-bottom.mjs before|after
node .scratch/076_wedi-iso-cleanup/shoot-drains.mjs after
```

| Shot | What it proves |
|---|---|
| `*-2-rail.png` | Both drawings clean; the isometric centred in its box; the pan's size line clear of the drain. |
| `*-3-rail-custom.png` | Same with the drain pins drawn — the rust dimension lines stayed. |
| `*-5-rail-bottom.png` | The legend paragraph and the isometric's top/bottom notes are gone; the whole rail now ends with the drawing. |
| `*-4-print.png` | The print sheet's two drawings, notes section and materials table intact. |
| `after-6-drain-center.png` | 6′×6′ centre drain — the label lifts just clear of the box. |
| `after-6-drain-offset.png` | Offset drain well off the label — it stays centred, no needless lift. |
| `after-6-drain-linear.png` | Channel near the pan's top edge — no room above, so the pair drops below the channel callout. |
| `after-6-drain-module.png` | Neo module — the label already cleared the channel and doesn't move. |
