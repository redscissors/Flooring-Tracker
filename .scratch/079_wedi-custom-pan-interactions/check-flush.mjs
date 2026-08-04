// Proves the rule numerically rather than by eye: in the PLAN, every wall band
// ends exactly on the outer face of the curb it meets — and in "overall max",
// where the curb and its tile sit inside the stated line, exactly on the line.
//   node .scratch/079_wedi-custom-pan-interactions/check-flush.mjs
import { chromium } from "playwright";

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1680, height: 980 } });
await pg.goto("http://127.0.0.1:5199/wedi-preview.html", { waitUntil: "load" });
await pg.waitForTimeout(1200);
await pg.locator(".pancard").nth(2).click();
await pg.waitForTimeout(700);
await pg.locator(".modetab", { hasText: "Custom shower" }).click();
await pg.waitForTimeout(500);

// The plan's own SVG units: the pan rect is the room, the wband rects are the
// walls, and the curb bands are the beige polygons.
const read = () => pg.evaluate(() => {
  const svg = document.querySelector(".diagcol svg");
  const rects = [...svg.querySelectorAll("rect")];
  const pan = rects.find((e) => e.getAttribute("fill") === "#DCE5CD");
  const R = (e) => ({ x0: +e.getAttribute("x"), y0: +e.getAttribute("y"),
    x1: +e.getAttribute("x") + +e.getAttribute("width"), y1: +e.getAttribute("y") + +e.getAttribute("height") });
  const room = R(pan);
  const walls = rects.filter((e) => e.classList.contains("wband")).map(R);
  const curbs = [...svg.querySelectorAll("polygon")]
    .filter((e) => /^#(E4DDCB|E9E3D3)$/i.test(e.getAttribute("fill") || ""))
    .map((e) => {
      const p = e.getAttribute("points").trim().split(/\s+/).map((s) => s.split(",").map(Number));
      return { x0: Math.min(...p.map((q) => q[0])), y0: Math.min(...p.map((q) => q[1])),
        x1: Math.max(...p.map((q) => q[0])), y1: Math.max(...p.map((q) => q[1])) };
    });
  return { room, walls, curbs };
});

const r2 = (n) => Math.round(n * 100) / 100;
let bad = 0;
const check = async (label) => {
  const { room, walls, curbs } = await read();
  const horiz = (r) => r.x1 - r.x0 > r.y1 - r.y0;
  // How far each side's curb stands past the room line…
  const side = (r) => (horiz(r)
    ? ((r.y0 + r.y1) / 2 < (room.y0 + room.y1) / 2 ? "back" : "entry")
    : ((r.x0 + r.x1) / 2 < (room.x0 + room.x1) / 2 ? "left" : "right"));
  const past = { back: 0, entry: 0, left: 0, right: 0 };
  curbs.forEach((c) => {
    const s = side(c);
    const d = s === "back" ? room.y0 - c.y0 : s === "entry" ? c.y1 - room.y1
      : s === "left" ? room.x0 - c.x0 : c.x1 - room.x1;
    past[s] = Math.max(past[s], d);
  });
  // …against how far the walls RUNNING INTO that side reach. A curb butts the
  // wall end-on, so it is the perpendicular walls that have to get there: the
  // side walls meet the back/entry curbs, the back/entry walls meet the side ones.
  const reach = { back: 0, entry: 0, left: 0, right: 0 };
  walls.forEach((w) => {
    if (horiz(w)) {
      reach.left = Math.max(reach.left, room.x0 - w.x0);
      reach.right = Math.max(reach.right, w.x1 - room.x1);
    } else {
      reach.back = Math.max(reach.back, room.y0 - w.y0);
      reach.entry = Math.max(reach.entry, w.y1 - room.y1);
    }
  });
  // Measured off the PAN rect, so in "overall max" the curb reads as standing
  // past the pan (it does) while both it and the wall stay inside the stated
  // line. A surplus is the TILE: the curb's bare face sits a tile's thickness
  // inside the wall, which is what puts the FINISHED face flush with it.
  const rows = ["back", "entry", "left", "right"].filter((k) => past[k] > 0.01).map((k) => {
    const c = r2(past[k]), w = r2(reach[k]);
    const ok = w >= c - 0.15;
    if (!ok) bad += 1;
    const over = r2(w - c);
    return `${k} curb ${c} · wall ${w} ${!ok ? "✗ SHORT by " + r2(c - w)
      : over > 0.15 ? `✓ flush with the tiled face (+${over} = tile)` : "✓ flush"}`;
  });
  console.log(label.padEnd(24), rows.length ? rows.join("  |  ") : "no curb stands past the line — nothing to reach ✓");
};

await check("1 curbed, 3 walls");
await pg.locator(".rseg button", { hasText: "Curbless" }).click();
await pg.waitForTimeout(900);
await check("2 curbless");
await pg.locator(".rseg button", { hasText: "Curbed" }).click();
await pg.waitForTimeout(800);
await pg.locator(".wallrow .wname", { hasText: "Back" }).click();
await pg.waitForTimeout(900);
await check("3 back wall off");
await pg.locator(".wallrow .wname", { hasText: "Back" }).click();
await pg.waitForTimeout(600);
await pg.locator(".rseg button", { hasText: "Max — curb inside" }).click();
await pg.waitForTimeout(900);
await check("4 max — curb inside");
const tile = pg.locator(".rfgrp", { hasText: "Size & curb" }).locator(".rinp.tin");
await tile.fill("3/8");
await tile.press("Enter");
await pg.waitForTimeout(900);
await check("4b max + 3/8 tile");
await pg.locator(".rseg button", { hasText: "Pan size" }).click();
await pg.waitForTimeout(800);
await pg.locator(".wallrow .wname", { hasText: "Right" }).click();
await pg.waitForTimeout(900);
await check("5 right wall off");

await pg.close();
await b.close();

process.exitCode = bad ? 1 : 0;
console.log(bad ? bad + " side(s) still short" : "every wall meets its curb");
