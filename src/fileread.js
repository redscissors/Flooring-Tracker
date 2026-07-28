// Shared file readers for every import path (the shop workbook, a registry
// book's wizard, and the multi-file drop router) — parse an .xlsx into
// arrays-of-arrays sheets, or a text .pdf into per-page positioned text items.
// xlsx and pdfjs are lazy-loaded so they never weigh on first paint.
export async function readXlsxSheets(file) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return wb.SheetNames.map((name) => ({ name, rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null }) }));
}
// A portal can serve a PDF down an .xls-named link (OVF's TrueTouch list), so
// import paths pick their reader by content, not name: the PDF spec puts
// "%PDF-" within the first 1024 bytes.
export async function looksPdf(file) {
  try {
    const b = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
    for (let i = 0; i + 4 < b.length; i++) {
      if (b[i] === 0x25 && b[i + 1] === 0x50 && b[i + 2] === 0x44 && b[i + 3] === 0x46 && b[i + 4] === 0x2d) return true;
    }
  } catch {}
  return false;
}
export async function readPdfPages(file) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vh = page.getViewport({ scale: 1 }).height; // pdf y is bottom-up; flip to top-down
    const content = await page.getTextContent();
    pages.push(content.items.filter((i) => i.str && i.str.trim()).map((i) => ({ str: i.str, x: i.transform[4], y: vh - i.transform[5], w: i.width })));
  }
  return pages;
}
