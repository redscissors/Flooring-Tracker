import { Fragment, useEffect, useState } from "react";
import { normPrintPricing } from "./pricing.js";
import { wasteVaries } from "./catalog.js";
import { money, wasteNote, rowBlank } from "./model.js";
import { TLBL } from "./uiconst.js";
import { printProduct, printAreaFloor, areaPrintLabel, u1 } from "./print.js";
import { brandRow, specParts, qtyCells, priceCells, lineCells, columnsUsed, gridSpec, jobListGroups, specialCheck, isOneLine, cellParts, loneUnnamedArea, fitColumns, stripRuled } from "./printcols.js";
import { SheetHead } from "./sheethead.jsx";

const MUTED = "var(--ft-muted)", FAINT = "var(--ft-faint)", DEEP = "var(--ft-brand-deep)";
const RULE = "var(--ft-paper-rule)", HAIR = "var(--ft-border)", BAND = "var(--ft-paper-band)";
// The material strip reads lighter than the products: a thinner rule, regular
// weight (owner 2026-10-01, issue 163 — still 100% black on paper).
const MAT_RULE = "0.6px solid var(--ft-border)";
// The product block keeps its gutter as padding, so a row's rule runs on to
// the first material divider (owner 2026-10-01).
const GUTTER = 6;
const DIAMOND = "◆";
const eyebrow = { fontSize: 7.5, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: FAINT };
const kindLabel = { fontSize: 7, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: DEEP };
const MAT_FS = 7.6, MAT_PAD = 3;

let measureCtx;
// Printed widths for fitColumns, in the cells' own type; null without a canvas.
function matMeasure() {
  if (measureCtx === undefined) measureCtx = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  const ctx = measureCtx;
  if (!ctx) return null;
  return (text, kind) => {
    const caps = kind !== "cell", px = kind === "head" ? 7.5 : kind === "label" ? 6.5 : MAT_FS;
    ctx.font = `${caps ? 800 : 500} ${px}px Manrope`;
    const t = caps ? text.toUpperCase() : text;
    return ctx.measureText(t).width + (caps ? t.length * px * (kind === "head" ? 0.05 : 0.12) : 0);
  };
}

// The material-columns selection sheet (spec 2026-09-30, owner pick "G3c"):
// products on the left, one column per install material beside them with the
// exact amount each line needs, and one priced job order list below.
export function EstimateColumnsPaper({ sel, people, profile, tv, jobWaste, pMats, tSet, materialsCost, freightCost = 0, flooringPrice, miscCost, grandTotal, optionPrint = null, scopeNote = "", stockBookIds, stockSkus = null }) {
  const pMode = normPrintPricing(sel.printPricing);
  const full = pMode === "full";
  const wVar = wasteVaries(tv.proj.categories, tSet);
  const areas = optionPrint ? tv.proj.categories.filter((a) => !a.option) : tv.proj.categories;
  const liveRows = (cats) => cats.flatMap((a) => a.products.filter((p) => !rowBlank(p)));
  const allRows = [...liveRows(areas), ...(optionPrint ? optionPrint.sections.flatMap((S) => liveRows(S.cats)) : [])];
  const computed = new Map(allRows.map((p) => [p.id, printProduct(p, tSet)]));
  // Re-measure once the web font is in; before that the canvas sees a fallback face.
  const [, setFontsIn] = useState(false);
  useEffect(() => { document.fonts?.ready.then(() => setFontsIn(true)); }, []);
  const cols = fitColumns(columnsUsed([...computed.values()]), [...computed.values()], matMeasure(), full ? 21 : 0);
  const g = gridSpec(pMode, cols);
  const { row: specialRow, mat: specialMat } = specialCheck(stockBookIds, stockSkus);
  const anySpecial = allRows.some((p) => specialRow(p) || computed.get(p.id).mats.some(specialMat))
    || [...(pMats || []), ...(optionPrint ? optionPrint.sections.flatMap((S) => S.t.pMats) : [])].some(specialMat);
  const noHead = !optionPrint && loneUnnamedArea(areas);
  const areaCount = !optionPrint && !noHead && areas.length > 0 ? `${areas.length} ${areas.length === 1 ? "area" : "areas"} selected` : "";
  const hasShared = !!optionPrint && optionPrint.sharedT.grandTotal > 0;
  const row = (left, mats, first, last, matRule) => (
    <div style={{ display: "grid", gridTemplateColumns: g.outer, breakInside: "avoid" }}>
      <div style={{ display: "grid", gridTemplateColumns: g.left, columnGap: 6, alignItems: "start", borderTop: first ? "none" : `1px solid ${HAIR}`, paddingRight: GUTTER, paddingBottom: last ? 3 : 0 }}>{left}</div>
      {cols.length > 0 && <div style={{ display: "flex", borderTop: first ? "none" : matRule ? MAT_RULE : "0.6px solid transparent" }}>{mats}</div>}
    </div>
  );

  // Amount first, its unit small beneath, the name beside (owner pick 3).
  const matItem = (m, i) => {
    const t = cellParts(m);
    return (
      <div key={i} style={{ marginTop: i ? 2 : 0 }}>
        {t.label && <div style={{ ...kindLabel, fontSize: 6.5 }}>{t.label}</div>}
        <div style={{ display: "grid", gridTemplateColumns: full ? "17px minmax(0,1fr)" : "minmax(0,1fr)", columnGap: 4, alignItems: "baseline" }}>
          {full && <div style={{ textAlign: "right" }}><div style={{ fontWeight: 800 }}>{t.qty}</div>{t.unit && <div style={{ fontSize: 6, color: MUTED, lineHeight: 1.1 }}>{t.unit}</div>}</div>}
          <div style={{ minWidth: 0 }}>
            <div>{specialMat(m) ? `${DIAMOND} ` : ""}{t.name}</div>
            {t.sub && <div style={{ color: MUTED }}>{t.sub}</div>}
          </div>
        </div>
      </div>
    );
  };
  const cellStyle = { flex: "none", borderLeft: MAT_RULE, padding: `1px ${MAT_PAD}px`, fontSize: MAT_FS, lineHeight: 1.2 };
  const moneyCells = (q, pr, c, oneLine) => {
    const cell = { paddingTop: 2, fontSize: 8.8, lineHeight: 1.3, textAlign: "right", whiteSpace: "nowrap" };
    return (
      <>
        {g.money.qty && <div className="ft-mono" style={cell}><div>{q.top}</div>{!oneLine && q.sub && <div style={{ color: MUTED }}>{q.sub}</div>}</div>}
        {g.money.price && <div className="ft-mono" style={cell}><div>{pr.top}</div>{!oneLine && pr.sub && <div style={{ color: MUTED }}>{pr.sub}</div>}</div>}
        {g.money.total && <div className="ft-mono" style={{ ...cell, fontWeight: 800, fontSize: 10 }}>{c.line > 0 ? money(c.line) : ""}</div>}
      </>
    );
  };
  const productRow = (p, pi, rows) => {
    const c = computed.get(p.id);
    const cells = lineCells(c);
    const prevCells = pi > 0 ? lineCells(computed.get(rows[pi - 1].id)) : null;
    const q = qtyCells(p, c), pr = priceCells(p, c);
    const oneLine = isOneLine(cells, cols, q, pr);
    const typeLbl = TLBL[p.type] || "";
    const br = brandRow(p);
    const name = br ? br.lead
      : <>{p.brandColor || typeLbl}{p.brandColor && p.type !== "misc" && typeLbl && <span style={{ fontWeight: 500, color: MUTED }}> — {typeLbl.toLowerCase()}</span>}</>;
    // the SKU and its number never split across a line
    const parts = br ? (br.tail ? [br.tail] : []) : specParts(p, c);
    const spec = parts.length ? parts.map((t, i) => <Fragment key={i}>{i ? " · " : ""}{/^SKU |^[A-Z]/.test(t) && (br || i === parts.length - 1) ? <span style={{ whiteSpace: "nowrap" }}>{t}</span> : t}</Fragment>) : null;
    const note = p.note && <div style={{ fontSize: 8.3, fontStyle: "italic", color: MUTED }}>{p.note}</div>;
    return (
      <Fragment key={p.id}>
        {row(<>
          <span style={{ fontSize: 10, fontWeight: 800, lineHeight: "15px" }}>{specialRow(p) ? DIAMOND : ""}</span>
          {oneLine ? (
            <div style={{ minWidth: 0, padding: "2px 0", fontSize: 9.4, lineHeight: 1.3 }}><b style={{ fontWeight: 800 }}>{name}</b>{spec && <span style={{ fontSize: 8.2, color: MUTED }}> {spec}</span>}{note}</div>
          ) : (
            <div style={{ minWidth: 0, padding: "2px 0" }}>
              <div style={{ fontSize: 10, fontWeight: 800, lineHeight: 1.25 }}>{name}</div>
              {spec && <div style={{ fontSize: 8.4, color: MUTED, lineHeight: 1.3 }}>{spec}</div>}
              {note}
            </div>
          )}
          {moneyCells(q, pr, c, oneLine)}
        </>, cols.map((col) => <div key={col.key} style={{ ...cellStyle, width: col.w }}>{cells[col.key].map(matItem)}</div>), pi === 0, pi === rows.length - 1, stripRuled(prevCells, cells, cols))}
      </Fragment>
    );
  };
  // The band sits flush on the grid above; its total covers the product rows
  // only, so it ends under Total, and a one-item area skips it (owner 2026-10-01).
  const areaBlock = (a, ai) => {
    const rows = a.products.filter((p) => !rowBlank(p));
    if (!rows.length) return null;
    return (
      <div key={a.id}>
        {!noHead && (
          <div className="ft-pband" style={{ display: "grid", gridTemplateColumns: g.outer, alignItems: "center", background: BAND, borderRadius: "3px 0 0 3px", padding: "1px 0 1px 16px", marginTop: ai ? 0 : 5, breakAfter: "avoid" }}>
            <div className="flex justify-between items-center" style={{ gap: 12, minWidth: 0, paddingRight: GUTTER }}>
              <div className="uppercase" style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".22em", color: DEEP }}>{areaPrintLabel(a, ai)}</div>
              {full && rows.length > 1 && <div className="ft-mono" style={{ fontSize: 9, color: MUTED, whiteSpace: "nowrap" }}>Area Total {money(printAreaFloor(a, tSet))}</div>}
            </div>
            {cols.length > 0 && <div />}
          </div>
        )}
        {rows.map((p, pi) => productRow(p, pi, rows))}
      </div>
    );
  };
  const header = (
    <div style={{ display: "grid", gridTemplateColumns: g.outer, borderBottom: "1px solid var(--ft-text)", padding: "8px 0 3px", breakAfter: "avoid" }}>
      <div style={{ display: "grid", gridTemplateColumns: g.left, columnGap: 6, paddingRight: GUTTER }}>
        <div />
        <div style={eyebrow}>Product</div>
        {g.money.qty && <div style={{ ...eyebrow, textAlign: "right", marginRight: "-.14em" }}>Qty</div>}
        {g.money.price && <div style={{ ...eyebrow, textAlign: "right", marginRight: "-.14em" }}>Price</div>}
        {g.money.total && <div style={{ ...eyebrow, textAlign: "right", marginRight: "-.14em" }}>Total</div>}
      </div>
      {cols.length > 0 && <div style={{ display: "flex" }}>{cols.map((col) => <div key={col.key} style={{ ...eyebrow, flex: "none", width: col.w, letterSpacing: ".05em", paddingLeft: 4, borderLeft: MAT_RULE }}>{col.label}</div>)}</div>}
    </div>
  );
  const listCols = full ? "72px minmax(0,1fr) 54px 54px 52px 62px" : pMode === "unit" ? "72px minmax(0,1fr) 72px" : "72px minmax(0,1fr)";
  const jobList = (rows, freight) => {
    const groups = jobListGroups(rows);
    if (!groups.length) return null;
    const lr = { display: "grid", gridTemplateColumns: listCols, columnGap: 8, fontSize: 9.1, padding: "1.5px 0", alignItems: "baseline", breakInside: "avoid" };
    const subtotal = groups.reduce((t, gr) => t + gr.rows.reduce((u, r) => u + (r.total || 0), 0), 0);
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ ...lr, borderBottom: "1px solid var(--ft-text)", breakAfter: "avoid" }}>
          <span /><span style={eyebrow}>Item</span>
          {full && <><span style={{ ...eyebrow, textAlign: "right" }}>Needed</span><span style={{ ...eyebrow, textAlign: "right" }}>Order</span></>}
          {pMode !== "none" && <span style={{ ...eyebrow, textAlign: "right" }}>Each</span>}
          {full && <span style={{ ...eyebrow, textAlign: "right" }}>Total</span>}
        </div>
        {groups.map((gr) => gr.rows.map((r, ri) => (
          <div key={`${gr.label}-${ri}`} style={{ ...lr, borderBottom: `1px solid ${ri === gr.rows.length - 1 ? RULE : HAIR}`, breakBefore: ri === 1 ? "avoid" : "auto" }}>
            <span style={kindLabel}>{ri ? "" : gr.label}</span>
            <span>{specialMat(r) ? `${DIAMOND} ` : ""}{r.name}{r.sku && <span style={{ color: FAINT }}> · SKU {r.sku}</span>}{r.detail && <span style={{ color: FAINT }}> · {r.detail}</span>}</span>
            {full && <><span className="ft-mono" style={{ textAlign: "right", color: MUTED, whiteSpace: "nowrap" }}>{r.needed}</span><span className="ft-mono" style={{ textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{r.order > 0 ? `${r.order} ${u1(r.order, r.unit)}` : ""}</span></>}
            {pMode !== "none" && <span className="ft-mono" style={{ textAlign: "right", color: full ? MUTED : "inherit", whiteSpace: "nowrap" }}>{r.price > 0 ? money(r.price) : ""}</span>}
            {full && <span className="ft-mono" style={{ textAlign: "right", fontWeight: 800, whiteSpace: "nowrap" }}>{r.total > 0 ? money(r.total) : ""}</span>}
          </div>
        )))}
        {full && (
          <div style={{ ...lr, borderTop: "1px solid var(--ft-text)", fontWeight: 800 }}>
            <span /><span>{freight > 0 ? "Materials & freight subtotal" : "Install materials subtotal"}</span><span /><span /><span />
            <span className="ft-mono" style={{ textAlign: "right" }}>{money(subtotal)}</span>
          </div>
        )}
      </div>
    );
  };
  const specialLine = anySpecial && <div style={{ fontSize: 9.5 }}><b>{DIAMOND} Special order</b> — special-order items can&apos;t be returned.</div>;
  const waste = wasteNote(jobWaste, wVar);
  const totalRow = (label, value, strong) => (
    <><span style={strong ? { fontWeight: 800, borderTop: "1.5px solid var(--ft-text)", paddingTop: 3, marginTop: 2 } : {}}>{label}</span>
      <span className="ft-mono" style={{ textAlign: "right", ...(strong ? { fontWeight: 800, borderTop: "1.5px solid var(--ft-text)", paddingTop: 3, marginTop: 2 } : {}) }}>{money(value)}</span></>
  );

  return (
    <div data-estimate-paper="columns" style={{ fontSize: 11, color: "var(--ft-text)" }}>
      <SheetHead sel={sel} people={people} profile={profile} tv={tv} scopeNote={scopeNote} areaCount={areaCount} />
      {header}
      {areas.map(areaBlock)}
      <div style={{ borderTop: "2px solid var(--ft-text)", marginTop: 8 }}>
        {jobList(pMats, optionPrint ? optionPrint.sharedT.freightCost : freightCost)}
      </div>
      {optionPrint && full && hasShared && (
        <div className="flex justify-end" style={{ fontSize: 10.5, fontWeight: 800, marginTop: 4 }}>Shared areas total&nbsp;<span className="ft-mono">{money(optionPrint.sharedT.grandTotal)}</span></div>
      )}
      {optionPrint && optionPrint.sections.map((S) => (
        <div key={S.slot} className="ft-popt" style={{ border: `1.3px solid ${S.color.main}`, borderRadius: 5, marginTop: 8 }}>
          <div className="ft-pband flex items-center uppercase" style={{ gap: 8, background: S.color.main, color: "#fff", borderRadius: "3.5px 3.5px 0 0", padding: "3px 10px", fontSize: 8.5, fontWeight: 800, letterSpacing: ".18em", breakAfter: "avoid" }}>
            Option {S.slot}{S.title !== `Option ${S.slot}` ? ` · ${S.title}` : ""}
          </div>
          <div style={{ padding: "0 6px 6px" }}>
            {S.cats.map(areaBlock)}
            {jobList(S.t.pMats, S.t.freightCost)}
          </div>
          {full && (
            <div className="flex justify-end items-baseline" style={{ padding: "6px 10px", borderTop: `1px solid ${RULE}`, fontSize: 10.5, fontWeight: 800 }}>
              Option {S.slot} {money(S.t.grandTotal)}{hasShared && <> &nbsp;·&nbsp; <span style={{ color: DEEP }}>whole job {money(S.whole)}</span></>}
            </div>
          )}
        </div>
      ))}
      {full && optionPrint && (
        <div className="break-inside-avoid" style={{ borderTop: "2px solid var(--ft-text)", marginTop: 12, paddingTop: 10, display: "grid", gridTemplateColumns: `repeat(${optionPrint.sections.length}, 1fr)`, gap: 8 }}>
          {optionPrint.sections.map((S) => (
            <div key={S.slot} className="ft-popt" style={{ border: `1.3px solid ${S.color.main}`, borderRadius: 5, padding: "7px 10px 8px" }}>
              <div className="ft-pink uppercase" style={{ fontSize: 8, fontWeight: 800, letterSpacing: ".14em", color: S.color.main }}>Option {S.slot}{S.title !== `Option ${S.slot}` ? ` · ${S.title}` : ""}</div>
              <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{money(S.whole)}</div>
              {hasShared && <div style={{ fontSize: 7.5, color: "var(--ft-paper-muted)" }}>incl. shared areas {money(optionPrint.sharedT.grandTotal)}</div>}
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-between items-start break-inside-avoid" style={{ gap: 20, marginTop: 10 }}>
        <div>{specialLine}</div>
        {full && !optionPrint && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "auto auto", justifyContent: "end", gap: "2px 26px", fontSize: 10.5 }}>
              {totalRow("Flooring & trim", flooringPrice + miscCost)}
              {materialsCost > 0 && totalRow("Install materials", materialsCost)}
              {freightCost > 0 && totalRow("Freight", freightCost)}
              {totalRow("Estimated total", grandTotal, true)}
            </div>
          </div>
        )}
      </div>
      {waste && <div className="break-inside-avoid" style={{ fontSize: 8.5, color: FAINT, marginTop: 3, textAlign: "right" }}>Includes {waste}</div>}
    </div>
  );
}
