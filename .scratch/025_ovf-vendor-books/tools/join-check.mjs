import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire('file:///C:/Users/User/OneDrive/Documents/Claude%20ReadWrite/Flooring-Tracker/package.json');
const XLSX = require('xlsx');
const pdfjs = await import('file:///C:/Users/User/OneDrive/Documents/Claude%20ReadWrite/Flooring-Tracker/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
const M = await import('file:///C:/Users/User/OneDrive/Documents/Claude%20ReadWrite/Flooring-Tracker/.claude/worktrees/price-sheet-trim-floor-link-6d2e84/src/miragebook.js');
const DL='C:/Users/User/Downloads/';
const readSheets=(f)=>{const wb=XLSX.read(fs.readFileSync(f),{type:'buffer'});return wb.SheetNames.map(name=>({name,rows:XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,blankrows:false,raw:true,defval:''})}));};
const doc=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync('C:/Users/User/.claude/uploads/e9b78c39-9596-4609-a885-3981a8fd2e42/94a4ee2c-Mirage_Product_Chart.pdf')),useSystemFonts:true}).promise;
const pages=[]; for(let p=1;p<=doc.numPages;p++){const pg=await doc.getPage(p);const vh=pg.getViewport({scale:1}).height;const c=await pg.getTextContent();
 pages.push(c.items.filter(i=>i.str&&i.str.trim()).map(i=>({str:i.str,x:i.transform[4],y:vh-i.transform[5],w:i.width})));}

const chart = M.parseMirageChart(pages).rows;
const tower = M.parseMirageFlooring(readSheets(DL+'OVF-Mirage-Value-Tower.xls'));
const hard  = M.parseMirageFlooring(readSheets(DL+'OVF-Mirage-Hardwood.xls'));
console.log('chart rows      :', chart.length);
console.log('value tower rows:', tower.rows.length, tower.warnings);
console.log('hardwood rows   :', hard.rows.length, hard.warnings);
console.log('VT constructions:', [...new Set(tower.rows.map(r=>M.normConstruction(r.construction)))].join(' | '));
console.log('HW constructions:', [...new Set(hard.rows.map(r=>M.normConstruction(r.construction)))].join(' | '));
console.log('chart constructions:', [...new Set(chart.map(r=>M.normConstruction(r.construction)))].join(' | '));
console.log('HW widths:', [...new Set(hard.rows.map(r=>M.normWidth(r.width)))].join(' | '));
console.log('chart widths:', [...new Set(chart.map(r=>M.normWidth(r.width)))].join(' | '));

// Value Tower first, Hardwood second — later effective date wins.
const { rows, unpriced } = M.priceChartRows(chart, [...tower.rows, ...hard.rows]);
const priced = rows.filter(r=>r.price!=null);
console.log('\n=== JOIN ===');
console.log(`priced ${priced.length} / ${rows.length}  (${Math.round(priced.length/rows.length*100)}%)`);
const byColl={}; for(const u of unpriced){ (byColl[u.collection] ||= new Set()).add(M.normConstruction(u.construction)+' '+M.normWidth(u.width)); }
console.log('unpriced by collection:');
for(const [k,v] of Object.entries(byColl)) console.log('  '+k.padEnd(16), [...v].slice(0,6).join(', '));
console.log('\nsupersede check (overlap: Muse/DreamVille/Escape) — which sheet won:');
for (const c of ['Muse','DreamVille','Escape']) {
  const s = new Set(priced.filter(r=>r.collection===c).map(r=>r.priceSheet));
  console.log('  '+c.padEnd(12), [...s].join(', '));
}
const eleanor = priced.find(r=>r.collection==='Muse'&&r.color==='Eleanor'&&M.normWidth(r.width)==='5'&&M.normConstruction(r.construction)==='trubalance');
console.log('\nMuse/Character/Eleanor TruBalance 5":', eleanor && `${eleanor.sku} $${eleanor.price} (${eleanor.priceSheet})`);
