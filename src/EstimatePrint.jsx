import { Fragment } from "react";
import { normPrintPricing, tierTag } from "./pricing.js";
import { num } from "./catalog.js";
import { money, sf1, wasteNote, wasteMeta, miscQty, rowBlank, quickPrintName } from "./model.js";
import { TLBL, THICK } from "./uiconst.js";
import { printProduct, printAreaFloor, areaPrintLabel, PRINT_COLS, PRINT_COLS_UNIT, PRINT_COLS_NONE, KSHORT, ESTIMATE_PRINT_LAYOUT, u1 } from "./print.js";
import { unitNoun } from "./units.js";
import NedMark from "./NedMark.jsx";
import NedLogo from "./NedLogo.jsx";
import keimLogo from "./assets/keim-logo-ink.png";

export const PRINT_DASH = <span style={{ color: "var(--ft-faint)" }}>—</span>;

export function EstimatePaper({ sel, people, profile, tv, jobWaste, pMats, tSet, materialsCost, freightCost = 0, flooringPrice, miscCost, totalSqft, orderedSqft, grandTotal, optionPrint = null, scopeNote = "" }) {
  // pMats already carries the job's freight as its own trailing "Freight" group
  // (App.jsx appends freightPrintRows), so the breakdown band renders it with
  // everything else — but the band's subtotal has to count it, and the meta line
  // names it separately: freight is the vendor's shipping, not the shop's
  // sundries, and a customer asking "what's the $79" deserves the word.
  const extrasCost = materialsCost + freightCost;
  // The estimate "paper" — renders in BOTH the print layout and the on-screen
  // Print preview tab (one source, so the preview can never drift from what
  // prints). Callers guard sel && sel._full. Two layouts live here: the card
  // redesign (renderEstimatePaperCards, default) and the prior table sheet
  // (renderEstimatePaperClassic), selected by ESTIMATE_PRINT_LAYOUT.
  const renderEstimatePaperClassic = () => {
    // Print pricing switch (spec 2026-07-16): "full" prints everything, "unit"
    // keeps per-unit prices but no line/job totals, "none" prints no money at
    // all (the sheet still works as a selection/scope document). The tier tag
    // only prints when some price does — it explains the numbers.
    const pMode = normPrintPricing(sel.printPricing);
    const showUnit = pMode !== "none", showTotals = pMode === "full";
    const pCols = showTotals ? PRINT_COLS : showUnit ? PRINT_COLS_UNIT : PRINT_COLS_NONE;
    const tag = showUnit ? tierTag(tv.tier, tv.pct) : "";
    return (
          <div>
            <div className="flex justify-between items-center mb-5" style={{ borderBottom: "2px solid var(--ft-text)", paddingBottom: 16 }}>
              <img src={keimLogo} alt="Keim" style={{ height: 40, width: "auto", display: "block" }} />
              <div className="flex flex-col items-end" style={{ gap: 4 }}>
                <div className="uppercase" style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".14em", color: "var(--ft-brand-deep)", lineHeight: 1.45, textAlign: "right" }}>Flooring &amp; Tile<br />Selections</div>
                {sel.projectNo && <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".02em" }}>N{sel.projectNo}</div>}
                <div className="ft-mono" style={{ fontSize: 9.5, color: "var(--ft-muted)" }}>{new Date().toLocaleDateString()}</div>
                {tag && <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".18em", color: "var(--ft-brand-deep)" }}>{tag}</div>}
              </div>
            </div>
            {(() => {
              const cust = people.find((c) => c.id === sel.customerId);
              // Pre-snapshot projects have no salesperson — fall back to the
              // signed-in profile, which is exactly what they printed before.
              const sp = sel.salesperson || profile;
              const pname = sp.name || sp.email;
              const wMeta = wasteMeta(jobWaste, "waste factor");
              const printName = sel.quick ? quickPrintName(sel) : sel.name;
              const col = (label, name, details) => (
                <div className="flex flex-col" style={{ gap: 2 }}>
                  <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".2em", color: "var(--ft-faint)" }}>{label}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{name || PRINT_DASH}</div>
                  {details.filter(Boolean).map((d, j) => <div key={j} style={{ fontSize: 11, color: "var(--ft-muted)" }}>{d}</div>)}
                </div>
              );
              return (
                <div className="mb-5" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                  {col("Customer", cust?.name || printName, [cust?.address || sel.address])}
                  {col("Your salesperson", pname, [sp.phone, sp.email].filter((x) => x && x !== pname))}
                  {col("Project", printName, [wMeta])}
                </div>
              );
            })()}
            {sel.notes && <div className="text-sm mb-4 italic text-slate-600">{sel.notes}</div>}
            {tv.proj.categories.map((a, ai) => { const areaSf = a.products.reduce((t, p) => t + (p.qtyType === "sqft" ? num(p.qty) : 0), 0); return (
              <div key={a.id} className="mb-5 break-inside-avoid">
                <div className="ft-pband flex justify-between items-center" style={{ background: "var(--ft-paper-band)", borderRadius: 4, padding: "8px 12px" }}>
                  <div className="uppercase" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".22em", color: "var(--ft-brand-deep)" }}>{areaPrintLabel(a, ai)}</div>
                  <div className="ft-mono" style={{ fontSize: 10 }}>{[areaSf > 0 ? `${sf1(areaSf)} SF` : "", showTotals && printAreaFloor(a, tSet) > 0 ? money(printAreaFloor(a, tSet)) : ""].filter(Boolean).join(" · ")}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: pCols, gap: 7, padding: "8px 12px 6px", borderBottom: "1px solid var(--ft-text)", fontSize: 8, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ft-faint)" }}>
                  <div>Size</div><div>Product / Color</div><div>SKU</div><div>Cov.</div>
                  <div className="text-right">SF</div>{showUnit && <div className="text-right">Price</div>}<div className="text-right">Order</div>{showTotals && <div className="text-right">Total</div>}
                </div>
                {a.products.filter((p) => !rowBlank(p)).map((p, pi) => { const c = printProduct(p, tSet); const inline = c.mats.filter((m) => m.inline); const thickLabel = p.type === "tile" && p.thickness ? THICK.find((t) => t.v === String(p.thickness))?.label || `${p.thickness}"` : ""; return (
                  <Fragment key={p.id}>
                    <div style={{ display: "grid", gridTemplateColumns: pCols, gap: 7, padding: "2px 12px 6px", fontSize: 11, alignItems: "baseline", borderTop: pi > 0 ? "1px solid var(--ft-border)" : "none" }}>
                      <div style={{ whiteSpace: "nowrap" }}>{p.type === "tile" ? <>{p.sizeText || (p.L && p.W ? `${p.L}×${p.W}` : PRINT_DASH)}{thickLabel && <span style={{ fontSize: 9.5, color: "var(--ft-muted)" }}> · {thickLabel}</span>}</> : (p.sizeText || PRINT_DASH)}</div>
                      <div style={{ fontWeight: 700 }}>{p.brandColor || TLBL[p.type]}{p.brandColor && <span style={{ fontWeight: 400, fontSize: 10, color: "var(--ft-muted)" }}> · {TLBL[p.type]}</span>}</div>
                      <div className="ft-mono" style={{ fontSize: 9 }}>{p.sku || PRINT_DASH}</div>
                      <div className="ft-mono" style={{ fontSize: 9.5 }}>{c.C ? <>{sf1(c.C.sf)}<span style={{ fontSize: 7.5, color: "var(--ft-muted)" }}> SF/{c.C.unit.toUpperCase()}</span></> : PRINT_DASH}</div>
                      <div className="text-right">{p.qtyType === "sqft" && num(p.qty) > 0 ? sf1(num(p.qty)) : PRINT_DASH}</div>
                      {showUnit && <div className="text-right whitespace-nowrap">{num(p.priceSqft) > 0 ? <>{money(num(p.priceSqft))}<span style={{ fontSize: 8, color: "var(--ft-muted)" }}>/{c.priceUnit.toLowerCase()}</span></> : PRINT_DASH}</div>}
                      <div className="text-right whitespace-nowrap">{p.type === "misc" ? c.qtyText : c.C && c.C.order > 0 ? `${c.C.order} ${c.C.unit}` : c.qtyText || PRINT_DASH}</div>
                      {showTotals && <div className="text-right" style={{ fontWeight: 700 }}>{c.line > 0 ? money(c.line) : PRINT_DASH}</div>}
                    </div>
                    {inline.length > 0 && (
                      <div style={{ padding: "0 12px 4px 24px", fontSize: 9.5, color: "var(--ft-muted)", display: "flex", gap: 16, flexWrap: "wrap" }}>
                        {inline.map((m, i) => (
                          <span key={i}>
                            <span style={{ fontWeight: 700, color: "var(--ft-brand-deep)" }}>{KSHORT[m.kind] || m.kind}</span>{m.order > 0 ? ` ${m.order}` : ""} · {m.kind === "Caulk" ? "Matching caulk" : <>{m.name}{m.spec && <> — {m.spec}</>}{m.detail && <span style={{ color: "var(--ft-faint)" }}> · {m.detail}</span>}</>}
                          </span>
                        ))}
                      </div>
                    )}
                    {p.note && <div className="italic" style={{ padding: "0 12px 6px 24px", fontSize: 10.5, color: "var(--ft-muted)" }}>{p.note}</div>}
                  </Fragment>
                ); })}
              </div>
            ); })}
            {pMats.length > 0 && (
              <div className="break-inside-avoid mb-4">
                <div className="uppercase mb-2" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".22em", color: "var(--ft-brand-deep)" }}>Setting materials &amp; sundries</div>
                <div className="ft-pbox" style={{ background: "var(--ft-paper-band)", borderRadius: 4, padding: "14px 16px" }}>
                  <div style={{ columns: 2, columnGap: 28 }}>
                    {(() => {
                      // pMats is pre-sorted by PRINT_KINDS, so same-kind items are
                      // already adjacent — one heading per category, its items listed
                      // beneath it (no repeated category labels).
                      const groups = [];
                      pMats.forEach((m) => {
                        const g = groups[groups.length - 1];
                        if (g && g.kind === m.kind) g.items.push(m);
                        else groups.push({ kind: m.kind, items: [m] });
                      });
                      return groups.map((g, gi) => (
                        <div key={gi} className="break-inside-avoid" style={{ marginBottom: 12 }}>
                          <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".2em", color: "var(--ft-brand-deep)", marginBottom: 3 }}>{g.kind}</div>
                          {g.items.map((m, i) => (
                            <div key={i} style={{ marginBottom: 4 }}>
                              <div style={{ fontSize: 11.5, fontWeight: 700 }}>{m.name}{m.order > 0 && <> · {m.order} {u1(m.order, m.unit)}</>} <span className="ft-mono" style={{ fontWeight: 400, fontSize: 10 }}>{!showUnit ? "" : showTotals && m.cost > 0 ? money(m.cost) : m.price > 0 ? `${money(m.price)}/${u1(1, m.unit)}` : ""}</span></div>
                              <div style={{ fontSize: 10, color: "var(--ft-muted)" }}>{[m.spec, m.sku, m.exact > 0 ? `(${m.exact.toFixed(2)})` : ""].filter(Boolean).join(" · ")}</div>
                            </div>
                          ))}
                        </div>
                      ));
                    })()}
                  </div>
                  {showTotals && (
                  <div className="flex justify-between items-baseline" style={{ borderTop: "1px solid var(--ft-border)", marginTop: 2, paddingTop: 8 }}>
                    <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".2em", color: "var(--ft-brand-deep)" }}>{freightCost > 0 ? "Materials & freight" : "Materials subtotal"}</div>
                    <div className="ft-mono" style={{ fontSize: 12, fontWeight: 700 }}>{money(extrasCost)}</div>
                  </div>
                  )}
                </div>
              </div>
            )}
            <div className="break-inside-avoid">
              <div className="flex justify-between items-center gap-4" style={{ borderTop: "2px solid var(--ft-text)", paddingTop: 12 }}>
                <div style={{ fontSize: 11, color: "var(--ft-muted)" }}>
                  {[
                    showTotals && flooringPrice + miscCost > 0 ? `Flooring ${money(flooringPrice + miscCost)}` : "",
                    showTotals && materialsCost > 0 ? `Materials ${money(materialsCost)}` : "",
                    showTotals && freightCost > 0 ? `Freight ${money(freightCost)}` : "",
                    totalSqft > 0 ? `${totalSqft.toLocaleString()} SF measured${orderedSqft > 0 ? `, ${sf1(orderedSqft)} ordered` : ""}` : "",
                  ].filter(Boolean).join(" · ")}
                </div>
                {showTotals && grandTotal > 0 && <div className="flex items-baseline gap-2 shrink-0"><span className="uppercase" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".2em", color: "var(--ft-brand-deep)" }}>Estimated total</span><span className="ft-serif" style={{ fontSize: 22 }}>{money(grandTotal)}</span></div>}
              </div>
              <div className="mt-2" style={{ fontSize: 10.5, color: "var(--ft-muted)" }}>Quantities{showUnit ? " and prices" : ""} are estimates{wasteNote(jobWaste) ? `, incl. ${wasteNote(jobWaste)}` : ""}. Confirm against product specs and final measurements before ordering.</div>
            </div>
            <div className="break-inside-avoid flex mt-6" style={{ gap: 40 }}>
              <div className="flex-1 flex flex-col" style={{ gap: 4 }}>
                <div style={{ borderBottom: "1px solid var(--ft-text)", height: 28 }} />
                <div className="uppercase" style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".18em", color: "var(--ft-faint)" }}>Customer approval</div>
              </div>
              <div className="flex flex-col" style={{ width: 160, gap: 4 }}>
                <div style={{ borderBottom: "1px solid var(--ft-text)", height: 28 }} />
                <div className="uppercase" style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".18em", color: "var(--ft-faint)" }}>Date</div>
              </div>
            </div>
            <div className="break-inside-avoid flex justify-between items-center mt-5" style={{ borderTop: "1px solid var(--ft-paper-footer)", paddingTop: 10 }}>
              <div className="flex items-center gap-2">
                <NedLogo height={17} />
              </div>
              <div className="text-[9.5px] text-slate-400">Prepared with the ned</div>
            </div>
          </div>
    );
  };
  // Receipt-card estimate (2026-07). Each product is a card: name + spec +
  // material chips on the left, a right rail (qty · unit price · line total) on
  // the right. The unit always carries its unit ($/sf, and $/carton when sold by
  // the carton; $/ea for counted lines) so the price is never ambiguous. Per-area
  // totals are dropped; material costs collect once in the "Extras" block, which
  // meets flooring at the single Estimated total. Pricing switch: "full" shows
  // qty+unit+totals, "unit" shows unit price only (no qty, no totals), "none"
  // shows product + spec only (and drops the area extras note).
  const renderEstimatePaperCards = () => {
    const pMode = normPrintPricing(sel.printPricing);
    const showUnit = pMode !== "none", showTotals = pMode === "full";
    const tag = showUnit ? tierTag(tv.tier, tv.pct) : "";
    const cust = people.find((c) => c.id === sel.customerId);
    const sp = sel.salesperson || profile;
    const pname = sp.name || sp.email;
    const printName = sel.quick ? quickPrintName(sel) : sel.name;
    // CT/SH/RL read as cartons/sheets/rolls on the qty line; the price keeps the
    // short unit.
    const unitLong = (unit, n) => unitNoun(n, unit);
    const groups = [];
    pMats.forEach((m) => { const g = groups[groups.length - 1]; if (g && g.kind === m.kind) g.items.push(m); else groups.push({ kind: m.kind, items: [m] }); });
    // Extracted so the shared-areas map and the option bands render an
    // identical product card — one implementation, no drift.
    const renderProduct = (p, pi) => {
      const c = printProduct(p, tSet);
      const inline = c.mats.filter((m) => m.inline);
      const isEach = p.type === "misc" || p.qtyType === "count";
      const typeLbl = TLBL[p.type] || "";
      const specParts = [c.size, c.C ? `${sf1(c.C.sf)} SF/${c.C.unit}` : "", p.sku ? `SKU ${p.sku}` : ""].filter(Boolean).join(" · ");
      const cartonPrice = c.C ? c.C.sf * num(p.priceSqft) : 0;
      const qtyLine = c.C ? `${sf1(c.orderedSf)} SF ordered · ${c.C.order} ${unitLong(c.C.unit, c.C.order)}` : (num(p.qty) > 0 ? `${sf1(num(p.qty))} SF` : "");
      const eachQty = p.type === "misc" ? (c.PC ? `${c.PC.pieces} pcs` : `${miscQty(p)} ${unitNoun(miscQty(p), c.countUnit)}`) : (num(p.qty) > 0 ? `${p.qty} ${unitNoun(num(p.qty), c.countUnit)}` : "");
      // breakInside keeps a card whole across a page turn; the AREA no longer
      // refuses to split (issue 090 — whole-area avoidance orphaned big areas
      // onto fresh pages and left page tails blank).
      return (
        <div key={p.id} className="flex justify-between" style={{ gap: 18, padding: "2.5px 10px", borderTop: pi > 0 ? "1px solid var(--ft-paper-rule)" : "none", breakInside: "avoid" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 11.5, lineHeight: 1.25 }}>{p.brandColor || typeLbl}</div>
            {specParts && <div style={{ fontSize: 9.5, lineHeight: 1.3, color: "var(--ft-muted)", marginTop: 1 }}>{specParts}</div>}
            {inline.length > 0 && (
              <div className="flex flex-wrap" style={{ gap: 5, marginTop: 3 }}>
                {inline.map((m, i) => (
                  <span key={i} className="ft-pchip" style={{ fontSize: 9, background: "var(--ft-brand-soft)", color: "var(--ft-brand-deep)", borderRadius: 20, padding: "1px 8px", fontWeight: 600, whiteSpace: "nowrap" }}>
                    <b style={{ fontWeight: 800 }}>{KSHORT[m.kind] || m.kind}</b>{m.order > 0 ? ` ${m.order}` : ""} · {m.kind === "Caulk" ? "Matching caulk" : `${m.name}${m.spec ? ` — ${m.spec}` : ""}${m.kind === "Grout" && m.detail ? ` · ${m.detail}` : ""}`}
                  </span>
                ))}
              </div>
            )}
            {p.note && <div style={{ fontSize: 9.5, lineHeight: 1.3, fontStyle: "italic", color: "var(--ft-muted)", marginTop: 2 }}>{p.note}</div>}
          </div>
          <div className="ft-mono" style={{ textAlign: "right", whiteSpace: "nowrap", flexShrink: 0 }}>
            {isEach ? (
              <>
                {showUnit && <div style={{ fontSize: 10, lineHeight: 1.3, color: "var(--ft-text)", marginTop: 1 }}>{showTotals && eachQty ? <span style={{ color: "var(--ft-muted)" }}>{eachQty}{num(p.priceSqft) > 0 ? " · " : ""}</span> : null}{num(p.priceSqft) > 0 ? `${money(num(p.priceSqft))}/${c.priceUnit.toLowerCase()}` : null}</div>}
                {showTotals && c.line > 0 && <div style={{ fontSize: 12.5, lineHeight: 1.3, fontWeight: 800, marginTop: 1 }}>{money(c.line)}</div>}
              </>
            ) : (
              <>
                {showTotals && qtyLine && <div style={{ fontSize: 9.5, lineHeight: 1.3, color: "var(--ft-muted)" }}>{qtyLine}</div>}
                {showUnit && num(p.priceSqft) > 0 && <div style={{ fontSize: 10, lineHeight: 1.3, color: "var(--ft-text)", marginTop: 1 }}>{money(num(p.priceSqft))}/{c.priceUnit.toLowerCase()}{c.C ? <span style={{ color: "var(--ft-muted)" }}> · {money(cartonPrice)}/{String(c.C.unit).toLowerCase()}</span> : null}</div>}
                {showTotals && c.line > 0 && <div style={{ fontSize: 12.5, lineHeight: 1.3, fontWeight: 800, marginTop: 1 }}>{money(c.line)}</div>}
              </>
            )}
          </div>
        </div>
      );
    };
    const areas = optionPrint ? tv.proj.categories.filter((a) => !a.option) : tv.proj.categories;
    // "Whole job" beside an option total only earns its ink when shared areas
    // actually add cost — otherwise it repeats the option total verbatim.
    const hasShared = !!optionPrint && optionPrint.sharedT.grandTotal > 0;
    // Compact header (issue 090, owner sketch 2026-08-16): the badge holds the
    // page's true center on a 1fr/auto/1fr grid, its disclaimer wrapping inside
    // so it stays narrow; the right block is the sheet title over number + date.
    // The second row is the same grid — customer stack (name/phone/address) at
    // the left edge, salesperson stack (name/phone/email) at the right, and the
    // project name centered between them, where it has the row's width to
    // itself. Waste no longer prints here — the line beside the total carries
    // it. The stack line height everywhere is the tight 1.35.
    const stackLine = { fontSize: 9.5, lineHeight: 1.35, color: "var(--ft-muted)" };
    return (
      <div style={{ fontSize: 11, color: "var(--ft-text)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 14, borderBottom: "2px solid var(--ft-text)", paddingBottom: 7 }}>
          <img src={keimLogo} alt="Keim" style={{ height: 32, width: "auto", display: "block" }} />
          <div className="ft-pbadge" style={{ maxWidth: 190, textAlign: "center", background: "#f4ebd6", border: "1px solid #d8c48c", borderRadius: 5, padding: "2px 12px", lineHeight: 1.25 }}>
            <div className="uppercase" style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".06em", color: "#7a5a1c" }}>Rough Estimate</div>
            <div style={{ fontSize: 8, color: "var(--ft-muted)" }}>For planning purposes only · pricing subject to change on final order</div>
          </div>
          <div style={{ minWidth: 0, textAlign: "right" }}>
            <div className="uppercase" style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".14em", color: "var(--ft-brand-deep)", whiteSpace: "nowrap", marginBottom: 1 }}>Flooring &amp; Tile Selections</div>
            <div className="flex items-baseline justify-end" style={{ gap: 8, whiteSpace: "nowrap" }}>
              {sel.projectNo && <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".02em" }}>N{sel.projectNo}</span>}
              <span className="ft-mono" style={{ fontSize: 9.5, color: "var(--ft-muted)" }}>{new Date().toLocaleDateString()}</span>
            </div>
            {tag && <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: ".18em", color: "var(--ft-brand-deep)" }}>{tag}</div>}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 18, padding: "5px 0 6px", borderBottom: "1px solid var(--ft-paper-rule)", marginBottom: 8 }}>
          {/* No customer record → no name fallback here: the centered project
              name already identifies the job, and repeating it as a fake
              customer prints the same words twice on one line. */}
          <div>
            {cust?.name && <div style={{ fontSize: 11, fontWeight: 800, lineHeight: 1.35 }}>{cust.name}</div>}
            {(cust?.phone || sel.phone) && <div style={stackLine}>{cust?.phone || sel.phone}</div>}
            {(cust?.address || sel.address) && <div style={stackLine}>{cust?.address || sel.address}</div>}
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 12.5, fontWeight: 800 }}>{printName || PRINT_DASH}</div>
            {scopeNote && <div style={stackLine}>{scopeNote}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, lineHeight: 1.35 }}>{pname || PRINT_DASH}</div>
            {[sp.phone, sp.email].filter((x) => x && x !== pname).map((d, j) => <div key={j} style={stackLine}>{d}</div>)}
          </div>
        </div>
        {sel.notes && <div style={{ fontSize: 11, fontStyle: "italic", color: "var(--ft-muted)", margin: "0 0 8px" }}>{sel.notes}</div>}

        {/* Areas may split across a page turn (cards themselves never do, and
            the band sticks with its first card via breakAfter) — refusing to
            split whole areas is what pushed big jobs onto a third page. */}
        {areas.map((a, ai) => {
          const areaHasExtras = a.products.some((p) => printProduct(p, tSet).mats.length > 0);
          return (
            <div key={a.id} style={{ marginBottom: 5 }}>
              <div className="ft-pband flex justify-between items-center" style={{ gap: 12, background: "var(--ft-paper-band)", borderRadius: 4, padding: "3px 10px", breakAfter: "avoid" }}>
                <div className="uppercase" style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".22em", color: "var(--ft-brand-deep)" }}>{areaPrintLabel(a, ai)}</div>
                {showUnit && areaHasExtras && <div style={{ fontSize: 9, fontStyle: "italic", color: "var(--ft-muted)", whiteSpace: "nowrap" }}><b style={{ fontStyle: "normal", fontWeight: 800, color: "var(--ft-brand-deep)" }}>＋</b> extras priced below</div>}
              </div>
              {a.products.filter((p) => !rowBlank(p)).map((p, pi) => renderProduct(p, pi))}
            </div>
          );
        })}

        {pMats.length > 0 && (
          <div style={{ margin: "10px 0 5px" }}>
            <div className="uppercase" style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".22em", color: "var(--ft-brand-deep)", marginBottom: 4, breakAfter: "avoid" }}>{optionPrint ? "Setting materials & sundries — shared areas" : "Extras"}</div>
            <div className="ft-pbox" style={{ background: "var(--ft-paper-band)", borderRadius: 4, padding: "8px 12px" }}>
              <div style={{ columns: 2, columnGap: 28 }}>
                {groups.map((g, gi) => (
                  <div key={gi} className="break-inside-avoid" style={{ marginBottom: 6 }}>
                    <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: ".2em", color: "var(--ft-brand-deep)", marginBottom: 2 }}>{g.kind}</div>
                    {g.items.map((m, i) => (
                      <div key={i} className="flex justify-between" style={{ gap: 14, alignItems: "baseline", marginBottom: 4, breakInside: "avoid" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 10.5, fontWeight: 800 }}>{m.name}{m.spec ? ` — ${m.spec}` : ""}</div>
                          {/* A grout's detail (joint width) prints on its product's puck above,
                              where the joint was chosen — not repeated down here. */}
                          {((m.kind !== "Grout" && m.detail) || m.sku) && <div style={{ fontSize: 9.5, color: "var(--ft-muted)", marginTop: 1 }}>{[m.kind !== "Grout" ? m.detail : "", m.sku ? `SKU ${m.sku}` : ""].filter(Boolean).join(" · ")}</div>}
                        </div>
                        <div className="ft-mono" style={{ textAlign: "right", whiteSpace: "nowrap", flexShrink: 0 }}>
                          {(showTotals && m.order > 0) || (showUnit && m.price > 0) ? (
                            <div style={{ fontSize: 9.5, color: "var(--ft-muted)" }}>
                              {showTotals && m.order > 0 && <span>{m.order} {u1(m.order, m.unit)}{showUnit && m.price > 0 ? " · " : ""}</span>}
                              {showUnit && m.price > 0 && <span style={{ color: "var(--ft-text)" }}>{money(m.price)}/{u1(1, m.unit)}</span>}
                            </div>
                          ) : null}
                          {showTotals && m.cost > 0 && <div style={{ fontSize: 11.5, fontWeight: 800, marginTop: 1 }}>{money(m.cost)}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              {showTotals && (
                <div className="flex justify-between items-baseline" style={{ borderTop: "1px solid var(--ft-paper-rule)", marginTop: 2, paddingTop: 5 }}>
                  <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: ".2em", color: "var(--ft-brand-deep)" }}>{optionPrint ? "Shared job subtotal" : "Extras subtotal"}</div>
                  <div className="ft-mono" style={{ fontSize: 12, fontWeight: 800 }}>{money(optionPrint ? optionPrint.sharedT.grandTotal : extrasCost)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {optionPrint && (
          <>
            {/* An option band may split across pages like an area does; its
                header sticks to the first card and the materials box stays
                whole. overflow:hidden had to go with the split — it clips the
                second page's half otherwise — so the rounded corners are only
                on the header band. */}
            {optionPrint.sections.map((S) => (
              <div key={S.slot} className="ft-popt" style={{ border: `1.3px solid ${S.color.main}`, borderRadius: 5, marginBottom: 7 }}>
                <div className="ft-pband flex items-center uppercase" style={{ gap: 8, background: S.color.main, color: "#fff", borderRadius: "3.5px 3.5px 0 0", padding: "3px 10px", fontSize: 8.5, fontWeight: 800, letterSpacing: ".18em", breakAfter: "avoid" }}>
                  Option {S.slot}{S.title !== `Option ${S.slot}` ? ` · ${S.title}` : ""}
                  {/* Only areas someone actually named earn the header — a list of
                      "Area 01 · Area 02" placeholders says nothing. */}
                  {S.cats.some((a) => (a.name || "").trim()) && <span style={{ marginLeft: "auto", textTransform: "none", letterSpacing: 0, fontSize: 9, fontWeight: 700 }}>{S.cats.filter((a) => (a.name || "").trim()).map((a) => a.name.trim()).join(" · ")}</span>}
                </div>
                {S.cats.flatMap((a) => a.products.filter((p) => !rowBlank(p))).map((p, pi) => renderProduct(p, pi))}
                {showTotals && S.t.matLines.length > 0 && (
                  <div className="ft-pbox" style={{ margin: "2px 8px 8px", borderRadius: 4, padding: "7px 10px 8px", background: `color-mix(in srgb, ${S.color.main} 7%, #fff)`, breakInside: "avoid" }}>
                    <div className="ft-pink uppercase" style={{ fontSize: 7, fontWeight: 800, letterSpacing: ".2em", color: S.color.main, marginBottom: 4 }}>Materials for this option</div>
                    {S.t.matLines.map((m, i) => (
                      <div key={i} className="flex justify-between" style={{ gap: 12, fontSize: 8.8, padding: "1.5px 0" }}>
                        <span><b style={{ fontWeight: 800 }}>{m.kind}</b> · {m.product} — {m.order} {u1(m.order, m.unit)}{m.sku ? <span style={{ color: "var(--ft-muted)", fontSize: 8 }}> · SKU {m.sku}</span> : null}</span>
                        <span style={{ whiteSpace: "nowrap" }}>{m.order > 1 ? `${m.order} × ${money(m.price)} · ` : ""}{money(m.cost)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between" style={{ borderTop: "1px solid var(--ft-paper-rule)", marginTop: 4, paddingTop: 3, fontSize: 8.5, fontWeight: 800 }}><span>Materials — Option {S.slot}</span><span>{money(S.t.materialsCost + S.t.freightCost)}</span></div>
                  </div>
                )}
                {showTotals && (
                  <div className="flex justify-end items-baseline" style={{ padding: "6px 10px", borderTop: "1px solid var(--ft-paper-rule)", fontSize: 9, background: "color-mix(in srgb, var(--ft-paper-band) 55%, #fff)" }}>
                    <span style={{ fontWeight: 800, fontSize: 10.5 }}>Option {S.slot} {money(S.t.grandTotal)}{hasShared && <> &nbsp;·&nbsp; <span style={{ color: "var(--ft-brand-deep)" }}>whole job {money(S.whole)}</span></>}</span>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {showTotals && optionPrint && (
          <div className="break-inside-avoid" style={{ borderTop: "2px solid var(--ft-text)", marginTop: 12, paddingTop: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${optionPrint.sections.length}, 1fr)`, gap: 8 }}>
              {optionPrint.sections.map((S) => (
                <div key={S.slot} className="ft-popt" style={{ border: `1.3px solid ${S.color.main}`, borderRadius: 5, padding: "7px 10px 8px" }}>
                  <div className="ft-pink uppercase" style={{ fontSize: 8, fontWeight: 800, letterSpacing: ".14em", color: S.color.main }}>Option {S.slot}{S.title !== `Option ${S.slot}` ? ` · ${S.title}` : ""}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{money(S.whole)}</div>
                  {hasShared && <div style={{ fontSize: 7.5, color: "var(--ft-paper-muted)" }}>incl. shared areas {money(optionPrint.sharedT.grandTotal)}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
        {showTotals && !optionPrint && grandTotal > 0 && (
          <div className="break-inside-avoid flex justify-end items-baseline" style={{ borderTop: "2px solid var(--ft-text)", paddingTop: 8, marginTop: 8 }}>
            <div className="flex items-baseline" style={{ gap: 10 }}>
              <span className="uppercase" style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".2em", color: "var(--ft-brand-deep)" }}>Estimated total</span>
              <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.01em" }}>{money(grandTotal)}</span>
            </div>
          </div>
        )}
        {/* The waste factor's one appearance since it left the header (issue
            090) — so it prints in every pricing mode, not just "full". */}
        {wasteNote(jobWaste) && <div className="break-inside-avoid" style={{ fontSize: 9.5, color: "var(--ft-faint)", marginTop: 5, textAlign: "right" }}>Includes {wasteNote(jobWaste)}</div>}

        <div className="break-inside-avoid flex justify-center items-center" style={{ gap: 7, borderTop: "1px solid var(--ft-paper-footer)", paddingTop: 8, marginTop: 12 }}>
          <span style={{ fontSize: 10.5, color: "var(--ft-faint)" }}>Prepared with</span>
          <NedMark size={18} />
        </div>
      </div>
    );
  };
  return ESTIMATE_PRINT_LAYOUT === "classic" ? renderEstimatePaperClassic() : renderEstimatePaperCards();
}
