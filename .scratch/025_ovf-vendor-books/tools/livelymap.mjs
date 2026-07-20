// Does the LIVELY block map each width to the RIGHT construction?
import fs from 'fs';
const NEW='C:/Users/User/OneDrive/Documents/Claude ReadWrite/Flooring-Tracker/.claude/worktrees/mirage-floors-product-chart-23550a/.scratch/025_ovf-vendor-books/samples/mirage-product-chart-us-2026-02-02.pdf';
const pdfjs = await import('file:///C:/Users/User/OneDrive/Documents/Claude%20ReadWrite/Flooring-Tracker/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
const M = await import(new URL('../../../src/miragebook.js', import.meta.url));
const doc=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(NEW)),useSystemFonts:true}).promise;
const pages=[]; for(let p=1;p<=doc.numPages;p++){const pg=await doc.getPage(p);const vh=pg.getViewport({scale:1}).height;const c=await pg.getTextContent();
 pages.push(c.items.filter(i=>i.str&&i.str.trim()).map(i=>({str:i.str,x:i.transform[4],y:vh-i.transform[5],w:i.width})));}
const { rows } = M.parseMirageChart(pages);
const lively = rows.filter(r=>r.collection==='LIVELY');
const seen = new Map();
for (const r of lively) seen.set(`${r.construction} :: ${r.width}`, (seen.get(`${r.construction} :: ${r.width}`)||0)+1);
console.log('LIVELY rows:', lively.length);
for (const [k,v] of [...seen].sort()) console.log('  ', k, `(${v} skus)`);
console.log('\nspot: Natural row skus ->');
for (const r of lively.filter(r=>r.color==='Natural')) console.log(`   ${r.sku}  ${r.construction} ${r.width}`);
