# One Dropdown Look — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every dropdown in FloorTrack the configurators' price-level look. PR 1 builds the shared pieces (`MorphSelect`, `.ft-pop`) and converts the price menu and the phone band's two dropdowns. PRs 2–4 convert the rest.

**Architecture:** `MorphSelect` (in `src/widgets.jsx`) is a controlled pick-one dropdown. Its closed trigger sits in the page. Opening renders a portal box at the trigger's exact screen position, which grows in width and slides its list open (the price menu's animation), so no scroll container clips it. The pure logic (row flattening, keyboard moves, first-letter jump, placement, zoom) lives in `src/dropdown.js`, where `node --test` covers it. `.ft-pop` (in `src/index.css`) is the matching shell for panels that can't grow out of their trigger. `DotMenu` adopts it first.

**Tech Stack:** React 18 (hooks), Tailwind 3 with the `--ft-*` theme variables, lucide-react, `node --test`, ESLint 9, Vite 5, Playwright (preinstalled Chromium) for preview shots.

**Spec:** `docs/superpowers/specs/2026-09-24-dropdown-style-design.md` · **ADR:** `docs/adr/0048-one-dropdown-look.md`

## Global Constraints

- `main` auto-deploys to production; every change lands through a PR. Work on branch `claude/wonderful-curie-etd6lr`. After a PR merges, restart the branch from `origin/main` for the next one.
- No UI change merges without preview proof (screenshots from a dev harness page).
- Never run SQL or write to the live Supabase project. This work touches no stored data.
- Motion: width 220 ms and list 240 ms, easing `cubic-bezier(.2,.8,.2,1)`. Open outline `1.5px solid var(--ft-text)`, shadow `0 12px 28px -12px rgba(28,26,23,.45)` (copied from `PriceLevelMenu`).
- Phone rows: when `(pointer: coarse)` matches or the window is under 768px wide, rows are `py-2.5 text-[14px]` (about 36px tall).
- Esc closes only the open dropdown, never the layer under it (the ADR 0028 ladder, `useEscClose`).
- Comments: rare, only for non-obvious rules (root `CLAUDE.md` "Code Comments").
- Checks before every commit: `npm test`, `npm run lint`, `npm run build`.

---

## File structure (PR 1)

| File | Responsibility |
|---|---|
| `src/dropdown.js` (new) | Pure helpers: `flatten`, `moveIndex`, `edgeIndex`, `typeahead`, `placeMorph` |
| `src/dropdown.test.js` (new) | Unit tests for the above |
| `src/index.css` | `.ft-pop` shell + keyframes |
| `src/widgets.jsx` | `useDismissOutside` (extracted), `DotMenu` on `.ft-pop`, new `MorphSelect`, `PriceLevelMenu` rebuilt on it |
| `src/mobile.jsx` | `TierDrop` and `PrintDrop` become `MorphSelect`s |
| `src/dropdownpreview.jsx` | Gallery mounts the real components |
| `src/CLAUDE.md` | File-map entries for `dropdown.js`, `widgets.jsx`, `dropdownpreview.jsx` |

---

## PR 1 — Foundation

### Task 1: Pure dropdown logic (`src/dropdown.js`)

**Files:**
- Create: `src/dropdown.js`
- Test: `src/dropdown.test.js`

**Interfaces:**
- Produces:
  - `flatten({ options, groups }) → { items: Item[], heads: { label: string, at: number }[] }`. An `Item` is `{ v, label, note?, dot?, title?, disabled? }`.
  - `moveIndex(items, from, delta) → number`. The next usable index in direction `delta` (±1). It wraps and skips disabled rows. `from = -1` starts from the edge. Returns -1 when no row is usable.
  - `edgeIndex(items, "first" | "last") → number`
  - `typeahead(items, from, ch) → number`. The next usable row after `from` whose label starts with `ch` (case-insensitive), wrapping. Returns -1 when nothing matches.
  - `placeMorph({ rect, vw, vh, scale = 1, align = "left", want = 320 }) → { up, top? , bottom?, left?, right?, maxList, maxW }`. Every length is in the panel's own zoomed CSS px (screen px ÷ `scale`).

- [ ] **Step 1: Write the failing tests** — create `src/dropdown.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { flatten, moveIndex, edgeIndex, typeahead, placeMorph } from "./dropdown.js";

const it3 = [{ v: "a", label: "Alpha" }, { v: "b", label: "Beta", disabled: true }, { v: "c", label: "Charcoal" }];

test("flatten passes options through and indexes group headings", () => {
  assert.deepEqual(flatten({ options: it3 }), { items: it3, heads: [] });
  const g = flatten({ groups: [{ label: "In stock", items: [it3[0]] }, { label: "Empty", items: [] }, { label: "Special order", items: [it3[2]] }] });
  assert.deepEqual(g.items, [it3[0], it3[2]]);
  assert.deepEqual(g.heads, [{ label: "In stock", at: 0 }, { label: "Special order", at: 1 }]);
});

test("moveIndex skips disabled rows and wraps both ways", () => {
  assert.equal(moveIndex(it3, 0, 1), 2);
  assert.equal(moveIndex(it3, 2, 1), 0);
  assert.equal(moveIndex(it3, 0, -1), 2);
  assert.equal(moveIndex(it3, -1, 1), 0);
  assert.equal(moveIndex(it3, -1, -1), 2);
  assert.equal(moveIndex([], -1, 1), -1);
  assert.equal(moveIndex([{ v: 1, label: "x", disabled: true }], -1, 1), -1);
});

test("edgeIndex finds the first and last usable rows", () => {
  const rows = [{ v: 0, label: "z", disabled: true }, ...it3, { v: "d", label: "Dim", disabled: true }];
  assert.equal(edgeIndex(rows, "first"), 1);
  assert.equal(edgeIndex(rows, "last"), 3);
});

test("typeahead jumps to the next label starting with the letter, cycling", () => {
  const rows = [{ v: 1, label: "Frost" }, { v: 2, label: "Fawn" }, { v: 3, label: "Bone" }, { v: 4, label: "fresh cut", disabled: true }];
  assert.equal(typeahead(rows, -1, "f"), 0);
  assert.equal(typeahead(rows, 0, "F"), 1);
  assert.equal(typeahead(rows, 1, "f"), 0);
  assert.equal(typeahead(rows, 0, "b"), 2);
  assert.equal(typeahead(rows, 0, "q"), -1);
  assert.equal(typeahead(rows, 0, ""), -1);
});

const rect = (top, left, w = 120, h = 28) => ({ top, left, right: left + w, bottom: top + h, width: w, height: h });

test("placeMorph opens downward over the trigger when there is room", () => {
  const p = placeMorph({ rect: rect(100, 40), vw: 1200, vh: 800 });
  assert.equal(p.up, false);
  assert.equal(p.top, 100);
  assert.equal(p.left, 40);
  assert.equal(p.maxList, 800 - 100 - 8 - 28);
  assert.equal(p.maxW, 1200 - 40 - 8);
});

test("placeMorph flips upward near the bottom and anchors on the trigger's bottom", () => {
  const p = placeMorph({ rect: rect(740, 40), vw: 1200, vh: 800, want: 300 });
  assert.equal(p.up, true);
  assert.equal(p.bottom, 800 - 768);
  assert.equal(p.maxList, 768 - 8 - 28);
});

test("placeMorph right-aligns and converts screen px into the zoomed box's own px", () => {
  const p = placeMorph({ rect: rect(100, 900, 60, 21), vw: 1000, vh: 800, scale: 0.75, align: "right" });
  assert.equal(p.right, (1000 - 960) / 0.75);
  assert.equal(p.top, 100 / 0.75);
  assert.equal(p.left, undefined);
  assert.equal(p.maxW, Math.floor((960 - 8) / 0.75));
});

test("placeMorph never returns a list shorter than 96px", () => {
  assert.equal(placeMorph({ rect: rect(10, 0, 100, 28), vw: 400, vh: 60 }).maxList, 96);
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `node --test src/dropdown.test.js`
Expected: FAIL with `Cannot find module` for `./dropdown.js`.

- [ ] **Step 3: Implement** — create `src/dropdown.js`:

```js
// The pure half of MorphSelect (ADR 0048): the flat row list a grouped
// dropdown walks, keyboard moves, first-letter jump, and where the open box
// goes. No React, so node --test drives it.

export function flatten({ options, groups }) {
  if (!groups) return { items: options || [], heads: [] };
  const items = [];
  const heads = [];
  for (const g of groups) {
    if (!g.items?.length) continue;
    heads.push({ label: g.label, at: items.length });
    items.push(...g.items);
  }
  return { items, heads };
}

const usable = (it) => !!it && !it.disabled;

export function moveIndex(items, from, delta) {
  const n = items.length;
  let i = from;
  for (let k = 0; k < n; k++) {
    i = i < 0 ? (delta > 0 ? 0 : n - 1) : (i + delta + n) % n;
    if (usable(items[i])) return i;
  }
  return -1;
}

export const edgeIndex = (items, edge) => moveIndex(items, -1, edge === "first" ? 1 : -1);

export function typeahead(items, from, ch) {
  const c = String(ch || "").toLowerCase();
  const n = items.length;
  if (!c) return -1;
  for (let k = 1; k <= n; k++) {
    const i = (Math.max(from, -1) + k) % n;
    if (usable(items[i]) && String(items[i].label).toLowerCase().startsWith(c)) return i;
  }
  return -1;
}

// The open box covers the trigger exactly (it IS the trigger, grown), so it
// starts at the trigger's top going down, or its bottom going up. Inside a
// `zoom`ed workspace the box carries the same zoom, and a zoomed fixed box
// multiplies its own offsets too — so every length comes back ÷ scale.
export function placeMorph({ rect, vw, vh, scale = 1, align = "left", want = 320 }) {
  const below = vh - rect.top - 8;
  const above = rect.bottom - 8;
  const up = below < Math.min(want, above);
  const pos = { up, maxList: Math.max(96, Math.floor(((up ? above : below) - rect.height) / scale)) };
  if (up) pos.bottom = (vh - rect.bottom) / scale; else pos.top = rect.top / scale;
  if (align === "right") pos.right = (vw - rect.right) / scale; else pos.left = rect.left / scale;
  pos.maxW = Math.floor(((align === "right" ? rect.right : vw - rect.left) - 8) / scale);
  return pos;
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `node --test src/dropdown.test.js`
Expected: every test passes.

- [ ] **Step 5: Commit**

```bash
git add src/dropdown.js src/dropdown.test.js
git commit -m "Dropdown logic: row flattening, keyboard moves, type-ahead, placement"
```

### Task 2: `.ft-pop` shell and `DotMenu` on it

**Files:**
- Modify: `src/index.css`. Append after the `.ft-acc` block (around line 212).
- Modify: `src/widgets.jsx:80-137` (`useAnchoredPanel`, `DotMenu`)

**Interfaces:**
- Produces: CSS class `.ft-pop`, which reads the custom property `--pop-bg` and takes `data-up="true"` for panels that open upward. `useDismissOutside(open, anchorRef, panelRef, onDismiss)` is exported from `widgets.jsx`. `DotMenu` gains an optional `bg` prop; the default is the card fill.

- [ ] **Step 1: Add the shell to `src/index.css`**, right after the `.ft-acc` reduced-motion line:

```css
/* The one floating-panel shell (ADR 0048): the price-level menu's open look —
   surface fill, ink outline, lifted shadow, a slide-open reveal. */
.ft-pop{background:var(--pop-bg,var(--ft-card));border:1.5px solid var(--ft-text);border-radius:.5rem;box-shadow:0 12px 28px -12px rgba(28,26,23,.45);animation:ft-pop-down 240ms cubic-bezier(.2,.8,.2,1);}
.ft-pop[data-up="true"]{animation-name:ft-pop-up;}
@keyframes ft-pop-down{from{clip-path:inset(0 0 100% 0 round .5rem)}to{clip-path:inset(0 0 0 0 round .5rem)}}
@keyframes ft-pop-up{from{clip-path:inset(100% 0 0 0 round .5rem)}to{clip-path:inset(0 0 0 0 round .5rem)}}
@media (prefers-reduced-motion: reduce){.ft-pop{animation:none;}}
```

- [ ] **Step 2: Extract `useDismissOutside` in `src/widgets.jsx`.** Move the second `useEffect` out of `useAnchoredPanel` unchanged, including its focus-out comment, into an exported hook placed just above `useAnchoredPanel`, and call it from there:

```jsx
export const useDismissOutside = (open, anchorRef, panelRef, onDismiss) => {
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!anchorRef.current?.contains(e.target) && !panelRef.current?.contains(e.target)) onDismiss(); };
    // Focus leaving the field (Tab, or clicking into another input) must dismiss
    // too — a pointer-outside alone leaves the panel orphaned over the new field.
    // Deferred so focus has settled onto its target; picks keep focus in the
    // anchor (they preventDefault on mousedown), so they never trip this.
    const onFocusOut = () => requestAnimationFrame(() => {
      const ae = document.activeElement;
      if (ae && ae !== document.body && !anchorRef.current?.contains(ae) && !panelRef.current?.contains(ae)) onDismiss();
    });
    document.addEventListener("pointerdown", close);
    anchorRef.current?.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("pointerdown", close);
      anchorRef.current?.removeEventListener("focusout", onFocusOut);
    };
  }, [open]);
};
```

In `useAnchoredPanel`, the removed effect is replaced by `useDismissOutside(open, anchorRef, panelRef, onDismiss);` placed before `return pos;`.

- [ ] **Step 3: Put `DotMenu` on the shell** — replace its signature and panel `div`:

```jsx
export function DotMenu({ open, onClose, anchorRef, width = 224, align = "right", bg, children }) {
  const panelRef = useRef(null);
  const pos = useAnchoredPanel(open, anchorRef, panelRef, onClose);
  useEscClose(open, onClose);
  if (!open || !pos) return null;
  const left = Math.max(8, Math.min(align === "left" ? pos.left : pos.left + pos.width - width, window.innerWidth - width - 8));
  return createPortal(
    <div ref={panelRef} data-up={pos.bottom != null ? "true" : undefined}
      style={{ ...vPos(pos), maxHeight: pos.maxH, width, left, "--pop-bg": bg }}
      className="ft-pop fixed z-50 py-1 text-sm overflow-y-auto">
      {children}
    </div>, document.body);
}
```

- [ ] **Step 4: Verify**

Run: `npm test && npm run lint && npm run build`
Expected: all pass. `DotMenu`'s behavior is unchanged; its look is checked in Task 6's shots.

- [ ] **Step 5: Commit**

```bash
git add src/index.css src/widgets.jsx
git commit -m "Shared .ft-pop panel shell; DotMenu wears it"
```

### Task 3: `MorphSelect`

**Files:**
- Modify: `src/widgets.jsx`. Add `useId` to the `react` import and `flatten, moveIndex, edgeIndex, typeahead, placeMorph` from `./dropdown.js`. Place the component just above `const PRICE_LEVELS` (about line 472).

**Interfaces:**
- Consumes: Task 1 helpers, and Task 2's `useDismissOutside`, `useEscClose` and `PANEL_MAX`.
- Produces: `MorphSelect({ value, onChange, options, groups, placeholder = "Pick…", display, bg = "var(--ft-card)", size = "md", flat = false, tinted = false, bold = false, full = false, align = "left", minOpenW = 0, title, className = "", triggerClass, triggerStyle, renderRow })`.
  - `options` / `groups` take Task 1's `Item` shape.
  - `display` overrides the closed text.
  - `tinted` colors the selected label and the trigger text with the item's `dot`.
  - `flat` makes the closed outline transparent.
  - `triggerClass` / `triggerStyle` replace the trigger's own look (used by the phone band chips); when given, the wrapper carries no fill or outline.
  - `renderRow(item, { selected, close })` returns the row's label content, or `undefined` to use the default label.

- [ ] **Step 1: Add the component**

```jsx
const MORPH_EASE = "cubic-bezier(.2,.8,.2,1)";
const touchRows = () => window.matchMedia?.("(pointer: coarse)").matches || window.innerWidth < 768;

// The one pick-one dropdown (ADR 0048), the price-level menu's look: the open
// box is the trigger grown — portalled onto <body> at the trigger's spot so a
// scroll container can't clip it, wearing the trigger's zoom inside the
// shrink-to-fit workspaces. Focus stays on the trigger (rows preventDefault on
// mousedown) so it keeps a <select>'s keyboard contract.
export function MorphSelect({ value, onChange, options, groups, placeholder = "Pick…", display, bg = "var(--ft-card)", size = "md", flat = false, tinted = false, bold = false, full = false, align = "left", minOpenW = 0, title, className = "", triggerClass, triggerStyle, renderRow }) {
  const { items, heads } = flatten({ options, groups });
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [active, setActive] = useState(-1);
  const [box, setBox] = useState(null);
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const listRef = useRef(null);
  const timer = useRef(0);
  const lid = useId();
  const sel = items.findIndex((it) => it.v === value);
  const cur = items[sel];
  const text = display ?? (cur ? cur.label : placeholder);
  const ink = tinted && cur?.dot ? cur.dot : undefined;
  const closedBorder = flat ? "transparent" : "var(--ft-border-strong)";
  const sz = size === "sm" ? "px-1.5 text-xs" : "px-2.5 text-[12.5px]";
  const rowSz = touchRows() ? "py-2.5 text-[14px]" : size === "sm" ? "py-1 text-xs" : "py-1.5 text-[12.5px]";

  const openMenu = () => {
    clearTimeout(timer.current);
    setActive(sel >= 0 ? sel : edgeIndex(items, "first"));
    if (open) setShown(true); else setOpen(true);
  };
  const closeMenu = () => {
    setShown(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 240);
  };
  const pick = (i) => { onChange(items[i].v); closeMenu(); };
  useEffect(() => () => clearTimeout(timer.current), []);
  useEscClose(open && shown, closeMenu);
  useDismissOutside(open, anchorRef, panelRef, closeMenu);

  useLayoutEffect(() => {
    if (!open) { setBox(null); setShown(false); return; }
    const place = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const scale = el.offsetWidth ? r.width / el.offsetWidth : 1;
      const want = Math.min(PANEL_MAX, 12 + items.length * (touchRows() ? 40 : 30) + heads.length * 24);
      const pos = placeMorph({ rect: r, vw: window.innerWidth, vh: window.innerHeight, scale, align, want });
      setBox((b) => ({ ...pos, scale, w: el.offsetWidth, h: el.offsetHeight, target: b?.target ?? el.offsetWidth }));
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => { window.removeEventListener("scroll", place, true); window.removeEventListener("resize", place); };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !box) return;
    const natural = listRef.current?.offsetWidth || 0;
    const target = Math.min(box.maxW, Math.max(box.w, natural, minOpenW));
    setBox((b) => ({ ...b, target }));
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [open, !!box]);

  useEffect(() => {
    if (shown && active >= 0) listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [shown, active]);

  const onKey = (e) => {
    const k = e.key;
    const stop = () => { e.preventDefault(); e.stopPropagation(); };
    const letter = k.length === 1 && /\S/.test(k) && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (!(open && shown)) {
      if (k === "Enter" || k === " " || k === "ArrowDown" || k === "ArrowUp") { stop(); openMenu(); }
      else if (letter) { const i = typeahead(items, sel, k); if (i >= 0) { stop(); onChange(items[i].v); } }
      return;
    }
    if (k === "Escape") { stop(); closeMenu(); }
    else if (k === "Tab") closeMenu();
    else if (k === "Enter" || k === " ") { stop(); if (active >= 0 && !items[active]?.disabled) pick(active); }
    else if (k === "ArrowDown" || k === "ArrowUp") { stop(); setActive(moveIndex(items, active, k === "ArrowDown" ? 1 : -1)); }
    else if (k === "Home" || k === "End") { stop(); setActive(edgeIndex(items, k === "Home" ? "first" : "last")); }
    else if (letter) { stop(); const i = typeahead(items, active, k); if (i >= 0) setActive(i); }
  };

  const headAt = new Map(heads.map((h) => [h.at, h.label]));
  const chevron = (turned) => <ChevronDown size={size === "sm" ? 12 : 14} className="ml-auto shrink-0 text-slate-400" style={{ transform: turned ? "rotate(180deg)" : "none", transition: "transform 220ms ease" }} />;
  const rows = items.map((it, i) => {
    const on = i === sel;
    const custom = renderRow?.(it, { selected: on, close: closeMenu });
    return (
      <div key={i}>
        {headAt.has(i) && <div className="ft-eyebrow text-[9px] px-3 pt-2 pb-0.5">{headAt.get(i)}</div>}
        <div data-i={i} id={`${lid}-${i}`} role="option" aria-selected={on} aria-disabled={it.disabled || undefined} title={it.title}
          onMouseEnter={() => { if (!it.disabled) setActive(i); }}
          onMouseDown={(e) => { if (e.target.tagName !== "INPUT") e.preventDefault(); }}
          onClick={() => { if (!it.disabled) pick(i); }}
          className={"w-full flex items-center gap-2 px-3 whitespace-nowrap " + rowSz
            + (it.disabled ? " text-slate-300 cursor-default" : " cursor-pointer")
            + (i === active && !it.disabled ? " bg-[color:var(--ft-hover)]" : "")
            + (on ? " font-extrabold" : " font-semibold" + (it.disabled ? "" : " text-slate-600"))}>
          {it.dot && <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: it.dot }} />}
          {custom ?? <span className="flex-1" style={on && tinted && it.dot ? { color: it.dot } : undefined}>{it.label}</span>}
          {it.note && <span className="text-[10.5px] font-semibold text-slate-400">{it.note}</span>}
          <span className="w-3.5 shrink-0">{on && <Check size={13} />}</span>
        </div>
      </div>
    );
  });

  const header = box && (
    <div onMouseDown={(e) => e.preventDefault()} onClick={closeMenu}
      className={"flex items-center gap-1.5 whitespace-nowrap cursor-pointer " + sz + (bold ? " font-extrabold" : " font-semibold")}
      style={{ height: box.h - 3, color: ink || "var(--ft-text)" }}>
      <span className="truncate">{text}</span>{chevron(shown)}
    </div>
  );
  const divider = <div className="border-t border-slate-300 mx-2" />;
  const list = (
    <div style={{ display: "grid", gridTemplateRows: shown ? "1fr" : "0fr", transition: `grid-template-rows 240ms ${MORPH_EASE}` }}>
      <div className="min-h-0 overflow-hidden">
        <div ref={listRef} id={lid} role="listbox" className="py-1 overflow-y-auto" style={{ maxHeight: box?.maxList, minWidth: "100%", width: "max-content" }}>{rows}</div>
      </div>
    </div>
  );
  const panel = box && (
    <div ref={panelRef} className="fixed rounded-lg overflow-hidden"
      style={{ zIndex: 90, top: box.top, bottom: box.bottom, left: box.left, right: box.right, zoom: box.scale !== 1 ? box.scale : undefined,
        width: shown ? box.target : box.w, background: bg,
        border: "1.5px solid " + (shown ? "var(--ft-text)" : closedBorder),
        boxShadow: shown ? "0 12px 28px -12px rgba(28,26,23,.45)" : "none",
        transition: `width 220ms ${MORPH_EASE}, border-color 220ms ease, box-shadow 220ms ease` }}>
      {box.up ? <>{list}{divider}{header}</> : <>{header}{divider}{list}</>}
    </div>
  );

  return (
    <span ref={anchorRef} className={(full ? "flex w-full" : "inline-flex max-w-full") + " relative align-middle " + className}
      style={triggerClass ? undefined : { background: bg, border: "1.5px solid " + closedBorder, borderRadius: 8 }}>
      <button type="button" onClick={() => (open && shown ? closeMenu() : openMenu())} onKeyDown={onKey} title={title}
        aria-haspopup="listbox" aria-expanded={open && shown} aria-controls={open ? lid : undefined}
        aria-activedescendant={open && shown && active >= 0 ? `${lid}-${active}` : undefined}
        className={triggerClass ?? ("min-w-0 w-full flex items-center gap-1.5 rounded-[6.5px] whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 hover:bg-[color:var(--ft-hover)] " + sz + (size === "sm" ? " h-[22px]" : " h-[27px]") + (bold ? " font-extrabold" : " font-semibold"))}
        style={triggerStyle ?? { color: ink || (cur || display ? "var(--ft-text)" : "var(--ft-muted)") }}>
        <span className="truncate">{text}</span>{chevron(false)}
      </button>
      {open && box && createPortal(panel, document.body)}
    </span>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm test && npm run lint && npm run build`
Expected: all pass. Nothing mounts the component yet. Task 4 and Task 6 exercise it.

- [ ] **Step 3: Commit**

```bash
git add src/widgets.jsx
git commit -m "MorphSelect: the price-level dropdown's look as a shared pick-one dropdown"
```

### Task 4: `PriceLevelMenu` rebuilt on `MorphSelect`

**Files:**
- Modify: `src/widgets.jsx`. Replace the body of `PriceLevelMenu` (about lines 474–537). Keep `PRICE_LEVELS`, `levelInk` and the comment above it. Drop the `open`/`w`/`label`/`box` state along with its effects.

**Interfaces:**
- Consumes: `MorphSelect` (Task 3).
- Produces: the same `PriceLevelMenu({ value, customPct, onPick, onPct, bg })` signature. Its three callers (`SheogaConfigurator.jsx:1531`, `WediConfigurator.jsx:1499`, `SchluterConfigurator.jsx:1004`) don't change.

- [ ] **Step 1: Replace the component body**

```jsx
export function PriceLevelMenu({ value = "retail", customPct, onPick, onPct, bg = "var(--ft-cream)" }) {
  const options = PRICE_LEVELS.map((t) => ({ v: t, label: t[0].toUpperCase() + t.slice(1), dot: levelInk(t) }));
  return (
    <MorphSelect value={value} onChange={onPick} options={options} bg={bg} flat tinted bold align="right" minOpenW={170} title="Price level"
      display={value === "custom" ? `−${customPct || 0}%` : undefined}
      renderRow={(it, { close }) => it.v !== "custom" ? undefined : (
        <span className="flex-1">
          <span className="inline-flex items-center gap-0.5 rounded border border-slate-300 bg-white px-1.5 text-[12px] font-bold" style={{ color: levelInk("custom") }} onClick={(e) => e.stopPropagation()}>
            −<input value={customPct ?? ""} inputMode="decimal" title="Custom % off retail"
              onFocus={() => onPick("custom")} onChange={(e) => onPct(e.target.value.replace(/[^\d.]/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); close(); } }}
              className="w-6 text-right bg-transparent focus:outline-none" />%
          </span>
        </span>
      )} />
  );
}
```

- [ ] **Step 2: Remove what's now unused.** Check whether `useLayoutEffect` and `Check` are still used elsewhere in `widgets.jsx`, since `MorphSelect` uses both. Lint will flag any leftover.

Run: `npm run lint && npm run build`
Expected: pass.

- [ ] **Step 3: Preview check (Sheoga harness)** — start `npx vite --port 5199 --strictPort` in the background, then run the shot script from Task 6, Step 3 against `sheoga-preview.html` at 1440×900. It clicks `button[title="Price level"]`, waits 400 ms, screenshots the header, clicks the Custom row's input, types `12`, and presses Enter.
Expected:
- Closed, the menu looks as it does on `main`: the level name in its color on the header fill, no outline.
- Open, the box grows leftward from the right edge, with a dark outline, dots, a check on the current level, and the % box on the last row.
- After typing, the trigger reads `−12%` in purple.

- [ ] **Step 4: Commit**

```bash
git add src/widgets.jsx
git commit -m "PriceLevelMenu runs on MorphSelect (no visible change)"
```

### Task 5: Phone band's price level and print dropdowns

**Files:**
- Modify: `src/mobile.jsx:19` (import), `src/mobile.jsx:696-761` (`TierDrop`, `PrintDrop`)

**Interfaces:**
- Consumes: `MorphSelect`.
- Produces: `TierDrop({ sel, tv, pcts, updateProject })` and `PrintDrop({ sel, updateProject })` keep their props. They still write only through `updateProject(sel.id, { priceTier | customPct | printPricing })`.

- [ ] **Step 1: Swap the import.** `DotMenu` stays imported only if something else in `mobile.jsx` still uses it; lint will say.

```jsx
import { FitSelect, GroutColorOptions, useEscClose, DotMenu, SalespersonPop, MorphSelect } from "./widgets.jsx";
```

- [ ] **Step 2: Replace `TierDrop`.** The closed chip keeps its tier fill (the 2026-09-15 band design). The open box takes the card fill.

```jsx
function TierDrop({ sel, tv, pcts, updateProject }) {
  const tier = sel.priceTier || "retail";
  const label = tierBadgeText(tv.tier, tv.pct) || (tier === "custom" ? "Custom" : "Retail");
  const fill = TIER_COLOR[tier]?.main;
  const dot = (v) => TIER_COLOR[v]?.main || "var(--ft-text)";
  const options = [
    { v: "retail", label: "Retail", dot: dot("retail") },
    { v: "builder", label: "Builder", note: `−${pcts.builderPct}%`, dot: dot("builder") },
    { v: "employee", label: "Employee", note: "cost +6%", dot: dot("employee") },
    { v: "sale", label: "Sale", note: `−${pcts.salePct}%`, dot: dot("sale") },
    { v: "custom", label: "Custom", dot: dot("custom") },
  ];
  return (
    <MorphSelect value={tier} onChange={(v) => updateProject(sel.id, { priceTier: v })} options={options} display={label}
      tinted bold size="sm" minOpenW={168} title="Price level" className="flex-1 min-w-0"
      triggerClass={"h-[24px] w-full min-w-0 flex items-center gap-1 rounded-md px-1.5 text-[10px] font-extrabold overflow-hidden " + (fill ? "text-white" : "bg-indigo-600")}
      triggerStyle={fill ? { background: fill } : {}}
      renderRow={(it, { close }) => it.v !== "custom" ? undefined : (
        <label className="flex-1 flex items-center gap-1 cursor-text" onClick={(e) => e.stopPropagation()}>
          Custom
          <input type="number" min="0" max="100" inputMode="numeric" value={sel.customPct ?? ""} placeholder="%"
            onFocus={() => updateProject(sel.id, { priceTier: "custom" })}
            onChange={(e) => updateProject(sel.id, { priceTier: "custom", customPct: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") close(); }}
            className="ft-nospin ml-auto w-9 bg-transparent text-right border-b border-slate-300 focus:outline-none" />
          <span className="text-[10px] font-semibold">%</span>
        </label>
      )} />
  );
}
```

- [ ] **Step 3: Replace `PrintDrop`.** `PRINT_OPTS` is kept; its third field becomes the row tooltip.

```jsx
function PrintDrop({ sel, updateProject }) {
  return (
    <MorphSelect value={sel.printPricing || "full"} onChange={(v) => updateProject(sel.id, { printPricing: v })}
      groups={[{ label: "Estimate shows", items: PRINT_OPTS.map(([v, label, title]) => ({ v, label, title })) }]}
      size="sm" minOpenW={176} title="What the printed estimate shows" className="flex-auto min-w-0"
      triggerClass={BAND_MINI + " w-full"} triggerStyle={{ border: BAND_MINI_STYLE.border }} />
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm test && npm run lint && npm run build`
Expected: pass.

- [ ] **Step 5: Preview check (header harness)** — open `header-preview.html` (the band in a 344px frame) at a 390×844 viewport with `hasTouch: true, isMobile: true`. Tap `button[title="Price level"]`, screenshot, pick Sale. Then tap `button[title="What the printed estimate shows"]` and screenshot.
Expected:
- The chips look as they do on `main` when closed.
- Open, the lists have taller rows, a dark outline, a check on the current value and the "ESTIMATE SHOWS" heading.
- Picking Sale turns the chip pink.

- [ ] **Step 6: Commit**

```bash
git add src/mobile.jsx
git commit -m "Phone band: price level and print dropdowns on MorphSelect"
```

### Task 6: Gallery on the real components, preview proof, docs, PR

**Files:**
- Modify: `src/dropdownpreview.jsx`
- Modify: `src/CLAUDE.md` (the `widgets.jsx` and `dropdownpreview.jsx` entries, plus a new `dropdown.js` entry after `widgets.jsx`)
- Create (scratchpad, not committed): the shot script

**Interfaces:**
- Consumes: `MorphSelect`, `DotMenu`, `FitSelect` (still the browser dropdown until PR 3).

- [ ] **Step 1: Point the gallery at the real components.** In `src/dropdownpreview.jsx`:
  - Delete the local `MorphSelect` and `MorphActionMenu` and the `EASE` constant.
  - Import `{ FitSelect, MorphSelect, DotMenu }` from `./widgets.jsx`.
  - In each "New style" cell, render the real `MorphSelect` with the same props minus `startOpen`/`openW`/`maxH`/`phone`, which don't exist on the real one. Wrap each in a `data-shot="<name>"` element so the shot script can click it. The names are `grout`, `stain`, `menu`, `tier` and `groutphone`.
  - For the ⋯ cell, replace `MorphActionMenu` with a button holding `anchorRef` that toggles a real `DotMenu`, `bg="var(--ft-cream)"` and `width={196}`. Its children are the `MENU` rows as `button`s with the old row classes.
  - Add a final section, "Inside a zoomed workspace (Settings / wedi at 75%)": a `<div style={{ zoom: 0.75 }}>` holding a `MorphSelect` over the stain colors, wrapped `data-shot="zoom"`.
  - Add a section pushed to the page bottom with `mt-[60vh]` holding one `MorphSelect`, wrapped `data-shot="flip"`. It is used to see the list open upward.
  - Update the header comment to say the new-style cells mount the real components.

- [ ] **Step 2: Lint**

Run: `npx eslint src/dropdownpreview.jsx`
Expected: no problems.

- [ ] **Step 3: Shot script** — write `$SCRATCH/shots.cjs`. Chromium is at `/opt/pw-browsers` and Playwright is installed globally; don't run `playwright install`.

```js
const { chromium } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright");
const out = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const shot = async (url, vp, steps, opts = {}) => {
    const p = await b.newPage({ viewport: vp, deviceScaleFactor: 2, ignoreHTTPSErrors: true, ...opts });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.goto("http://localhost:5199/" + url, { waitUntil: "networkidle" });
    await p.waitForTimeout(600);
    for (const [name, fn] of steps) { await fn(p); await p.waitForTimeout(450); await p.screenshot({ path: `${out}/${name}.png` }); }
    if (errs.length) console.log(url, "ERRORS", errs);
    await p.close();
  };
  const click = (sel) => async (p) => { await p.locator(sel).first().scrollIntoViewIfNeeded(); await p.locator(sel).first().click(); };
  const near = (sel) => async (p) => { await p.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: "end" })); await p.locator(sel).first().click(); };
  await shot("dropdown-preview.html", { width: 1290, height: 900 }, [
    ["g-grout", click('[data-shot="grout"] button')],
    ["g-stain", click('[data-shot="stain"] button')],
    ["g-menu", click('[data-shot="menu"] button')],
    ["g-zoom", click('[data-shot="zoom"] button')],
    ["g-flip", near('[data-shot="flip"] button')],
  ]);
  await shot("dropdown-preview.html", { width: 390, height: 844 }, [
    ["g-phone-tier", click('[data-shot="tier"] button')],
  ], { hasTouch: true, isMobile: true });
  await shot("sheoga-preview.html", { width: 1440, height: 900 }, [
    ["sheoga-closed", async () => {}],
    ["sheoga-open", click('button[title="Price level"]')],
  ]);
  await shot("wedi-preview.html", { width: 1000, height: 800 }, [
    ["wedi-zoomed-open", click('button[title="Price level"]')],
  ]);
  await shot("header-preview.html", { width: 390, height: 844 }, [
    ["band-tier", click('button[title="Price level"]')],
    ["band-print", click('button[title="What the printed estimate shows"]')],
  ], { hasTouch: true, isMobile: true });
  await b.close();
})();
```

Run: `node $SCRATCH/shots.cjs $SCRATCH` with the Vite dev server running on 5199.
Expected: no `ERRORS` lines, and 11 PNGs.

- [ ] **Step 4: Look at every shot** and confirm each of these. Fix and re-shoot anything that fails.
  1. The grout color list has In stock / Special order headings, the current row checked, and scrolls.
  2. The stain color box widens past the trigger.
  3. The ⋯ menu has the dark outline, the cream fill and the shadow.
  4. **Zoom:** the open list's type and row size match the 75%-zoomed trigger, and the header sits exactly over the trigger. If it is offset, the browser does not scale fixed offsets under `zoom`. In that case drop the `÷ scale` from `placeMorph`'s `top/bottom/left/right` (keep it on `maxList`/`maxW`), update the Task 1 test to match, and re-run.
  5. **Flip:** near the page bottom the list opens upward, with the value row staying on the trigger.
  6. The phone rows are about 36px tall.
  7. The Sheoga price menu, closed, looks the same as `main`.
  8. wedi, drawn zoomed at 1000px wide, opens its price list at the header's scale.
  9. The band chips keep their fill when closed.

- [ ] **Step 5: Keyboard pass** (Playwright or manual, on `dropdown-preview.html`). Focus the stain trigger with Tab, then check each of these:
  - ↓ opens it.
  - ↓↓ moves the highlight.
  - "c" jumps to Caramel, then Cattail, then Camo (cycling).
  - Enter picks and closes.
  - Esc on an open list closes only the list.
  - Tab from an open list closes it and moves focus on.

- [ ] **Step 6: Update `src/CLAUDE.md`.**
  - In the `widgets.jsx` entry, after the `PriceLevelMenu` sentence, add: "`MorphSelect` (ADR 0048) — the one pick-one dropdown, the price menu's look: the open box is the trigger grown, portalled at the trigger's spot and zoom, with a `<select>`'s keyboard contract; `PriceLevelMenu` runs on it. `DotMenu` wears `.ft-pop` (index.css), the shared panel shell; `useDismissOutside` is the outside-press/focus-out rule `useAnchoredPanel` and `MorphSelect` share."
  - Add a new entry after `widgets.jsx`: "`dropdown.js` # MorphSelect's pure half (ADR 0048): `flatten` (grouped rows → one walkable list + heading positions), `moveIndex`/`edgeIndex` (skip disabled, wrap), `typeahead` (first-letter jump, cycling), `placeMorph` (over the trigger, flip up when short of room, lengths ÷ the trigger's zoom) (dropdown.test.js)".
  - In the `dropdownpreview.jsx` entry, replace "the PriceLevelMenu look carried onto" with "the REAL MorphSelect/DotMenu beside today's".

- [ ] **Step 7: Final checks**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 8: Commit and push**

```bash
git add src/dropdownpreview.jsx src/CLAUDE.md
git commit -m "Dropdown gallery mounts the real MorphSelect and DotMenu"
git push -u origin claude/wonderful-curie-etd6lr
```

- [ ] **Step 9: Open PR 1** against `main`, titled "One dropdown look, part 1: MorphSelect + price menu + phone band". The body should cover:
  - what changed;
  - the spec and ADR links;
  - that nothing touches stored data;
  - the shots from Step 4 as preview proof.

  Subscribe to its activity. The owner merges it.

---

## PR 2 — Configurators (detail this when PR 1 has merged)

Restart the branch from `origin/main` first.

- **Task 2.1:** Sheoga's `Dropdown` (`SheogaConfigurator.jsx:225`) becomes a `full` `MorphSelect`, with `options` mapped `{ v: o.id, label: o.label, disabled: o.dis }`. Keep its label/hint header. Then do the stain color (`:294`, with the "Pick color…" placeholder), sheen (`:321`), vent stain (`:636`) and vent scrape (`:649`) selects. Proof: `sheoga-preview.html` on each tab.
- **Task 2.2:** Schluter's mortar-bed select (`SchluterConfigurator.jsx:1178`) becomes a `MorphSelect`. The `.sch-swap` panels (wall menu `:1771`, bench menu `:1882`, bench/niche chip pickers `:1996`/`:2062`, ⇄ swap `:2089`) take `ft-pop` (and `data-up` where they open upward). Remove the duplicated border and shadow from `.sch-swap`. Proof: `schluter-preview.html`.
- **Task 2.3:** The wedi `.wedi-swap` panels (⇄ swap about `:2111`, add-on picker `:2137`, wall menu `:2169`, bench menu `:2283`) get the same treatment. Proof: `wedi-preview.html`.

## PR 3 — Job grid (detail this when PR 2 has merged)

- **Task 3.1:** `FitSelect` keeps its name and `display`/`sm` props but renders `MorphSelect`, taking `options`/`groups` in place of `<option>` children. `GroutColorOptions` becomes `groutColorGroups(groups) → Item[] | Group[]`. Convert the six `App.jsx` call sites (`:2236`, `:2237`, `:2267`, `:2289`, `:2332`, `:2380`) and the six in `mobile.jsx` (`:519`, `:520`, `:543`, `:557`, `:596`, `:631`).
  - Keep the materials drawer's keyboard contract, which relies on Enter/Escape not reaching the drawer from an open list. `MorphSelect` already stops those keys.
  - Tab order through the checked extras must be unchanged.
- **Task 3.2:** `UnitPick` (`grid.jsx:85`) becomes a `size="sm"` `MorphSelect`, with its dotted-chip look carried through `triggerClass`.
- **Task 3.3:** `TypeSelect`'s panel (`grid.jsx:19`), `LineMenu`, `LineWastePop`, `SfPartsMenu`, `PriceCostPop` and the area option panel (`App.jsx:3234`) take `ft-pop`. The same goes for the grid search suggestion panels (`GridOmniSearch`, `GridProductBox`).
- **Task 3.4:** New harness `grid-preview.html` / `src/gridpreview.jsx`. It mounts the real `TypeSelect`, `UnitPick`, `FitSelect` (in a drawer-tinted strip), `LineMenu`, `LineWastePop` and `PriceCostPop` over local state, on a desktop page plus a 390px phone frame, and gets an entry in `src/CLAUDE.md`. Proof: that page, `sf-preview.html`, and the Netlify deploy preview (viewing only).

## PR 4 — Everything else (detail this when PR 3 has merged)

- **Task 4.1:** Settings selects (`SettingsWorkspace.jsx:155`, `:495`, `:551`, `:725`) become `MorphSelect`s. The `StockSearch`/`FamilySearch`/`SeriesSearch` panels (`search.jsx`) take `ft-pop`. Check them under Settings' zoom.
- **Task 4.2:** Price books: the seven `pricebooklib.jsx` selects (`:276`, `:1483`, `:2080`, `:2095`, `:2102`, `:2117` column mapping, `:2141`) become `MorphSelect`s. The column mapping must stay Tab-able through the whole table. The vendor-board ⋯ menus already wear `.ft-pop` through `DotMenu` since PR 1. `PasteSignInPopover` (`vendorpanel.jsx:782`) takes `ft-pop`. Proof: `import-preview.html`, `vendor-book-preview.html`.
- **Task 4.3:** Customer browser salesperson filter (`CustomerBrowser.jsx:213`, a `DotMenu`, restyled since PR 1; its rows get the plain look), `BuilderCombo` and the `AddressField` suggestion lists, and `SalespersonPop`/`FilesPop`/`SaveVersionPop`. Also order entry's `KeyedPop`, the sidebar right-click menu (`App.jsx:3217`), the label-set sort (`AppsWorkspace.jsx:451`) and `SkuLookup`'s list. Proof: `samples-preview.html?browser=1`, `rail-preview.html`, `order-entry-preview.html`, `phonepreview.html`.
- **Task 4.4:** Once no `<select>` remains in app code (`grep -n "<select" src/*.jsx`, excluding the dev harness pages), drop the `SELECT` special case from `escstack.js` (and its test) and delete the now-unused `FitSelect` twin-span code path.
