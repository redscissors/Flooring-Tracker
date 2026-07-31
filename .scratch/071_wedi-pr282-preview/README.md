# PR 282 round 2 — preview proof

Four owner reports on the wedi configurator. Shots drive the REAL
`WediConfigurator` through `wedi-preview.html`:

```
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx vite --port 5199
node .scratch/071_wedi-pr282-preview/shoot.mjs
```

| Shot | What it proves |
|---|---|
| `A1-58x33-closest-fit` | **Issue 1.** The owner's repro — 58×33 curbed, Offset preference, drain pinned 6″ × 16½″ — used to show "No option fits". Three **Closest fit** cards now, each warning `drain lands at 12", 16 1/2" — 6" off the requested spot; move the waste line or accept` and `no offset-drain base fits this room — this is a center-drain base floated to the plumbing`. |
| `B1-36x72-neo-module-wall` | **Issue 2.** 36×72 Linear: the neo module against the wall + its 36″ extension cut to 66¼″, channel drawn and labelled. |
| `B2/B3 …-neo-module-centred` | wedi's second modular layout — module mid-floor, an extension leading away from either side; the channel draws mid-floor in plan and isometric with the 2″ waste dimensioned off both walls. |
| `C1-36x100-centred-only` | 100″ of depth is past one extension's reach (5¾ + 66¾), so only the centred layout solves — a room that returned nothing before. |
| `D1-US9310001-channel` | **Issue 3.** The one-piece 36×60 Fundo Linear base draws its channel where the 2026 pricelist dimensions it: along the 60″ wall, 6″ in, centred (30″), 43 19/64″ long. |
| `E1-fall-arrows-third` | **Issue 4.** Pan fall arrows at a third of their old drawn length (extension arrows unchanged). |
| `G1-module-on-side-wall` | 36×48 Linear: the module runs the back wall OR a side wall — the side-wall card draws its channel down the room with the label turned. |
| `F1-kits-module-pick` | Picking a neo module straight from Kits now draws its channel AND its extension module, and the kit lists the extension (a lone 5¾″ module is not a floor). Channel lengths on the cards are the pricelist's: 42″→35 7/16″, 54″→43 5/16″. |
| `H1-max-framed-bench-*` | **Owner round 3.** "Max — curb inside" + a framed bench reaching the entry: the bench body stopped at pan height over bare subfloor (white gap under its face) and the inset curb's butt end hung open beside it. After: the framed body carries to the subfloor across the curb zone and the curb butts it flush; the rust cut mark stops at the inset pan edge. |
| `H2-max-buildup-bench-*` | **Owner round 3.** "Max — curb inside" + a 2″ build-up bench: the inside curb sliced through the bench front (bench drew before the curb, bottom flat at pan height). After: the bench steps up onto the curb top at the curb's inner edge and draws over it, same junction the outset ring already had. Ring-mode drawings byte-identical before/after (14-shot pixel diff). |
