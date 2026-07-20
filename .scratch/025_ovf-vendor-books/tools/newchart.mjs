import fs from 'fs';
const NEW='C:/Users/User/OneDrive/Documents/Claude ReadWrite/Flooring-Tracker/.claude/worktrees/mirage-floors-product-chart-23550a/.scratch/025_ovf-vendor-books/samples/mirage-product-chart-us-2026-02-02.pdf';
const pdfjs = await import('file:///C:/Users/User/OneDrive/Documents/Claude%20ReadWrite/Flooring-Tracker/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
const M = await import('file:///C:/Users/User/OneDrive/Documents/Claude%20ReadWrite/Flooring-Tracker/.claude/worktrees/price-sheet-trim-floor-link-6d2e84/src/miragebook.js');
const doc=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(NEW)),useSystemFonts:true}).promise;
const pages=[]; for(let p=1;p<=doc.numPages;p++){const pg=await doc.getPage(p);const vh=pg.getViewport({scale:1}).height;const c=await pg.getTextContent();
 pages.push(c.items.filter(i=>i.str&&i.str.trim()).map(i=>({str:i.str,x:i.transform[4],y:vh-i.transform[5],w:i.width})));}
const p1 = pages[0].map(i=>i.str).join(' ');
console.log('has "product chart":', /product\s*chart/i.test(p1));
console.log('has "trubalance"   :', /trubalance/i.test(p1));
console.log('effective line     :', (p1.match(/Effective[^|]{0,40}/i)||['(none)'])[0]);
console.log('detector isMirageChart:', M.isMirageChart(pages));
const { rows, warnings } = M.parseMirageChart(pages);
console.log('\nrows:', rows.length, warnings);
console.log('collections:', [...new Set(rows.map(r=>r.collection))].join(' | '));
console.log('constructions:', [...new Set(rows.map(r=>r.construction))].join(' | '));
console.log('grades:', [...new Set(rows.map(r=>r.grade))].join(' | '));
console.log('no grade:', rows.filter(r=>!r.grade).length, ' no construction:', rows.filter(r=>!r.construction).length);
