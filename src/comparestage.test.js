import { test } from "node:test";
import assert from "node:assert/strict";
import { FIXTURE_ITEMS } from "./schluterfixture.js";
import { catalogOf } from "./schluter.js";
import { wediBuildFor, schluterBuildFor } from "./comparekit.js";
import { CELLS, hostCellKey, cellBuild, stageEntryFor } from "./comparegrid.js";
import { entryView } from "./basketkit.js";
import { normKitBasketEntry } from "./model.js";

// "+ Basket" on a house column must stage the build the column prices, not a
// dearer one (final review 2026-09-29).
const CAT = catalogOf(FIXTURE_ITEMS);
const room = (w, d) => ({ w, d, curbed: true, drain: "point",
  walls: ["back", "left", "right"].map((side) => ({ side, on: true, len: side === "back" ? w : d, h: 84 })) });
const level = { tier: "retail", customPct: "", salePct: 10, bPct: 18, panelFit: true };
const vctx = { wedi: level, schluter: { ...level, bPct: 8, cat: CAT, catReady: true } };

test("a staged house column prices at the column's retail total", () => {
  const seen = new Set();
  for (const [w, d] of [[60, 36], [72, 42], [60, 38], [48, 48]]) {
    const r = room(w, d);
    for (const hostBrand of ["wedi", "schluter"]) {
      let hostBuild, hostCfg;
      if (hostBrand === "wedi") { hostBuild = wediBuildFor(r); hostCfg = hostBuild && hostBuild.cfg; }
      else ({ build: hostBuild, cfg: hostCfg } = schluterBuildFor(r, CAT));
      const ctx = { hostBrand, hostKey: hostCellKey(hostBrand, hostCfg), hostBuild, hostCfg, room: r, roomOk: true,
        ready: { wedi: true, schluter: true }, cat: CAT, source: "all", tier: "retail", mortarItem: null, wPct: 18, sPct: 8 };
      for (const { key } of CELLS) {
        const c = cellBuild(key, ctx, {});
        if (c.live || !c.rows.length) continue;
        seen.add(key);
        const v = entryView(normKitBasketEntry(stageEntryFor(c, "all")), vctx);
        assert.equal(v.price, c.totals.retail, `${w}×${d} from ${hostBrand}: ${key}`);
      }
    }
  }
  assert.deepEqual([...seen].sort(), CELLS.map((c) => c.key).sort());
});
