// parseMirage against the real four-file set, in the shape the router hands over.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('file:///C:/Users/User/OneDrive/Documents/Claude%20ReadWrite/Flooring-Tracker/package.json');
const XLSX = require('xlsx');
const pdfjs = await import('file:///C:/Users/User/OneDrive/Documents/Claude%20ReadWrite/Flooring-Tracker/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
const M = await import(new URL('../../../src/miragebook.js', import.meta.url));

const CHART='C:/Users/User/OneDrive/Documents/Claude ReadWrite/Flooring-Tracker/.claude/worktrees/mirage-floors-product-chart-23550a/.scratch/025_ovf-vendor-books/samples/mirage-product-chart-us-2026-02-02.pdf';
const DL='C:/Users/User/Downloads/';

const xls=(f)=>{const wb=XLSX.readFile(DL+f);return wb.SheetNames.map(n=>({name:n,rows:XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:false,defval:''})}));};
const doc=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(CHART)),useSystemFonts:true}).promise;
const pages=[];for(let p=1;p<=doc.numPages;p++){const pg=await doc.getPage(p);const vh=pg.getViewport({scale:1}).height;const c=await pg.getTextContent();
 pages.push(c.items.filter(i=>i.str&&i.str.trim()).map(i=>({str:i.str,x:i.transform[4],y:vh-i.transform[5],w:i.width})));}

const payloads=[
  {pages,isPdf:true},
  {sheets:xls('OVF-Mirage-Hardwood.xls')},
  {sheets:xls('OVF-Mirage-Value-Tower.xls')},
  {sheets:xls('OVF-Mirage-Trim.xls')},
];
console.log('effective dates:');
for(const f of ['OVF-Mirage-Hardwood.xls','OVF-Mirage-Value-Tower.xls'])
  console.log('  ',f,'->',new Date(M.effectiveDate(xls(f))).toISOString().slice(0,10));

const res=M.parseMirage(payloads);
console.log('\nmeta:',JSON.stringify(res.meta));
console.log('rows (incl header):',res.rows.length);
console.log('\nwarnings:'); res.warnings.forEach(w=>console.log('  -',w));
console.log('\nheader:',JSON.stringify(res.rows[0]));
console.log('\nfirst 5 floors:'); res.rows.slice(1,6).forEach(r=>console.log('  ',JSON.stringify(r)));

// order independence: shuffle the payloads, expect the identical sheet
const shuffled=[payloads[2],payloads[3],payloads[0],payloads[1]];
const res2=M.parseMirage(shuffled);
console.log('\norder-independent:', JSON.stringify(res.rows)===JSON.stringify(res2.rows));
// a non-Mirage set must fall through
console.log('non-Mirage set -> null:', M.parseMirage([{sheets:[{name:'x',rows:[['Item','Price']]}]}])===null);
// spot: does a known SKU carry the right price?
const find=(sku)=>res.rows.find(r=>r[0]===sku);
for(const s of ['72697','76463','36180']) console.log('  ',s,'->',JSON.stringify(find(s)));
