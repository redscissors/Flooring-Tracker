// Freeze the four REAL Mirage files into the exact shape ImportRouter.readRow
// produces, so the preview harness can drive the real wizard without a file
// picker (and without Supabase). Dev-only; run by hand when the samples change.
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const require = createRequire('file:///C:/Users/User/OneDrive/Documents/Claude%20ReadWrite/Flooring-Tracker/package.json');
const XLSX = require('xlsx');
const pdfjs = await import('file:///C:/Users/User/OneDrive/Documents/Claude%20ReadWrite/Flooring-Tracker/node_modules/pdfjs-dist/legacy/build/pdf.mjs');

const CHART='C:/Users/User/OneDrive/Documents/Claude ReadWrite/Flooring-Tracker/.claude/worktrees/mirage-floors-product-chart-23550a/.scratch/025_ovf-vendor-books/samples/mirage-product-chart-us-2026-02-02.pdf';
const DL='C:/Users/User/Downloads/';
const xls=(f)=>{const wb=XLSX.readFile(DL+f);return wb.SheetNames.map(n=>({name:n,rows:XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:false,defval:''})}));};

const doc=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(CHART)),useSystemFonts:true}).promise;
const pages=[];
for(let p=1;p<=doc.numPages;p++){const pg=await doc.getPage(p);const vh=pg.getViewport({scale:1}).height;const c=await pg.getTextContent();
  pages.push(c.items.filter(i=>i.str&&i.str.trim()).map(i=>({str:i.str,x:i.transform[4],y:vh-i.transform[5],w:i.width})));}

const out = [
  { name: 'mirage-product-chart-us-2026-02-02.pdf', isPdf: true, pages },
  { name: 'OVF-Mirage-Hardwood.xls',   sheets: xls('OVF-Mirage-Hardwood.xls') },
  { name: 'OVF-Mirage-Value-Tower.xls', sheets: xls('OVF-Mirage-Value-Tower.xls') },
  { name: 'OVF-Mirage-Trim.xls',        sheets: xls('OVF-Mirage-Trim.xls') },
];
const dest = path.join(path.dirname(fileURLToPath(import.meta.url)), 'payloads.json');
fs.writeFileSync(dest, JSON.stringify(out));
console.log('wrote', dest, (fs.statSync(dest).size/1e6).toFixed(2)+' MB');
