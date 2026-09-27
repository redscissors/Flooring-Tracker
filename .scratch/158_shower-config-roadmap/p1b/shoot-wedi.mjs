// Proof: ⇄ on every wedi line (ticket 158 Phase 1b) — the stepped curb
// popover with a draft and Δ, the curb choice re-fitting after a room change,
// the stepped wall-panel popover, the fastener-kit list swap, and a one-part
// line (PRO-SET) with no ⇄.
//   npx vite --port 5199 ; node .scratch/158_shower-config-roadmap/p1b/shoot-wedi.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const OUT = ".scratch/158_shower-config-roadmap/p1b";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 } });
let err = false; pg.on("pageerror", (e) => { console.error("PAGEERROR", e); err = true; });
const fail = (m) => { console.error("FAIL:", m); err = true; };
const shot = async (name) => { await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
const flat = (t) => t.replace(/\n+/g, " | ");
const popText = async () => flat(await pg.locator("[data-drain-swap]").innerText());
const line = (re) => pg.locator(".bline", { hasText: re }).first();
const lineText = async (re) => flat(await line(re).innerText());
const open = async (re) => { await line(re).locator(".swapb").click(); await pg.waitForTimeout(300); };
const land = async () => {
  await pg.locator("[data-wedi-add]").click();
  await pg.waitForSelector("[data-wedi-confirm]", { timeout: 5000 });
  await pg.locator("[data-wedi-confirm]").click(); await pg.waitForTimeout(600);
};
const reopen = async () => {
  await pg.locator("[data-sheet-reconfig]").first().click();
  await pg.waitForSelector(".stepper", { timeout: 5000 }); await pg.waitForTimeout(700);
};

await pg.goto("http://localhost:5199/wedi-preview.html");
await pg.waitForSelector("[data-wedi-pan]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(500); // Full catalog
await pg.locator("[data-wedi-pan='US9100004']").click(); await pg.waitForTimeout(800); // 36×60, 60" opening

// curb: Style → Length, a draft with its Δ; the bill holds until Use this
const curbBefore = await lineText(/Curb/);
console.log("bill curb:", curbBefore);
await open(/Curb/);
await pg.waitForSelector("[data-drain-swap]", { timeout: 5000 });
console.log("curb popover:", await popText());
await shot("w1-curb-popover");
await pg.locator('[data-drain-chip="Style:full"]').click(); await pg.waitForTimeout(300);
const fullText = await popText();
console.log("full draft:", fullText);
if (!/60" Full Foam Curb/.test(fullText) || /±0/.test(fullText)) fail("the Full draft lacks its curb or Δ");
if ((await lineText(/Curb/)) !== curbBefore) fail("the bill moved under a curb draft");
await pg.locator('[data-drain-chip="Style:at"]').click(); await pg.waitForTimeout(300);
if (!(await pg.locator('[data-drain-chip^="Profile:"]').count())) fail("AT shows no Profile row");
if (await pg.locator('[data-drain-chip="Length:96"]').isEnabled()) fail("AT's 96″ chip is not dashed");
await shot("w2-curb-at-draft");
// Esc discards the draft
await pg.keyboard.press("Escape"); await pg.waitForTimeout(400);
if (await pg.locator("[data-drain-swap]").count()) fail("Esc left the curb popover open");
if ((await lineText(/Curb/)) !== curbBefore) fail("Esc did not discard the curb draft");
await open(/Curb/);
await pg.locator('[data-drain-chip="Style:full"]').click();
await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(600);
const used = await lineText(/Curb/);
console.log("after Use this:", used);
if (!/60" Full Foam Curb/.test(used)) fail("Use this did not land the full-foam curb");

// a saved kit reopens on its curb choice, and re-saving keeps it
await land();
await reopen();
const reopened = await lineText(/Curb/);
console.log("reopened curb:", reopened);
if (!/60" Full Foam Curb/.test(reopened)) fail("the reopened kit lost its full-foam curb");
await open(/Curb/);
if (!/Style:full/.test(await pg.locator('[data-drain-chip^="Style:"].text-white').getAttribute("data-drain-chip"))) fail("the reopened curb popover does not light Full");
await pg.keyboard.press("Escape"); await pg.waitForTimeout(300);
await land();
await reopen();
if (!/60" Full Foam Curb/.test(await lineText(/Curb/))) fail("a re-save lost the full-foam curb");

// No curb: the line goes, and a saved kit reopens without it
await open(/Curb/);
await pg.locator('[data-drain-chip="Style:none"]').click(); await pg.waitForTimeout(300);
console.log("no-curb draft:", await popText());
await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(600);
if (await line(/Curb/).count()) fail("No curb left a curb line");
await land();
await reopen();
if (await line(/Curb/).count()) fail("the reopened no-curb kit shows a curb");
else console.log("reopened no-curb kit: no curb line");
await land();
await reopen();
if (await line(/Curb/).count()) fail("a re-save of the no-curb kit brought a curb back");

// a fresh popup for the room change
await pg.goto("http://localhost:5199/wedi-preview.html");
await pg.waitForSelector("[data-wedi-pan]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(500);
await pg.locator("[data-wedi-pan='US9100004']").click(); await pg.waitForTimeout(800);
await open(/Curb/);
await pg.locator('[data-drain-chip="Style:full"]').click();
await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(600);

// the room grows past 60″: the Full choice re-fits to 96″ rather than doubling the 60″
await pg.locator(".modetab", { hasText: "Custom shower" }).click(); await pg.waitForTimeout(500);
const wIn = pg.locator(".roomform .rinp").first();
await wIn.fill("72"); await wIn.press("Enter"); await pg.waitForTimeout(900);
const refit = await lineText(/Curb/);
console.log("after 72\" room:", refit);
if (!/96" Full Foam Curb/.test(refit)) fail("the Full curb did not re-fit to 96″");
await shot("w3-curb-refit-72");

// wall panel: One size shows its ⇄ — Type → Thickness → Size
await pg.locator(".pfseg button", { hasText: "One size" }).click(); await pg.waitForTimeout(400);
await open(/Building Panel/);
await pg.waitForSelector("[data-drain-swap]", { timeout: 5000 });
await pg.locator('[data-drain-chip="Type:vapor"]').click(); await pg.waitForTimeout(300);
const vap = await popText();
console.log("vapor draft:", vap);
if (!/Vapor 85/.test(vap)) fail("the Vapor 85 draft is not summarised");
await shot("w4-panel-vapor-draft");
await pg.locator('[data-drain-chip="Type:board"]').click();
await pg.locator('[data-drain-chip="Size:48x96"]').click(); await pg.waitForTimeout(300);
await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(600);
const panel = await lineText(/Building Panel/);
console.log("panel after Use this:", panel);
if (!/4'x8'x1\/2" Building Panel/.test(panel)) fail("Use this did not land the 4×8 panel");

// fastener kit: a list swap, one click; PRO-SET has one part — no ⇄
await open(/Fastener Kit/);
await shot("w5-fastener-list");
await pg.locator(".wedi-swap .srow", { hasText: "Tabless" }).click(); await pg.waitForTimeout(500);
console.log("fastener after pick:", await lineText(/Fastener Kit/));
if (!/Tabless/.test(await lineText(/Fastener Kit/))) fail("the tabless kit did not land");
if (await line(/PRO-SET/).locator(".swapb").count()) fail("the one-part PRO-SET line shows a ⇄");
await line(/PRO-SET/).evaluate((el) => el.scrollIntoView({ block: "center" }));
await shot("w6-install-lines");

// the fastener and panel picks survive a save and reopen
await land();
await reopen();
if (!/Tabless/.test(await lineText(/Fastener Kit/))) fail("the reopened kit lost its tabless fastener kit");
await pg.locator(".pfseg button", { hasText: "One size" }).click(); await pg.waitForTimeout(400);
if (!/4'x8'x1\/2" Building Panel/.test(await lineText(/Building Panel/))) fail("the reopened kit lost its 4×8 panel");
console.log("reopened: fastener", await lineText(/Fastener Kit/));

// Stock only: every panel row lists its stocked chips ahead of the special-order ones
await pg.goto("http://localhost:5199/wedi-preview.html");
await pg.waitForSelector("[data-wedi-pan]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-wedi-pan='US9100004']").click(); await pg.waitForTimeout(800);
await pg.locator(".pfseg button", { hasText: "One size" }).click(); await pg.waitForTimeout(400);
await open(/Building Panel/);
await pg.waitForSelector("[data-drain-swap]", { timeout: 5000 });
for (const row of ["Type", "Thickness", "Size"]) {
  const chips = await pg.locator(`[data-drain-chip^="${row}:"]`).evaluateAll((els) => els.map((e) => (e.querySelector("[data-so-dot]") ? "so:" : "") + e.dataset.drainChip.split(":")[1]));
  console.log(`stock-only ${row}:`, chips.join(" "));
  const firstSo = chips.findIndex((c) => c.startsWith("so:"));
  if (firstSo >= 0 && chips.slice(firstSo).some((c) => !c.startsWith("so:"))) fail(`${row} lists a stocked chip after a special-order one`);
}
await shot("w7-stock-first-panel");

// a pre-1b marker (curbKey only, the 96″ lean on a 60″ opening) reopens on that curb
const legacy = { mode: "kits", cfg: { panKey: "US9100004", curbKey: "US3000040", source: "all", walls: [
  { side: "back", len: 60, h: 96 }, { side: "left", len: 36, h: 96 }, { side: "right", len: 36, h: 96 }] } };
await pg.goto("http://localhost:5199/wedi-preview.html?seed=" + encodeURIComponent(JSON.stringify(legacy)));
await pg.waitForSelector(".stepper", { timeout: 20000 }); await pg.waitForTimeout(800);
const legacyCurb = await lineText(/Curb/);
console.log("pre-1b curbKey marker:", legacyCurb);
if (!/^96" Lean Curb .* cut to 60" \| ⇄ \| − \| 1 \|/.test(legacyCurb)) fail("the pre-1b marker did not reopen on its 96″ lean curb");
await open(/Curb/);
await pg.waitForSelector("[data-drain-swap]", { timeout: 5000 });
const lit = await pg.locator('[data-drain-chip].text-white').evaluateAll((els) => els.map((e) => e.dataset.drainChip));
console.log("pre-1b curb popover lit:", lit.join(" "), "|", await popText());
if (!lit.includes("Style:lean") || !lit.includes("Length:96")) fail("the pre-1b curb popover does not light Lean and 96″");
await shot("w8-legacy-curbkey-reopen");
await pg.keyboard.press("Escape"); await pg.waitForTimeout(300);

// a Browse-only build (no pan): its curb, fastener-kit and sealant lines take no ⇄ (they would write opts it ignores)
await pg.goto("http://localhost:5199/wedi-preview.html");
await pg.waitForSelector("[data-wedi-pan]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(500);
await pg.locator(".modetab", { hasText: "Browse" }).click(); await pg.waitForTimeout(500);
for (const [sec, row] of [[/^Curbs/, /Lean/], [/^Fasteners/, /Tabless/], [/^Sealant/, /Joint Sealant/i]]) {
  await pg.locator(".ft-hopt", { hasText: sec }).click(); await pg.waitForTimeout(300);
  await pg.locator(".brow", { hasText: row }).first().locator(".stepper button", { hasText: "+" }).click(); await pg.waitForTimeout(300);
}
await pg.waitForSelector(".bline", { timeout: 5000 });
for (const re of [/Curb/, /Fastener/, /Joint Sealant/i]) {
  const n = await line(re).count() ? await line(re).locator(".swapb").count() : -1;
  console.log(`browse-only ${re}:`, n < 0 ? "no line" : n ? "⇄" : "no ⇄", "|", n < 0 ? "" : await lineText(re));
  if (n < 0) fail(`the Browse-only build has no ${re} line`);
  if (n > 0) {
    fail(`the Browse-only ${re} line shows a ⇄`);
    await line(re).locator(".swapb").click(); await pg.waitForTimeout(400);
    await pg.keyboard.press("Escape"); await pg.waitForTimeout(200);
  }
}
await shot("w9-browse-only-no-swap");

await b.close();
if (err) process.exit(1);
