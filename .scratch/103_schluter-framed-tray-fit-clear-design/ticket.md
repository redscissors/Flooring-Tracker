Status: done

# Schluter round 5 — framed bench keeps the tray, Smaller-tray opt-in, bench → Custom tab, Clear design

Owner asks (2026-08-24, voice): "when choosing a framed bench, the pan should
actually stay the same and shouldn't move unless the button … just like the
wedi configurator that gives the option to reconfigure with a smaller pan.
And that should try to follow the center drain on the smaller area unless the
drain dimensions are entered to be somewhere else. Also, once a bench is
selected, it should bump you over into the custom shower solver. Also there's
no clear design button up at the top — the wedi one has it."

## What landed

- **`trayFit` — the wedi panFit fork** (schluter.js): a framed bench row now
  carries `trayFit: "cut" | "smaller"` (normBench, default "cut"). Under
  "cut" the tray choice never moves — trayCandidates ranks the FULL room and
  the bench face cut is a site cut buildKit notes ("cut down to W×D — stops
  at the framed bench face" even on an exact full-room fit). "Smaller tray"
  (the bench menu's new seg beside Build) re-runs the ranking in the clear
  space, and with no typed drainX/Y it auto-pins the clear space's CENTRE
  (`cand.centered`) so the re-fit chases a centred drain; typed dimensions
  always win. The option cards, cut list and drawing warnings say "centred
  in the clear space" instead of pin language for the auto case, and a kept
  tray whose drain ends up behind the bench face draws a warning
  (schluterdraw.js). Marker compat: old framed-bench markers (2 days old at
  most, round 3) reopen as "cut" — the wedi default — so their tray no longer
  silently re-ranks.
- **Bench add bumps to the Custom shower tab** — from the drawing's zone menu
  and the Add-ons Bench picker alike (the bench is room tuning; edits and
  removes don't switch tabs).
- **"Clear design" in the pop-head** left of the Source switch (the wedi
  header action): wipes the whole build — room to the 60×38 default, walls,
  benches, corners, drain pin, add-ons, hand-stepped quantities — and
  `pickKit` now resets through it.

## Proof

shoot.mjs (this dir): p1 framed bench added from the chip — popup lands on
the Custom tab, the exact 5'×38" tray STAYS picked and its line reads "cut
down to 5'×2' — stops at the framed bench face", Clear design in the header ·
p2 the bench menu's "Cut it down | Smaller tray" seg (cut default, kept-tray
note) · p3 Smaller tray on — options re-rank for the clear 5'×2', cards say
"Drain centred in the clear space" · p4 Clear design back to the bare
default. Tests: 1098 pass (new: cut-default ranking pinned unchanged vs
no-bench; smaller re-fit auto-centres dy=26 & typed pin wins; normBench
trayFit; drain-under-bench warning).
