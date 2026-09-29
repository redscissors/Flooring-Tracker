// The shared wedi+Schluter basket drawer (spec 2026-09-29 §1): every staged
// entry of either brand, priced live through basketkit.js. LAZY-CHUNK-ONLY
// (ADR 0026): basketkit reaches both engines, so each popup mounts this via
// React.lazy and neither popup's own chunk pulls in the other engine.
import { useMemo, useState } from "react";
import { KitBasketPanel } from "./widgets.jsx";
import { useSchluterCatalog } from "./useschlutercatalog.js";
import { useWediCatalog } from "./usewedicatalog.js";
import { entryView, placedView, moveable, optionsFromEntries } from "./basketkit.js";
import { BRAND } from "./comparegrid.js";
import { OPTION_SLOTS } from "./model.js";

const loadingView = (brand) => ({
  title: `${BRAND[brand]} kit`, meta: `Loading the ${BRAND[brand]} price book…`,
  price: null, faint: true, lines: null, loading: true,
});

export default function ShowerBasket({
  host, basket, onBasketChange, onMoveEntries, onAddOptions, placed, onOpenPlaced, onDeleteKit,
  areaName, tierColor, onClose, say, freeSlots,
  tier, customPct, salePct, wediBuilderPct, schluterBuilderPct, panelFit,
  stockRows, bookStockReady, books, loadBookItems, cat, catReady,
}) {
  const wediHost = host === "wedi";
  const list = basket || [];

  // Both catalog hooks run (rules of hooks); the one whose engine the host
  // popup already owns is fed nulls / switched off, as in CompareTab.jsx.
  const own = useSchluterCatalog(wediHost
    ? { stockRows, bookStockReady, books, loadBookItems }
    : { stockRows: null, bookStockReady: false, books: null, loadBookItems: null });
  const schCat = wediHost ? own.cat : cat || [];
  const schReady = (wediHost ? own.catReady : !!catReady) && schCat.length > 0;
  const ownWedi = useWediCatalog({ bookStockReady, books, loadBookItems, enabled: !wediHost });
  const wediReady = wediHost || ownWedi.catReady;

  const ctx = useMemo(() => {
    const lens = { tier: tier || "retail", customPct, salePct: salePct ?? 10 };
    return {
      wedi: { ...lens, bPct: wediBuilderPct ?? 18, panelFit: wediHost ? panelFit : true },
      schluter: { ...lens, bPct: schluterBuilderPct ?? 8, cat: schCat, catReady: schReady, panelFit: wediHost ? true : panelFit },
    };
  }, [tier, customPct, salePct, wediBuilderPct, schluterBuilderPct, panelFit, wediHost, schCat, schReady]);
  const ready = (brand) => (brand === "wedi" ? wediReady : schReady);

  const staged = useMemo(() => list.map((e) => (ready(e.brand) ? entryView(e, ctx)
    : { id: e.id, brand: e.brand, target: e.target, ...loadingView(e.brand) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, ctx, wediReady, ownWedi.cat]);
  const placedV = useMemo(() => (placed || []).map((k) => (ready(k.brand) ? placedView(k, ctx) : { ...k, ...loadingView(k.brand) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [placed, ctx, wediReady, ownWedi.cat]);

  const [sel, setSel] = useState({});
  const picked = staged.filter((v) => sel[v.id]);

  // Only priced entries land; the rest stay staged (and selected) with a note.
  const take = (views) => {
    const { ready: go } = moveable(views);
    const waiting = views.filter((v) => v.loading).length;
    if (!go.length) {
      say(waiting ? `${waiting} still loading — they stay in the basket` : "Nothing to move — the catalog no longer knows these kits");
      return null;
    }
    const ids = new Set(go.map((v) => v.id));
    return { go, waiting, rest: list.filter((b) => !ids.has(b.id)), keepSel: Object.fromEntries(views.filter((v) => !ids.has(v.id)).map((v) => [v.id, true])) };
  };
  const done = (t) => {
    if (t.waiting) say(`${t.waiting} still loading — they stay in the basket`);
    setSel(t.keepSel);
  };

  const move = (views) => {
    const t = take(views);
    if (!t) return;
    onMoveEntries(t.go.map((v) => ({ lines: v.lines(), target: v.target })), t.rest);
    done(t);
  };

  // freeSlots is the job's free letters; without it (the Apps hub) the
  // destination decides and the check is skipped here.
  const usedCats = useMemo(() => (freeSlots ? OPTION_SLOTS.filter((s) => !freeSlots.includes(s)).map((option) => ({ option })) : []), [freeSlots]);
  const addOptions = () => {
    const t = take(picked);
    if (!t) return;
    const byId = new Map(list.map((b) => [b.id, b]));
    const r = optionsFromEntries(t.go, t.go.map((v) => byId.get(v.id)), usedCats);
    if (r.short != null) { say(`Only ${r.short} option letters left — select fewer`); return; }
    onAddOptions(r.options, t.rest);
    done(t);
  };

  return (
    <KitBasketPanel staged={staged} sel={sel}
      onToggle={(id) => setSel((s) => ({ ...s, [id]: !s[id] }))}
      onSelectAll={() => { const all = staged.every((v) => sel[v.id]); const next = {}; staged.forEach((v) => { next[v.id] = !all; }); setSel(next); }}
      onRemove={(id) => onBasketChange(list.filter((b) => b.id !== id))}
      onMove={onMoveEntries ? () => move(picked) : undefined}
      onMoveAll={() => move(staged)}
      onAddOptions={onAddOptions ? addOptions : undefined}
      placed={placedV} onEditPlaced={(k) => onOpenPlaced?.(k)} onDeletePlaced={(k) => onDeleteKit?.(k)}
      areaName={areaName} tierColor={tierColor} onClose={onClose} />
  );
}
