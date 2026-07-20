// Run the real miragebook.js against the real files, in the repo's page shape.
import { createRequire } from 'module'
import fs from 'fs'
const require = createRequire('file:///C:/Users/User/OneDrive/Documents/Claude%20ReadWrite/Flooring-Tracker/package.json')
const XLSX = require('xlsx')
const pdfjs = await import('file:///C:/Users/User/OneDrive/Documents/Claude%20ReadWrite/Flooring-Tracker/node_modules/pdfjs-dist/legacy/build/pdf.mjs')
const M = await import('file:///C:/Users/User/OneDrive/Documents/Claude%20ReadWrite/Flooring-Tracker/.claude/worktrees/price-sheet-trim-floor-link-6d2e84/src/miragebook.js')

const DL = 'C:/Users/User/Downloads/'
const CHART = 'C:/Users/User/.claude/uploads/e9b78c39-9596-4609-a885-3981a8fd2e42/94a4ee2c-Mirage_Product_Chart.pdf'

// Mirror App.jsx readPdfPages exactly: y flipped top-down, `w` for width.
async function readPdfPages(path) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(path)), useSystemFonts: true }).promise
  const pages = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const vh = page.getViewport({ scale: 1 }).height
    const c = await page.getTextContent()
    pages.push(c.items.filter(i => i.str && i.str.trim()).map(i => ({ str: i.str, x: i.transform[4], y: vh - i.transform[5], w: i.width })))
  }
  return pages
}
const readSheets = (f) => {
  const wb = XLSX.read(fs.readFileSync(f), { type: 'buffer' })
  return wb.SheetNames.map(name => ({ name, rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: false, raw: true, defval: '' }) }))
}

const pages = await readPdfPages(CHART)
const hardwood = readSheets(DL + 'OVF-Mirage-Hardwood.xls')
const tower = readSheets(DL + 'OVF-Mirage-Value-Tower.xls')
const trim = readSheets(DL + 'OVF-Mirage-Trim.xls')

console.log('=== detectors ===')
console.log('chart  isMirageChart   :', M.isMirageChart(pages))
console.log('hardwood kind          :', M.mirageFileKind({ sheets: hardwood }))
console.log('valuetower kind        :', M.mirageFileKind({ sheets: tower }))
console.log('trim kind              :', M.mirageFileKind({ sheets: trim }))
console.log('chart kind             :', M.mirageFileKind({ pages, isPdf: true }))
console.log('-- negatives --')
console.log('trim as flooring?      :', M.isMirageFlooring(trim), '(want false)')
console.log('hardwood as trim?      :', M.isMirageTrim(hardwood), '(want false)')
console.log('empty pdf as chart?    :', M.isMirageChart([[]]), '(want false)')

const { rows, warnings } = M.parseMirageChart(pages)
console.log('\n=== chart parse ===')
console.log('rows:', rows.length, 'warnings:', warnings)
console.log('collections:', [...new Set(rows.map(r => r.collection))].join(' | '))
console.log('constructions:', [...new Set(rows.map(r => r.construction))].join(' | '))
console.log('grades:', [...new Set(rows.map(r => r.grade))].join(' | '))
const noGrade = rows.filter(r => !r.grade)
console.log('rows missing a grade:', noGrade.length, noGrade.length ? '(' + [...new Set(noGrade.map(r => r.collection))].join(',') + ')' : '')
const noBand = rows.filter(r => !r.construction)
console.log('rows missing a construction:', noBand.length)

console.log('\n-- spot checks vs the .xls sheets --')
const chk = (coll, grade, color, band, width, want) => {
  const h = rows.find(r => r.collection === coll && r.grade === grade && r.color === color && r.construction === band && r.width === width)
  console.log(`${h && h.sku === want ? 'OK  ' : 'MISS'} ${coll}/${grade}/${color}/${band}/${width} expect ${want} got ${h ? h.sku : '—'}`)
}
chk('Muse', 'Character', 'Eleanor', 'TruBalance', '5"', '72697')      // Value Tower row
chk('Blanc', 'Character', 'White Mist', 'TruBalance', '5"', '36180')  // == Hardwood's Blanc/Character/5"
chk('Muse', 'Character', 'Eleanor', 'TruBalance Lite', '5"', '56687')
chk('Escape', 'Character', 'Carmel', 'TruBalance', '5"', '46393')     // grade shares its row with a colour
console.log('Imagine colours:', [...new Set(rows.filter(r => r.collection === 'Imagine').map(r => r.color))].join(', '))
console.log('Imagine species:', [...new Set(rows.filter(r => r.collection === 'Imagine').map(r => r.species))].join(', '))

// Cross-validate every overlapping (collection, grade, color) against Value Tower.
const S = v => String(v ?? '').replace(/\s+/g, ' ').trim()
const skuRe = /^\d{5}[A-Z]?$/
const norm = s => S(s).toLowerCase().replace(/\(natural\)/g, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
const vtRows = tower.find(s => s.name === 'Mirage').rows
const vt = new Map()
let coll = '', grade = ''
for (const r of vtRows.slice(25)) {
  const skus = r.filter(c => skuRe.test(S(c))).map(S)
  if (!skus.length) continue
  if (S(r[0]) && !skuRe.test(S(r[0]))) coll = S(r[0])
  if (S(r[1]) && !skuRe.test(S(r[1]))) grade = S(r[1])
  const color = S(r[2]); if (!coll || !color) continue
  const k = `${norm(coll)}::${norm(grade)}::${norm(color)}`
  vt.set(k, new Set([...(vt.get(k) || []), ...skus]))
}
const ch = new Map()
for (const r of rows) {
  const k = `${norm(r.collection)}::${norm(r.grade)}::${norm(r.color)}`
  ch.set(k, new Set([...(ch.get(k) || []), r.sku]))
}
let both = 0, exact = 0; const conflict = []
for (const [k, vs] of vt) {
  const cs = ch.get(k); if (!cs) continue
  both++
  const missing = [...vs].filter(s => !cs.has(s))
  if (!missing.length) exact++; else conflict.push({ k, missing })
}
console.log(`\n=== cross-check vs Value Tower colour grid ===`)
console.log(`overlapping (collection,grade,colour) keys: ${both}`)
console.log(`  chart contains every VT sku: ${exact}`)
console.log(`  CONFLICT: ${conflict.length}`)
conflict.slice(0, 8).forEach(c => console.log('   ', c.k, '->', c.missing.join(' ')))
