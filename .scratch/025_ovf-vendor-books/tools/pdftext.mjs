import { createRequire } from 'module'
import fs from 'fs'
const require = createRequire('file:///C:/Users/User/OneDrive/Documents/Claude%20ReadWrite/Flooring-Tracker/package.json')
const pdfjs = await import('file:///C:/Users/User/OneDrive/Documents/Claude%20ReadWrite/Flooring-Tracker/node_modules/pdfjs-dist/legacy/build/pdf.mjs')

const file = process.argv[2]
const only = process.argv[3] ? Number(process.argv[3]) : null
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), useSystemFonts: true }).promise
console.log('PAGES:', doc.numPages)
for (let p = 1; p <= doc.numPages; p++) {
  if (only && p !== only) continue
  const page = await doc.getPage(p)
  const tc = await page.getTextContent()
  const items = tc.items.filter(i => String(i.str).trim()).map(i => ({
    s: i.str, x: Math.round(i.transform[4]), y: Math.round(i.transform[5]),
  }))
  // group into rows by y (tolerance 3)
  const rows = []
  for (const it of items.sort((a, b) => b.y - a.y || a.x - b.x)) {
    const r = rows.find(r => Math.abs(r.y - it.y) <= 3)
    if (r) r.items.push(it); else rows.push({ y: it.y, items: [it] })
  }
  console.log(`\n===== PAGE ${p} (${rows.length} rows) =====`)
  for (const r of rows) {
    const line = r.items.sort((a, b) => a.x - b.x).map(i => `${i.s.trim()}@${i.x}`).join(' | ')
    console.log(String(r.y).padStart(5), line)
  }
}
