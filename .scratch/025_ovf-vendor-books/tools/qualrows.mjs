// How does each chart edition print a qualified (Herringbone/Chevron) width?
import fs from 'fs';
const CHARTS = {
  2025: 'C:/Users/User/.claude/uploads/e9b78c39-9596-4609-a885-3981a8fd2e42/94a4ee2c-Mirage_Product_Chart.pdf',
  2026: 'C:/Users/User/OneDrive/Documents/Claude ReadWrite/Flooring-Tracker/.claude/worktrees/mirage-floors-product-chart-23550a/.scratch/025_ovf-vendor-books/samples/mirage-product-chart-us-2026-02-02.pdf',
};
const pdfjs = await import('file:///C:/Users/User/OneDrive/Documents/Claude%20ReadWrite/Flooring-Tracker/node_modules/pdfjs-dist/legacy/build/pdf.mjs');

for (const [year, path] of Object.entries(CHARTS)) {
  const doc = await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(path)),useSystemFonts:true}).promise;
  console.log(`\n############ ${year} ############`);
  for (let p=1;p<=doc.numPages;p++){
    const pg=await doc.getPage(p); const vh=pg.getViewport({scale:1}).height; const c=await pg.getTextContent();
    const page=c.items.filter(i=>i.str&&i.str.trim()).map(i=>({str:i.str,x:i.transform[4],y:vh-i.transform[5],w:i.width}));
    const rows=rowsOf(page);
    rows.forEach((r,idx)=>{
      if (!r.items.some(i=>/^(herringbone|herr\.?|chevron|chev\.?)$/i.test(i.s))) return;
      console.log(`\npage ${p} row ${idx} (y=${r.y.toFixed(2)}):`);
      for (const k of [idx-2,idx-1, idx, idx+1, idx+2, idx+3, idx+4]) {
        if (!rows[k]) continue;
        console.log(`   ${k===idx?'>':' '} y=${rows[k].y.toFixed(2)} :: ` + rows[k].items.map(i=>`[${i.s}]`).join(' '));
      }
    });
  }
}
function rowsOf(page){
  const str=(v)=>(v==null?'':String(v)).replace(/\s+/g,' ').trim();
  const items=(page||[]).filter(i=>str(i.str)).map(i=>({s:str(i.str),x:i.x,y:i.y,cx:i.x+(i.w||0)/2}));
  const rows=[];
  for(const it of items.sort((a,b)=>a.y-b.y||a.x-b.x)){
    const r=rows.find(r=>Math.abs(r.y-it.y)<=3);
    if(r) r.items.push(it); else rows.push({y:it.y,items:[it]});
  }
  rows.forEach(r=>r.items.sort((a,b)=>a.x-b.x));
  return rows;
}
