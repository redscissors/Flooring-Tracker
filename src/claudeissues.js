// Central Claude issue list (issue 087): the pure half — the stored issue
// shape, the source builders each flag point uses, and the paste-ready report.
// An issue's `source.snapshot` freezes the flagged thing AT FLAG TIME (plus the
// live ids), so the report stays meaningful after the row is edited or deleted.

export const QUICK_REASONS = ["Price looks wrong", "Wrong size / coverage", "Search can't find it"];

export const SOURCE_LABEL = { job: "Job line", book: "Price book", general: "General" };

export const normClaudeIssue = (raw = {}) => {
  const s = raw.source || {};
  const kind = SOURCE_LABEL[s.kind] ? s.kind : "general";
  return {
    id: raw.id || "",
    text: raw.text || "",
    done: !!raw.done,
    doneAt: raw.doneAt || null,
    createdBy: raw.createdBy || "",
    createdAt: raw.createdAt || null,
    source: {
      kind,
      custId: s.custId || "", custName: s.custName || "", areaName: s.areaName || "",
      productId: s.productId || "",
      bookId: s.bookId || "", bookName: s.bookName || "",
      sku: s.sku || "",
      snapshot: s.snapshot || null,
    },
  };
};

// Where the issue came from, as one display line.
export const issueRef = (issue) => {
  const s = issue.source || {};
  if (s.kind === "job") return [s.custName, s.areaName, s.snapshot?.brandColor || s.sku].filter(Boolean).join(" · ") || "Job line";
  if (s.kind === "book") return [s.bookName, s.sku].filter(Boolean).join(" · ") || "Price book";
  return "Typed on the list";
};

// Source builders — each flag point hands the popover one of these.
export const jobSource = (project, area, p) => ({
  kind: "job",
  custId: project?.id || "", custName: project?.name || "",
  areaName: area?.name || "", productId: p?.id || "",
  bookId: p?.bookId || "", sku: p?.sku || "",
  snapshot: p ? {
    type: p.type, sku: p.sku, brandColor: p.brandColor, sizeText: p.sizeText,
    L: p.L, W: p.W, priceSqft: p.priceSqft, qtyType: p.qtyType, qty: p.qty,
    cartonSf: p.cartonSf, cartonPc: p.cartonPc, cartonUnit: p.cartonUnit,
    sellUnit: p.sellUnit, note: p.note,
  } : null,
});

// `extra` folds additional context into the snapshot — the import wizard passes
// { importDiff: "new in this import" / "Cost 2.1 → 2.35 · …" } so an issue
// flagged mid-review records why the row caught the eye.
export const bookSource = (book, item, extra) => ({
  kind: "book",
  bookId: book?.id || "", bookName: book?.name || "", sku: item?.sku || "",
  snapshot: item ? {
    sku: item.sku, description: item.description, mfg: item.mfg, size: item.size,
    unit: item.unit, priceUnit: item.priceUnit, orderUnit: item.orderUnit,
    cost: item.cost, sfPerUnit: item.sfPerUnit, pcPerUnit: item.pcPerUnit,
    disabled: item.disabled, active: item.active,
    ...(extra || {}),
  } : null,
});

// The context lines the flag popover shows under "Captured automatically".
export const sourceLines = (source) => {
  const s = source || {};
  if (s.kind === "job") {
    return [
      [s.custName, s.areaName].filter(Boolean).join(" · "),
      [s.snapshot?.sizeText, s.snapshot?.brandColor, s.sku && `SKU ${s.sku}`].filter(Boolean).join(" · "),
    ].filter(Boolean);
  }
  if (s.kind === "book") {
    return [s.bookName, [s.sku, s.snapshot?.description].filter(Boolean).join(" — "), s.snapshot?.importDiff].filter(Boolean);
  }
  return [];
};

// The whole open bucket as one paste-ready markdown report — the per-book
// copy report (pricebooklib) generalized across every source.
export const issueReport = (issues) => {
  const open = (issues || []).filter((i) => !i.done);
  const when = (t) => (t ? new Date(t).toLocaleDateString() : "");
  return [
    "# Claude issues — FloorTrack",
    `${open.length} open issue${open.length === 1 ? "" : "s"}`,
    "",
    ...open.map((i) => {
      const { kind, ...ctx } = i.source;
      return [
        `## ${SOURCE_LABEL[kind]} — ${issueRef(i)}`,
        i.text || "(no note — context only)",
        `Flagged${i.createdBy ? ` by ${i.createdBy}` : ""}${i.createdAt ? ` on ${when(i.createdAt)}` : ""}`,
        ...(i.source.snapshot ? ["```json", JSON.stringify(ctx, null, 1), "```"] : []),
        "",
      ].filter(Boolean).join("\n");
    }),
  ].join("\n");
};
