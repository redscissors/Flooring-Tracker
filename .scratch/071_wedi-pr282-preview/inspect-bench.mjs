import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 } });
const errs = [];
pg.on("pageerror", (e) => errs.push(String(e)));

const scenario = process.argv[2] || JSON.stringify([{ kind: "wall", side: "left", build: "site" }]);
const url = "http://localhost:5199/wedi_harness.html?benches=none&curbKey=" + (process.argv[3] || "US3000039") + "&bjson=" + encodeURIComponent(scenario);
await pg.goto(url, { waitUntil: "load" });
await pg.waitForTimeout(1200);

const out = await pg.evaluate(() => {
  const svgs = [...document.querySelectorAll(".diagcol svg")];
  const iso = svgs[1];
  const rows = [];
  [...iso.querySelectorAll("polygon, line")].forEach((el) => {
    const f = el.getAttribute("fill"), s = el.getAttribute("stroke");
    const key = el.getAttribute("data-key") || "";
    if (el.tagName === "polygon") rows.push(["poly", f, s, el.getAttribute("points")]);
    else rows.push(["line", s, el.getAttribute("stroke-dasharray") || "", `${el.getAttribute("x1")},${el.getAttribute("y1")} -> ${el.getAttribute("x2")},${el.getAttribute("y2")}`]);
  });
  return rows;
});
out.forEach((r, i) => console.log(i, JSON.stringify(r)));
console.log("errors:", errs);
await b.close();
