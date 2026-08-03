import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const [w,h] of [[1440,900],[1680,980],[1920,1080],[2560,1440]]) {
  const pg = await b.newPage({ viewport: { width: w, height: h } });
  await pg.goto("http://127.0.0.1:5199/wedi-preview.html", { waitUntil: "load" });
  await pg.waitForTimeout(900);
  await pg.locator(".modetab", { hasText: "Custom shower" }).click();
  await pg.waitForTimeout(700);
  const m = await pg.evaluate(() => {
    const f = document.querySelector(".roomform"), d = document.querySelector(".diagcol");
    const g = [...document.querySelectorAll(".rfgrp")].map((e) => Math.round(e.getBoundingClientRect().width));
    return { form: Math.round(f.getBoundingClientRect().height), groups: g,
             main: Math.round(document.querySelector(".main").getBoundingClientRect().width),
             rail: Math.round(d.getBoundingClientRect().width), sh: d.scrollHeight, ch: d.clientHeight };
  });
  console.log(w+"x"+h, JSON.stringify(m));
  await pg.close();
}
await b.close();
