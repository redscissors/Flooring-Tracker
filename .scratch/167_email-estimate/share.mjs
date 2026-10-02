// The touch path with navigator.share mocked: (1) share accepted, (2) Safari's
// refusal after the build (NotAllowedError) → the one-tap Share button.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW || "/opt/node22/lib/node_modules/playwright");
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
for (const refuseFirst of [false, true]) {
  const page = await browser.newPage({ viewport: { width: 820, height: 1180 } });
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  await page.addInitScript((refuse) => {
    let calls = 0;
    navigator.canShare = (d) => !!d?.files?.length;
    navigator.share = async (d) => {
      calls++;
      if (refuse && calls === 1) throw new DOMException("no activation", "NotAllowedError");
      window.__shared = { calls, name: d.files[0].name, type: d.files[0].type, size: d.files[0].size, title: d.title, text: d.text };
    };
  }, refuseFirst);
  await page.goto("http://localhost:5199/.scratch/167_email-estimate/preview.html?share=1", { waitUntil: "networkidle" });
  await page.click("#go");
  if (refuseFirst) {
    const btn = page.getByRole("button", { name: "Share estimate PDF" });
    await btn.waitFor({ timeout: 30000 });
    await page.screenshot({ path: join(dir, "share-retry.png"), clip: { x: 0, y: 980, width: 820, height: 200 } });
    await btn.click();
  }
  await page.waitForFunction(() => window.__result && window.__result !== "running", null, { timeout: 30000 });
  console.log(refuseFirst ? "refused first:" : "accepted:", await page.evaluate(() => window.__result), JSON.stringify(await page.evaluate(() => window.__shared)));
  await page.close();
}
await browser.close();
