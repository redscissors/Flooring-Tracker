// Preview harness for the shower tile sq ft feature (spec 2026-09-23): the
// REAL jobShowers/sfPartsState/sfPartsText/SfPartsMenu/SfPartsChips over two
// placed showers (one wedi, one Schluter), no Supabase. Dev-only entry
// (sf-preview.html); not part of the app build.
//
// jobShowers is normally LAZY-CHUNK-ONLY (usejobshowers.js dynamic-imports
// it) — a static import here is fine, this file is not on the boot path.
import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Bath } from "lucide-react";
import "./index.css";
import { jobShowers } from "./showersf.js";
import { sfPartsState, sfPartsText } from "./sfparts.js";
import { SfPartsMenu, SfPartsChips } from "./SfPartsMenu.jsx";

const INITIAL_CATS = [
  {
    id: "aMaster",
    name: "Master Bath",
    products: [
      {
        id: "r1",
        kitId: "k1",
        wedi: {
          mode: "custom",
          cfg: {
            panKey: "US9100002",
            room: { w: 60, d: 36 },
            walls: [
              { side: "back", len: 60, h: 96 },
              { side: "left", len: 36, h: 96 },
              { side: "right", len: 36, h: 96 },
            ],
            curbKey: "US3000008",
            addons: ["US3000005"],
            benches: [{ kind: "wall", side: "back", len: 48 }],
          },
        },
      },
    ],
  },
  {
    id: "aGuest",
    name: "Guest Bath",
    products: [
      {
        id: "r2",
        kitId: "k2",
        schluter: {
          mode: "custom",
          cfg: {
            w: 48,
            d: 36,
            curbed: true,
            walls: [
              { name: "Back", on: true, len: 48, h: 84 },
              { name: "Left", on: true, len: 36, h: 84 },
              { name: "Right", on: true, len: 36, h: 84 },
            ],
            manual: [{ sku: "KB12SN305508A1", qty: 1 }],
          },
        },
      },
    ],
  },
];

const INITIAL_ROW = { id: "tileRow1", brandColor: "Calacatta Gold Marble 12x24", sku: "CAL1224", qtyType: "sqft", qty: "", sfParts: undefined };

const inputCls = "ft-cell text-right border border-slate-200 rounded px-1.5 py-1 text-xs";
const rowShell = "flex items-center gap-2 border-b border-slate-100 py-1.5 text-xs";
const eyebrow = "ft-eyebrow text-[10px] mb-2 block";

function Row({ label, row, showers, onPatch, onOpenMenu }) {
  const sfState = showers ? sfPartsState(row, showers) : null;
  return (
    <div>
      <div className={rowShell}>
        <span className="w-6 shrink-0 text-slate-400">{label}</span>
        <span className="flex-1 truncate font-medium">{row.brandColor}</span>
        <span className="w-20 shrink-0 text-slate-400 ft-mono">{row.sku}</span>
        <div className="flex items-center gap-1 shrink-0">
          <input
            type="number"
            value={row.qty}
            onChange={(e) => onPatch({ qty: e.target.value })}
            onContextMenu={(e) => { e.preventDefault(); onOpenMenu({ x: e.clientX, y: e.clientY }); }}
            data-c="sf"
            className={inputCls}
            style={{ width: 64 }}
            placeholder="0"
            title={row.sfParts?.length ? "Square feet — from the shower breakdown (right-click to change)" : "Square feet — right-click to take it from a shower"}
          />
          {row.sfParts?.length > 0 && (
            <button
              tabIndex={-1}
              onClick={(e) => onOpenMenu({ x: e.clientX, y: e.clientY })}
              title="Sq ft from the shower breakdown — click to change"
              className="shrink-0 text-slate-400 hover:text-slate-700"
            >
              <Bath size={11} />
            </button>
          )}
        </div>
      </div>
      {sfState && (sfState.drift || sfState.gone.length > 0 || sfState.dropped.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 py-1 text-[11px]">
          <SfPartsChips state={sfState} onPatch={onPatch} />
        </div>
      )}
      {row.sfParts?.length > 0 && (
        <div style={{ padding: "0 12px 4px 24px", fontSize: 9.5, color: "var(--ft-muted)" }}>{sfPartsText(row.sfParts)}</div>
      )}
    </div>
  );
}

function Harness() {
  const [cats, setCats] = useState(INITIAL_CATS);
  const [row, setRow] = useState(INITIAL_ROW);
  const [phoneRow, setPhoneRow] = useState(INITIAL_ROW);
  const [menu, setMenu] = useState(null); // null | { x, y } (desktop) | {} (phone, bottom-anchored)

  const showers = useMemo(() => jobShowers(cats), [cats]);

  const patchRow = (patch) => setRow((p) => ({ ...p, ...patch }));
  const patchPhoneRow = (patch) => setPhoneRow((p) => ({ ...p, ...patch }));

  const simulateReconfigure = () => setCats((c) => c.map((a) => (a.name !== "Master Bath" ? a : {
    ...a,
    products: a.products.map((p) => (p.id !== "r1" ? p : {
      ...p,
      wedi: {
        ...p.wedi,
        cfg: {
          ...p.wedi.cfg,
          room: { ...p.wedi.cfg.room, w: 72 },
          walls: p.wedi.cfg.walls.map((w) => (w.side === "back" ? { ...w, len: 72 } : w)),
        },
      },
    })),
  })));
  const dropMasterNiche = () => setCats((c) => c.map((a) => (a.name !== "Master Bath" ? a : {
    ...a,
    products: a.products.map((p) => (p.id !== "r1" ? p : { ...p, wedi: { ...p.wedi, cfg: { ...p.wedi.cfg, addons: [] } } })),
  })));
  const removeGuestShower = () => setCats((c) => c.filter((a) => a.name !== "Guest Bath"));

  const menuTarget = menu?.who === "phone" ? phoneRow : row;
  const menuPatch = menu?.who === "phone" ? patchPhoneRow : patchRow;

  return (
    <div className="p-6 max-w-[900px] flex gap-10 flex-wrap">
      <div style={{ width: "100%", maxWidth: 480 }}>
        <span className={eyebrow}>Shower tile sq ft — desktop row (right-click the sq ft field)</span>
        <div className="rounded-md border border-slate-200 p-2 bg-white">
          <Row label="1" row={row} showers={showers} onPatch={patchRow} onOpenMenu={(pos) => setMenu({ ...pos, who: "desktop" })} />
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={simulateReconfigure} className="rounded border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50">Simulate reconfigure</button>
          <button onClick={dropMasterNiche} className="rounded border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50">Drop Master Bath niche</button>
          <button onClick={removeGuestShower} className="rounded border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50">Remove Guest shower</button>
        </div>
        <div className="mt-4 text-[11px] text-slate-500">
          <div>showers: {showers.map((s) => `${s.areaName} (${s.size}${s.curbed ? "" : ", curbless"})`).join(" · ") || "none"}</div>
        </div>
      </div>

      <div style={{ maxWidth: 390, width: "100%" }}>
        <span className={eyebrow}>Phone row (bottom-anchored menu)</span>
        <div className="rounded-md border border-slate-200 p-2 bg-white relative" style={{ maxWidth: 390 }}>
          <div className={rowShell}>
            <span className="flex-1 truncate font-medium">{phoneRow.brandColor}</span>
            <span className="ft-mono text-slate-500">{phoneRow.qty || "0"} sf</span>
            <button
              onClick={() => setMenu({ who: "phone" })}
              title="Take the sq ft from a shower"
              className="px-1 text-slate-500"
            >
              <Bath size={16} />
            </button>
          </div>
          {phoneRow.sfParts?.length > 0 && (
            <div style={{ padding: "0 12px 4px 4px", fontSize: 9.5, color: "var(--ft-muted)" }}>{sfPartsText(phoneRow.sfParts)}</div>
          )}
        </div>
      </div>

      {menu && (
        <SfPartsMenu
          x={menu.who === "desktop" ? menu.x : undefined}
          y={menu.who === "desktop" ? menu.y : undefined}
          product={menuTarget}
          showers={showers}
          onPatch={(patch) => { menuPatch(patch); }}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}

createRoot(document.getElementById("preview")).render(<Harness />);
