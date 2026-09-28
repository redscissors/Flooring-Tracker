import { test } from "node:test";
import assert from "node:assert/strict";
import { FIXTURE_ITEMS } from "./schluterfixture.js";
import { catalogOf } from "./schluter.js";
import { wediBuildFor, schluterBuildFor } from "./comparekit.js";
import { hostCellKey, cellBuild } from "./comparegrid.js";
import { GRID } from "./comparegridgolden.js";

// Ticket 158 Phase 3: what every cell of the four-way grid priced, chipped and
// billed when it landed, from either brand's host.
const CAT = catalogOf(FIXTURE_ITEMS);
// the golden was pinned in Phase 3's reading order; Phase 4 moved the columns,
// not the prices
const GOLDEN_ORDER = ["wedi:board", "schluter:board", "wedi:membrane", "schluter:membrane"];
const bag = (lines) => {
  const q = new Map();
  (lines || []).filter((l) => !l.noteOnly).forEach((l) => { const k = l.item.key || l.item.sku || l.item.name; q.set(k, (q.get(k) || 0) + l.qty); });
  return [...q].map(([k, n]) => k + "x" + n).sort().join(" ");
};
const room = ([w, d, curbed, drain]) => ({ w, d, curbed, drain,
  walls: ["back", "left", "right"].map((side) => ({ side, on: true, len: side === "back" ? w : d, h: 84 })) });

test("every grid cell prices, chips and bills as when it landed", () => {
  for (const [spec, hostBrand, cells] of GRID) {
    const r = room(spec);
    let hostBuild, hostCfg;
    if (hostBrand === "wedi") { hostBuild = wediBuildFor(r); hostCfg = hostBuild && hostBuild.cfg; }
    else ({ build: hostBuild, cfg: hostCfg } = schluterBuildFor(r, CAT));
    const ctx = { hostBrand, hostKey: hostCellKey(hostBrand, hostCfg), hostBuild, hostCfg, room: r, roomOk: true,
      ready: { wedi: true, schluter: true }, cat: CAT, source: "all", tier: "retail", mortarItem: null, wPct: 18, sPct: 8 };
    GOLDEN_ORDER.forEach((key, i) => {
      const x = cellBuild(key, ctx);
      assert.deepEqual([x.totals.retail, x.totals.builder, x.flags.map((f) => f.id).join(","), bag(x.build && x.build.lines)],
        cells[i], `${spec.join(" ")} from ${hostBrand}: ${key}`);
    });
  }
});

test("a room reads the same from either host: the grid is symmetric on house kits", () => {
  for (let i = 0; i < GRID.length; i += 2) assert.deepEqual(GRID[i][2], GRID[i + 1][2], GRID[i][0].join(" "));
});
