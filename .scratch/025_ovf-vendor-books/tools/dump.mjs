import { createRequire } from 'module'
import fs from 'fs'
const require = createRequire('file:///C:/Users/User/OneDrive/Documents/Claude%20ReadWrite/Flooring-Tracker/package.json')
const XLSX = require('xlsx')

const file = process.argv[2]
const maxRows = Number(process.argv[3] || 40)
const wb = XLSX.read(fs.readFileSync(file), { type: 'buffer' })
console.log('=== FILE:', file)
console.log('SHEETS:', JSON.stringify(wb.SheetNames))
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, raw: true })
  console.log(`\n--- SHEET "${name}" rows=${rows.length}`)
  rows.slice(0, maxRows).forEach((r, i) => {
    const cells = r.map(c => (c === undefined || c === null ? '' : String(c)))
    while (cells.length && cells[cells.length - 1] === '') cells.pop()
    console.log(String(i).padStart(4), '|', cells.join(' | '))
  })
  if (rows.length > maxRows) console.log(`   ... ${rows.length - maxRows} more rows`)
}
