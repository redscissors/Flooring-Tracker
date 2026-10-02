import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { domToCanvas } from "modern-screenshot";
import { jsPDF } from "jspdf";

// Letter with the print sheet's 1.4cm @page margin (index.css), so the PDF
// paginates like the printed estimate.
const PAGE_W_MM = 215.9, PAGE_H_MM = 279.4, MARGIN_MM = 14;
const CONTENT_W_MM = PAGE_W_MM - 2 * MARGIN_MM, CONTENT_H_MM = PAGE_H_MM - 2 * MARGIN_MM;
const PX_PER_MM = 96 / 25.4;
const CONTENT_W_PX = Math.round(CONTENT_W_MM * PX_PER_MM);
const PAGE_PX = CONTENT_H_MM * PX_PER_MM;
const SCALE = 2;

// Page cuts honor the sheet's break-inside: avoid blocks the way the print
// engine does; a block taller than a page can't be kept whole, so it doesn't
// block cuts through its own rows.
function pageCuts(node) {
  const top0 = node.getBoundingClientRect().top;
  const total = node.scrollHeight;
  const spans = [];
  node.querySelectorAll("*").forEach((el) => {
    if (getComputedStyle(el).breakInside !== "avoid") return;
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.height < PAGE_PX) spans.push([r.top - top0, r.bottom - top0]);
  });
  const safe = (y) => !spans.some(([a, b]) => a < y - 0.5 && y + 0.5 < b);
  const marks = [...new Set(spans.flat().map((y) => Math.round(y)))].sort((a, b) => b - a);
  const cuts = [0];
  let start = 0;
  while (total - start > PAGE_PX) {
    const limit = start + PAGE_PX;
    const best = marks.find((y) => y <= limit && y > start + PAGE_PX * 0.3 && safe(y));
    start = best ?? Math.floor(limit);
    cuts.push(start);
  }
  cuts.push(total);
  return cuts;
}

// The page's Google Fonts <link> is cross-origin, so the screenshot library
// can't read its rules and would draw the sheet in a fallback face — wider
// than the Manrope it was laid out in, so headings wrap over the next line.
// Fetch that stylesheet (Google serves it with CORS) and inline the latin
// Manrope files instead.
let fontCss;
async function manropeCss() {
  const link = document.querySelector('link[rel="stylesheet"][href*="fonts.googleapis.com"]');
  if (!link) return "";
  const css = await (await fetch(link.href)).text();
  const blocks = css.split(/(?=\/\*\s*[\w-]+\s*\*\/)/).filter((b) => /\/\*\s*latin(-ext)?\s*\*\//.test(b) && /font-family:\s*['"]?Manrope/.test(b));
  const data = new Map();
  for (const url of new Set(blocks.join("").match(/https:[^)'"]+/g) || [])) {
    const blob = await (await fetch(url)).blob();
    data.set(url, await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); }));
  }
  return blocks.join("").replace(/https:[^)'"]+/g, (u) => data.get(u) || u);
}

async function renderPdf(paper) {
  fontCss ??= manropeCss().catch(() => { fontCss = undefined; return ""; });
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-20000px;top:0;pointer-events:none";
  const sheet = document.createElement("div");
  sheet.className = "ft-light ft-ink bg-white text-black";
  sheet.style.width = CONTENT_W_PX + "px";
  host.appendChild(sheet);
  document.body.appendChild(host);
  const root = createRoot(sheet);
  try {
    flushSync(() => root.render(paper));
    await document.fonts?.ready;
    await Promise.all([...sheet.querySelectorAll("img")].map((img) => img.decode().catch(() => {})));
    const cuts = pageCuts(sheet);
    const cssText = await fontCss;
    const canvas = await domToCanvas(sheet, { scale: SCALE, backgroundColor: "#ffffff", width: CONTENT_W_PX, height: sheet.scrollHeight, ...(cssText ? { font: { cssText } } : {}) });
    const pdf = new jsPDF({ unit: "mm", format: "letter" });
    const mmPerPx = CONTENT_W_MM / CONTENT_W_PX;
    for (let i = 0; i < cuts.length - 1; i++) {
      const y = cuts[i] * SCALE, h = Math.ceil((cuts[i + 1] - cuts[i]) * SCALE);
      const page = document.createElement("canvas");
      page.width = canvas.width;
      page.height = h;
      const ctx = page.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, page.width, h);
      ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      if (i > 0) pdf.addPage();
      pdf.addImage(page.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN_MM, MARGIN_MM, CONTENT_W_MM, (h / SCALE) * mmPerPx);
    }
    return pdf.output("blob");
  } finally {
    root.unmount();
    host.remove();
  }
}

export function mailtoUrl(to, subject, body) {
  const enc = encodeURIComponent;
  const q = [`subject=${enc(subject)}`, ...(body ? [`body=${enc(body.replace(/\n/g, "\r\n"))}`] : [])].join("&");
  return `mailto:${enc(to).replace(/%40/g, "@")}?${q}`;
}

// Safari drops the click's user activation while the PDF builds, so the first
// share attempt can be refused — this one-tap button carries a fresh gesture.
function shareButton(data) {
  return new Promise((resolve) => {
    const btn = document.createElement("button");
    btn.textContent = "Share selections PDF";
    btn.className = "fixed left-1/2 -translate-x-1/2 bottom-6 z-[100] rounded-full bg-indigo-600 text-white text-sm font-bold px-5 py-2.5 shadow-lg";
    const done = (r) => { btn.remove(); clearTimeout(t); resolve(r); };
    const t = setTimeout(() => done("cancelled"), 20000);
    btn.onclick = () => navigator.share(data).then(() => done("shared"), () => done("cancelled"));
    document.body.appendChild(btn);
  });
}

// Browsers can't attach a file to a mailto: email. Touch devices hand the PDF
// to the system share sheet (attached, but no recipient slot); computers save
// the PDF and open a pre-addressed email to drag it into.
export async function emailEstimate({ paper, to, subject, body, filename, share }) {
  const blob = await renderPdf(paper);
  const file = new File([blob], filename, { type: "application/pdf" });
  const data = { files: [file], title: subject, ...(body ? { text: body } : {}) };
  if (share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") return "cancelled";
      if (e?.name === "NotAllowedError") return shareButton(data);
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  await new Promise((r) => setTimeout(r, 400));
  window.location.href = mailtoUrl(to, subject, body);
  return "saved";
}
