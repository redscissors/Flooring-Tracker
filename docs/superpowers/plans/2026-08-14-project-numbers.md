# Project Numbers (N100) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permanent N100-style numbers on projects — claimed from a Postgres sequence on first real name, shown in the header's Project box and the print corner, with the print title restyled per the approved prototype.

**Architecture:** `project_no` is a real column on `projects` (never in the `data` jsonb) so the DB enforces uniqueness; a `claim_project_no` RPC assigns it atomically and idempotently. The app mirrors it as `projectNo` on the in-memory project (like `customerId`), claims on the empty→real name transition in `updateProject`, and degrades silently until the owner runs the SQL.

**Tech Stack:** React 18 / Vite 5 / Supabase (PostgREST + RPC), `node --test` for units.

**Spec:** `docs/superpowers/specs/2026-08-14-project-numbers-design.md`. One amendment locked here: backup **restore claims fresh numbers** (restore adds copies under fresh ids — "nothing existing is overwritten" — so old numbers cannot ride along without colliding with the still-live originals). The export does not carry numbers.

## Global Constraints

- Never run SQL against the live project — `supabase/project-numbers.sql` is shipped only.
- No push to `main`; all work on `claude/project-numbering-prototype-rjp1am`.
- Print stays ink-only (`@media print` remaps untouched); UI change needs preview proof before merge.
- "Real name" = trimmed non-empty, not `New Project`, not `isQuickAutoName` (blank / `Quick price` / `Q-…-M/D`).
- Number renders as `N${projectNo}`; a null `projectNo` renders nothing, everywhere.
- Repo comment style: rare, only non-obvious rules (root CLAUDE.md).

---

### Task 1: `isRealProjectName` (model.js)

**Files:**
- Modify: `src/model.js` (beside `isQuickAutoName`, ~line 53)
- Test: `src/model.test.js` (append)

**Interfaces:**
- Produces: `isRealProjectName(name: string|null) => boolean` — imported by Tasks 4/6.

- [ ] **Step 1: Write the failing test** — append to `src/model.test.js`:

```js
test("isRealProjectName: only a hand-typed name counts (spec 2026-08-14 claim rule)", () => {
  for (const bad of ["", "  ", null, undefined, "New Project", " New Project ", "Quick price", "Q-Marazzi Rice-8/14"])
    assert.equal(isRealProjectName(bad), false, JSON.stringify(bad));
  for (const good of ["Marsh — whole first floor", "N house", "Quick pricers club", "Q-shaped room"])
    assert.equal(isRealProjectName(good), true, good);
});
```

Add `isRealProjectName` to the file's existing `import ... from "./model.js"` line.

- [ ] **Step 2: Run to verify it fails** — `npm test` → FAIL (`isRealProjectName` not exported).
- [ ] **Step 3: Implement** in `src/model.js`, directly under `isQuickAutoName`:

```js
// The project-number claim gate (spec 2026-08-14): a number is minted only for
// a name a person typed — the "New Project" birth default and quick auto-names
// never claim, so drafts stay unnumbered until someone names them.
export const isRealProjectName = (name) => { const s = String(name || "").trim(); return !!s && s !== "New Project" && !isQuickAutoName(s); };
```

- [ ] **Step 4: Run to verify pass** — `npm test` → all pass.
- [ ] **Step 5: Commit** — `git add src/model.js src/model.test.js && git commit -m "Add isRealProjectName — the project-number claim gate"`

### Task 2: `supabase/project-numbers.sql`

**Files:**
- Create: `supabase/project-numbers.sql`
- Modify: `CLAUDE.md` (source-layout list, after `pricebook-disabled.sql` entry)

**Interfaces:**
- Produces: column `projects.project_no integer` (unique), RPC `claim_project_no(pid text) returns integer` — called by Task 4 via `supabase.rpc("claim_project_no", { pid })`.

- [ ] **Step 1: Write the file** (owner runs it by hand; backfill guarded so a re-run can't renumber):

```sql
-- run once: project numbers (N100) — spec docs/superpowers/specs/2026-08-14-project-numbers-design.md
-- Adds projects.project_no (unique, permanent), backfills existing real-named
-- projects oldest-first from 100, and installs the claim RPC the app calls on
-- a project's first real name. The name test mirrors src/model.js
-- isRealProjectName: blank, 'New Project' and quick auto-names never number.

alter table public.projects add column if not exists project_no integer;
create unique index if not exists projects_project_no_key on public.projects (project_no);

do $$
begin
  if not exists (select 1 from public.projects where project_no is not null) then
    update public.projects p set project_no = s.n
    from (
      select id, 99 + row_number() over (order by created_at, id) as n
      from public.projects
      where coalesce(trim(data->>'name'), '') <> ''
        and trim(data->>'name') not in ('New Project', 'Quick price')
        and trim(data->>'name') !~ '^Q-.*-\d{1,2}/\d{1,2}$'
    ) s
    where p.id = s.id;
  end if;
end $$;

create sequence if not exists public.project_no_seq;
select setval('public.project_no_seq', coalesce((select max(project_no) from public.projects), 99));
grant usage, select on sequence public.project_no_seq to authenticated;

-- Atomic + idempotent: first caller mints, every later call (retries, the
-- per-keystroke name field, a second device) reads the same number back.
-- security invoker — the update runs under the caller's RLS rights.
create or replace function public.claim_project_no(pid text) returns integer
language sql as $$
  update public.projects set project_no = nextval('public.project_no_seq')
    where id = pid and project_no is null;
  select project_no from public.projects where id = pid;
$$;
```

- [ ] **Step 2: Add the CLAUDE.md source-layout line** (keeps the run-once inventory complete):

```
  project-numbers.sql  # run once: projects.project_no + backfill + claim RPC
                    # (project numbers N100, spec 2026-08-14); code falls back
                    # to numberless display until it is run
```

- [ ] **Step 3: Commit** — `git add supabase/project-numbers.sql CLAUDE.md && git commit -m "Ship project-numbers.sql — project_no column, backfill, claim RPC"`

### Task 3: Boot load carries `projectNo` (bootload.js)

**Files:**
- Modify: `src/bootload.js:15-28,39-43`
- Modify: `src/App.jsx:526` (server-side search select)
- Test: `src/bootload.test.js` (create if absent, else append)

**Interfaces:**
- Consumes: `projects.project_no` column (Task 2; may not exist yet).
- Produces: `lightRow(r).projectNo: number|null`; `listSelect(): string` (the select string currently known to work — `LIST_SELECT` with `project_no` until a load proves the column missing); `loadProjects` sets that state.

- [ ] **Step 1: Write the failing test** (`src/bootload.test.js`, node --test style used by the suite; fake client pattern per the file header's contract):

```js
import test from "node:test";
import assert from "node:assert/strict";
import { lightRow, loadProjects, listSelect, LIST_SELECT } from "./bootload.js";

const fakeDb = (impl) => ({ from: () => ({ select: impl }) });

test("lightRow mirrors project_no as projectNo (null when absent)", () => {
  assert.equal(lightRow({ id: "a", project_no: 214 }).projectNo, 214);
  assert.equal(lightRow({ id: "a" }).projectNo, null);
});

test("loadProjects falls back to the legacy select when project_no is missing", async () => {
  const asked = [];
  const rows = await loadProjects(fakeDb(async (sel) => {
    asked.push(sel);
    if (sel.includes("project_no")) return { data: null, error: { message: "column projects.project_no does not exist" } };
    return { data: [{ id: "a" }], error: null };
  }));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].projectNo, null);
  assert.equal(asked.length, 2);
  assert.ok(!listSelect().includes("project_no"));
});

test("loadProjects keeps project_no in listSelect when the column exists", async () => {
  await loadProjects(fakeDb(async () => ({ data: [{ id: "a", project_no: 100 }], error: null })));
  assert.ok(listSelect().includes("project_no"));
  assert.ok(LIST_SELECT.includes("project_no"));
});
```

- [ ] **Step 2: Run to verify fail** — `npm test` → FAIL (`listSelect` not exported).
- [ ] **Step 3: Implement** in `src/bootload.js`:

```js
// LIST_SELECT includes project_no (spec 2026-08-14); an install that hasn't
// run supabase/project-numbers.sql yet would fail the whole projects load on
// it, so loadProjects retries without and listSelect() remembers which worked
// (server-side search reuses it).
const LIST_SELECT_LEGACY = "id, created_at, updated_at, customer_id, name:data->>name, address:data->>address, phone:data->>phone, email:data->>email, quick:data->>quick, sales:data->salesperson->>name";
export const LIST_SELECT = LIST_SELECT_LEGACY + ", project_no";
let activeListSelect = LIST_SELECT;
export const listSelect = () => activeListSelect;
```

`lightRow` gains `projectNo: r.project_no ?? null,` (beside `customerId`). `loadProjects` becomes:

```js
export const loadProjects = async (db) => {
  let { data: rows, error } = await db.from("projects").select(activeListSelect);
  if (error && activeListSelect !== LIST_SELECT_LEGACY) {
    activeListSelect = LIST_SELECT_LEGACY;
    ({ data: rows, error } = await db.from("projects").select(activeListSelect));
  }
  if (error) throw error;
  return (rows || []).map(lightRow);
};
```

In `src/App.jsx` line 4 swap the `LIST_SELECT` import for `listSelect`, and line 526 to `.select(listSelect())`.

- [ ] **Step 4: Run to verify pass** — `npm test` → all pass.
- [ ] **Step 5: Commit** — `git add src/bootload.js src/bootload.test.js src/App.jsx && git commit -m "Carry project_no through the light project rows, legacy-select fallback"`

### Task 4: Claim path + jsonb strip (usedirectory.js, App.jsx restore)

**Files:**
- Modify: `src/usedirectory.js` (imports; `custData` ~line 101; `updateProject` ~line 131; expose `claimProjectNo` ~line 268)
- Modify: `src/App.jsx` `importBackup` (~line 1050, after the project INSERT succeeds)

**Interfaces:**
- Consumes: `isRealProjectName` (Task 1), RPC `claim_project_no` (Task 2).
- Produces: `claimProjectNo(id: string)` returned from `useDirectory` (App.jsx destructures it beside `updateProject`).

- [ ] **Step 1: Strip the mirror from jsonb writes** — `custData`'s destructure gains `projectNo`:

```js
const custData = ({ ownerId, visibility, archived, versions, _full, updatedAt, customerId, projectNo, ...rest }) => rest;
```

- [ ] **Step 2: Add the claim** (inside `useDirectory`, above `updateProject`; import `isRealProjectName` from `./model.js`):

```js
// Mint the project's permanent number (spec 2026-08-14). Fire-and-forget and
// idempotent server-side; before supabase/project-numbers.sql runs the RPC is
// missing and the catch leaves the project numberless — by design.
const claimInFlight = useRef(new Set());
// `name` is passed by updateProject because dataRef still holds the pre-edit
// state when this fires — reading cur.name here would lag one keystroke.
const claimProjectNo = (id, name) => {
  const cur = dataRef.current.projects.find((c) => c.id === id);
  if (!cur || cur.projectNo || claimInFlight.current.has(id) || !isRealProjectName(name ?? cur.name)) return;
  claimInFlight.current.add(id);
  (async () => {
    try {
      const { data: n, error } = await supabase.rpc("claim_project_no", { pid: id });
      if (error) throw error;
      if (n != null) setData((prev) => ({ ...prev, projects: prev.projects.map((c) => c.id === id ? { ...c, projectNo: n } : c) }));
    } catch (e) { /* SQL not run yet, or offline — the number arrives on a later save */ }
    finally { claimInFlight.current.delete(id); }
  })();
};
```

In `updateProject`, after the `setData(next)` line: `if ("name" in patch) claimProjectNo(id, patch.name);` (the auto-rename patch also carries `name`, but its Q-name fails `isRealProjectName`, so it can't claim). Add `claimProjectNo` to the hook's returned object.

- [ ] **Step 3: Restore claims fresh numbers** — in `App.jsx` `importBackup`, the restored loop, immediately after the successful project INSERT (after the `catch (x) { continue; }` line): `if (isRealProjectName(c.name)) { try { await supabase.rpc("claim_project_no", { pid: c.id }); } catch (x) { } }` (state refreshes on next boot; the restored list renders numberless this session, acceptable for a rare admin action). Import `isRealProjectName` in App.jsx's model.js import line. Also destructure `claimProjectNo` from the `useDirectory({...})` result so Task 4's hook change is reachable (even though only `updateProject`/restore call it today).
- [ ] **Step 4: Verify** — `npm test` (still green) and `npm run build` → succeeds.
- [ ] **Step 5: Commit** — `git add src/usedirectory.js src/App.jsx && git commit -m "Claim project_no on the first real name; strip the mirror from jsonb"`

### Task 5: Header corner label, 2A (projectheader.jsx)

**Files:**
- Modify: `src/projectheader.jsx:194` (bar) and `:298` (classic)
- Preview: `src/headerpreview.jsx` mock gains `projectNo: 214`

**Interfaces:**
- Consumes: `sel.projectNo` (Tasks 3/4).

- [ ] **Step 1: Bar layout** — replace the eyebrow line inside the Project idbox:

```jsx
<div className="flex items-center justify-between gap-2">
  <div className="ft-eyebrow text-[8px]" style={{ color: "var(--ft-faint)" }}>Project</div>
  {sel.projectNo && <div className="ft-eyebrow text-[8px]" style={{ color: "var(--ft-faint)", letterSpacing: ".08em" }}>N{sel.projectNo}</div>}
</div>
```

- [ ] **Step 2: Classic layout** — the centered eyebrow becomes `<div className="ft-eyebrow text-[9px] mb-1 text-center">Project{sel.projectNo ? <span style={{ letterSpacing: ".08em" }}> · N{sel.projectNo}</span> : null}</div>`.
- [ ] **Step 3: Preview proof** — add `projectNo: 214` to `headerpreview.jsx`'s mock project; `npm run dev` (or `npx vite --port 5199`) and screenshot `header-preview.html` with Playwright (`/opt/pw-browsers/chromium`); confirm the corner reads N214 and an edit removing it isn't possible (label only). Save the shot under `.scratch/088_project-numbers/`.
- [ ] **Step 4: Commit** — `git add src/projectheader.jsx src/headerpreview.jsx && git commit -m "Project box wears its number — quiet 2A corner label, both layouts"`

### Task 6: Print — stacked title, number, stacked salesperson, order sheet (EstimatePrint.jsx, App.jsx)

**Files:**
- Modify: `src/EstimatePrint.jsx:39-43` (classic corner), `:63` (classic salesperson), `:253-257` (cards corner), `:263` (cards salesperson)
- Modify: `src/App.jsx:2422` (order-sheet header line)

**Interfaces:**
- Consumes: `sel.projectNo`.

- [ ] **Step 1: Cards corner** (lines 253–257) — replace the stack with the picked 3A·stacked one-size-up treatment:

```jsx
<div className="flex flex-col items-end" style={{ gap: 3, flexShrink: 0 }}>
  <div className="uppercase" style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".14em", color: "var(--ft-brand-deep)", lineHeight: 1.45, textAlign: "right" }}>Flooring &amp; Tile<br />Selections</div>
  {sel.projectNo && <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".02em" }}>N{sel.projectNo}</div>}
  <div className="ft-mono" style={{ fontSize: 9.5, color: "var(--ft-muted)" }}>{new Date().toLocaleDateString()}</div>
  {tag && <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: ".18em", color: "var(--ft-brand-deep)" }}>{tag}</div>}
</div>
```

- [ ] **Step 2: Classic corner** (lines 39–43) — same replacement, keeping that block's `fontWeight: 700` for the tag/date it already uses:

```jsx
<div className="flex flex-col items-end" style={{ gap: 4 }}>
  <div className="uppercase" style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".14em", color: "var(--ft-brand-deep)", lineHeight: 1.45, textAlign: "right" }}>Flooring &amp; Tile<br />Selections</div>
  {sel.projectNo && <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".02em" }}>N{sel.projectNo}</div>}
  <div className="ft-mono" style={{ fontSize: 9.5, color: "var(--ft-muted)" }}>{new Date().toLocaleDateString()}</div>
  {tag && <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".18em", color: "var(--ft-brand-deep)" }}>{tag}</div>}
</div>
```

- [ ] **Step 3: Salesperson stacks, both layouts** — cards line 263 becomes a multi-detail entry. The grid `.map` renders one `detail` div; generalize it: pass `detail` as an array and render `.map`:

```jsx
{[
  ["Customer", cust?.name || printName, [cust?.address || sel.address]],
  ["Your salesperson", pname, [sp.phone, sp.email].filter((x) => x && x !== pname)],
  ["Project", printName, [[scopeNote, wMeta].filter(Boolean).join(" · ")]],
].map(([label, name, details], i) => (
  <div key={i} className="flex flex-col" style={{ gap: 2 }}>
    <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: ".2em", color: "var(--ft-faint)" }}>{label}</div>
    <div style={{ fontSize: 12.5, fontWeight: 800 }}>{name || PRINT_DASH}</div>
    {details.filter(Boolean).map((d, j) => <div key={j} style={{ fontSize: 11, color: "var(--ft-muted)" }}>{d}</div>)}
  </div>
))}
```

Classic (line 53's `col` helper + calls): change `col`'s third param to an array the same way — `col("Your salesperson", pname, [sp.phone, sp.email].filter((x) => x && x !== pname))`, `col("Customer", …, [cust?.address || sel.address])`, `col("Project", printName, [wMeta])`.

- [ ] **Step 4: Order sheet** (App.jsx:2422) — the right-hand line leads with the number: `{sel.projectNo ? `N${sel.projectNo} · ` : ""}{sel.name}…` (template the existing expression; the order sheet keeps its own "Order sheet" title — it's a pick list, not a selections sheet; the number is what travels).
- [ ] **Step 5: Preview proof** — `.scratch/088_project-numbers/`: preview harness rendering the REAL `EstimatePaper` over a fixture with `projectNo: 214` (pattern: `.scratch/085_print-mono-ink/preview.jsx`), shot in screen media and print media; plus the order sheet block. Verify: stacked title both layouts, N214 present/absent (second fixture without a number), salesperson two lines, ink-only print.
- [ ] **Step 6: Verify + commit** — `npm test && npm run build` → green. `git add src/EstimatePrint.jsx src/App.jsx .scratch/088_project-numbers && git commit -m "Print wears the project number — stacked title corner, stacked salesperson"`

### Task 7: Docs + spec sync

**Files:**
- Modify: `docs/superpowers/specs/2026-08-14-project-numbers-design.md` (backup/restore paragraph → fresh-claim amendment; status line)
- Modify: `.claude/skills/floortrack-data-model/SKILL.md` (projects row: `project_no` column note)

- [ ] **Step 1:** Spec's Backup/restore paragraph replaced with: restore adds copies under fresh ids, so restored real-named projects claim fresh numbers; the export carries no numbers. Status → "approved, implemented on claude/project-numbering-prototype-rjp1am".
- [ ] **Step 2:** Data-model skill: projects row gains `project_no int (unique, nullable)` with the one-line claim rule and the custData-strip note.
- [ ] **Step 3: Commit** — `git add docs .claude/skills/floortrack-data-model/SKILL.md && git commit -m "Sync spec + data-model skill with project numbers"`

## Verification (whole change)

1. `npm test` — all unit suites green.
2. `npm run build` — clean production build.
3. Preview screenshots in `.scratch/088_project-numbers/` — header N214, print corner with/without number, order sheet line, print-media (ink) rendering.
4. `git push -u origin claude/project-numbering-prototype-rjp1am`.
