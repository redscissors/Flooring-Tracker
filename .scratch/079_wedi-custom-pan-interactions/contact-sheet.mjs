// Builds one page holding every drawing the wedi rail can produce right now,
// each numbered, so the owner can point at a corner by name instead of cropping
// a 16px thumbnail. The SVGs are lifted out of the live page, so this is the
// real drawing, not a screenshot of one — it stays sharp at any zoom.
//   node .scratch/079_wedi-custom-pan-interactions/contact-sheet.mjs
import { chromium } from "playwright";
import { writeFileSync, readFileSync } from "node:fs";

const OUT = ".scratch/079_wedi-custom-pan-interactions";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1680, height: 980 } });
await pg.goto("http://127.0.0.1:5199/wedi-preview.html", { waitUntil: "load" });
await pg.waitForTimeout(1200);
await pg.locator(".pancard").nth(2).click();
await pg.waitForTimeout(700);
await pg.locator(".modetab", { hasText: "Custom shower" }).click();
await pg.waitForTimeout(500);

const grab = () => pg.evaluate(() => [...document.querySelectorAll(".diagcol svg")].map((s) => s.outerHTML));

const cases = [];
const take = async (n, title, note) => { cases.push({ n, title, note, svg: await grab() }); };

await take(1, "Curbed alcove · back + left + right", "the everyday one — a curb across the entry");
await pg.locator(".rseg button", { hasText: "Curbless" }).click();
await pg.waitForTimeout(900);
await take(2, "Curbless · back + left + right", "no curb at all — nothing should reach past the pan line");
await pg.locator(".rseg button", { hasText: "Curbed" }).click();
await pg.waitForTimeout(800);
await pg.locator(".wallrow .wname", { hasText: "Back" }).click();
await pg.waitForTimeout(900);
await take(3, "Curbed · back wall OFF", "the curb runs the back edge too, into the ends of the side walls");
await pg.locator(".wallrow .wname", { hasText: "Back" }).click();
await pg.waitForTimeout(600);
await pg.locator(".rseg button", { hasText: "Max — curb inside" }).click();
await pg.waitForTimeout(900);
await take(4, "Curbed · Max — curb inside", "the curb sits INSIDE the stated line, so nothing reaches past it");
await pg.locator(".rseg button", { hasText: "Pan size" }).click();
await pg.waitForTimeout(700);
await pg.locator(".wallrow .wname", { hasText: "Right" }).click();
await pg.waitForTimeout(900);
await take(5, "Curbed · right wall OFF", "the curb turns the corner and runs the right edge as well");

await pg.close();
await b.close();

const b64 = (p) => "data:image/png;base64," + readFileSync(p).toString("base64");
const html = `<title>wedi drawings — where they stand</title>
<style>
 body{font:14px/1.5 Manrope,system-ui,sans-serif;background:#F6F4EE;color:#1C1A17;margin:0;padding:22px}
 h1{font-size:19px;margin:0 0 2px} .lede{color:#57534C;margin:0 0 20px;max-width:62em}
 .case{background:#fff;border:1px solid #DDD8CC;border-radius:12px;padding:14px 16px 16px;margin-bottom:16px}
 .ch{display:flex;align-items:baseline;gap:10px;margin-bottom:8px}
 .num{background:#40542A;color:#fff;font-weight:800;font-size:12px;border-radius:6px;padding:2px 8px}
 .ct{font-weight:800;font-size:15px} .cn{color:#8A8378;font-size:12.5px}
 .pair{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
 .d{min-width:0} .dl{font-size:10px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#57534C;margin-bottom:4px}
 .d svg{width:100%;height:auto;background:#FBFAF5;border:1px solid #DDD8CC;border-radius:8px}
 .ui{background:#fff;border:1px solid #DDD8CC;border-radius:12px;padding:14px 16px 16px;margin-bottom:16px}
 .ui img{width:100%;height:auto;border:1px solid #DDD8CC;border-radius:8px;display:block;margin-top:6px}
 @media (prefers-color-scheme:dark){body{background:#16150F;color:#EFEADF}
  .case,.ui{background:#211F18;border-color:#3A362C}.cn{color:#9A9284}.lede{color:#B7B0A2}}
</style>
<h1>wedi drawings — every configuration, at a size you can point at</h1>
<p class="lede">The plan and the isometric for five wall/curb setups, lifted live out of the
configurator (real SVG, so zoom in as far as you like). Say the case number and the corner —
"3, the back-left" — and I'll know exactly what you mean. Under them: how the four changes look.</p>
${cases.map((c) => `<div class="case">
 <div class="ch"><span class="num">${c.n}</span><span class="ct">${c.title}</span><span class="cn">${c.note}</span></div>
 <div class="pair">
  <div class="d"><div class="dl">${c.n}a · plan (top down)</div>${c.svg[0]}</div>
  <div class="d"><div class="dl">${c.n}b · isometric</div>${c.svg[1] || ""}</div>
 </div></div>`).join("\n")}
<div class="ui"><div class="ch"><span class="num">A</span><span class="ct">The toggle moves the drawing</span>
 <span class="cn">a kit, straight to Custom shower, one click on "Max — curb inside" — no card picked, no size retyped</span></div>
 <img src="${b64(OUT + "/shots/2-max-curb-inside.png")}" alt="Custom shower tab with Max — curb inside on"></div>
<div class="ui"><div class="ch"><span class="num">B</span><span class="ct">The wall editor, in the Walls group</span>
 <span class="cn">rows flow two across; Default height rides the chips line</span></div>
 <img src="${b64(OUT + "/shots/5-wall-editor-in-form.png")}" alt="the Walls group with the wall editor in it"></div>
<div class="ui"><div class="ch"><span class="num">C</span><span class="ct">The build column, editor gone</span>
 <span class="cn">Fit | One size stayed — it picks a sheet plan, so it sits with the lines it changes</span></div>
 <img src="${b64(OUT + "/shots/6-build-column.png")}" alt="the build column"></div>
`;
writeFileSync(OUT + "/drawings.html", html);
console.log("wrote", OUT + "/drawings.html", (html.length / 1024).toFixed(0) + "kb");
