# Central Claude issues + right-click "Flag for Claude" on product lines (2026-08-13)

Status: done — built 2026-08-13 after prototype approval ("Go ahead and build")

## What shipped (see the R*.png screenshots — the real components)

- `supabase/claude-issues.sql` — the `claude_issues` table (todos-shaped, RLS).
  **Run once by hand in the dashboard before merging** — until then flags show
  "Save failed — run supabase/claude-issues.sql?" and nothing persists.
- `src/claudeissues.js` (+ tests) — issue shape, source builders (snapshot at
  flag time + live ids), the cross-source copy report.
- `src/useclaudeissues.js` — write paths, shaped like useTodos.
- `src/claudeflag.jsx` — shared ClaudeMark + the one FlagForClaude popover.
- `src/linemenu.jsx` + App wiring — the ⋯ replaces the row's hand + trash
  (option A: click = menu, hold-and-pull = the existing startDrag; right-click
  on the row too, suppressed inside fields). Duplicate / Move to area /
  Flag for Claude / Delete (existing inline confirm). Flagged rows wear a
  small clay ✳ beside the dots. The empty search-row adder keeps its old
  hand + trash.
- `src/TeamTodos.jsx` — tab strip: Team list (unchanged) | Claude bucket
  (source chips, copy report, general add, done section). Sidebar badge
  splits ink (team) / clay (Claude).
- Price book ✳ now opens the same popover and writes BOTH the item mark
  (book filter chip) and a central issue; unpark clears only the mark.
- Mobile row sheet gets a "Flag for Claude" button over the same popover.

### Decided during build

- **No migration of existing `claudeIssue` marks** — that would be an agent
  writing live data (non-negotiable #1). Old parked SKUs keep working from
  the book page; re-flag them to bring them into the central list, or the
  owner can ask for a one-shot migration SQL later.
- "Copy for order entry" stayed OUT of the line menu — it needs the order
  panel's computed row context; the panel already has per-line copy.

## Original request

Request:

> "We already have kind of a claude fix button in the price book, could we make
> so it goes into a seperate issues but still under issues. I would like to be
> able to bring up issues anywhere and have the go to a centeral location to
> work on later and not have to try to find them. I would also then like to
> right click on a product line and be able to open a menu of sorts. The one
> option would be to add it to the claude issues and be able to also say what
> is wrong if I want to."

## What's proposed

Three moves, prototyped in `prototype.html` (open it in a browser — the menu,
popover, bucket and toast are all clickable):

1. **A second tab under Issues & To-Do.** The existing modal grows a
   `Team list | ✳ Claude` tab strip. The team list is untouched; everything
   flagged for Claude — from any surface — collects on the Claude tab. It keeps
   the team-list rhythm (done items strike through and drop below, clear done)
   and adds one big action: **Copy report for Claude**, the per-book copy
   report generalized across the whole bucket (each issue's note + captured
   context + stored row data, grouped by source).

2. **Right-click menu on a product line.** Right-click (or the row-end ⋯, for
   the iPad) opens a line menu; "Flag for Claude…" opens a small popover that
   shows the auto-captured context (customer · area · row · SKU · book),
   quick-reason chips, and an optional "what's wrong" note. Adding lands it in
   the central bucket and marks the row with a small clay ✳. The menu also
   gives other row actions (duplicate, move, copy for order entry, delete) a
   discoverable home.

   **Owner decision 2026-08-13 ("option A"):** the ⋯ replaces BOTH row-end
   hover icons (the hand drag-handle and the trash). It is the row's one grip —
   a plain click opens the menu, a press-hold-and-pull drags the row (the same
   hold-to-arm detection `startDrag` already does, pointed at one button —
   no tip line in the menu, owner 2026-08-13: it clutters; the grab cursor on
   hover is the affordance, and "Move to area" covers long cross-area hauls
   without dragging). Delete moves into the menu.
   Mobile is unchanged: long-press-the-row still drags, the menu items live in
   the row sheet. The prototype's drag is live — hold the dots and pull.

3. **Every other flag point routes to the same bucket.** The price book's
   existing ✳ button opens the same popover and writes to the central list
   (the book page keeps its Claude filter chip, now reading the shared bucket
   filtered to that book). The sidebar Issues badge splits: team count in ink,
   Claude count in clay. A typed "general" issue (not tied to any row) adds
   from the bucket itself.

## Screenshots

| | |
|---|---|
| A1 job sheet | A2 the line menu (⋯ / right-click) |
| A3 flag popover with note | A4 toast + flagged-row ✳ |
| A5 mid-drag off the ⋯ (drop bar) | A6 after the drop (flag rides along) |
| B1 the Claude tab | B2 team tab unchanged |
| C1 other flag points | C2 book ✳ → same popover |

## Decisions this raises (not yet made — for /decide before implementation)

- **Storage.** Prototype assumes a small `claude_issues` table shaped like
  `todos` (shared rows, RLS), one row per flag with a `source` jsonb
  (`{kind: "job"|"book"|"general", custId?, areaId?, productId?, bookId?,
  sku?, snapshot}`). The alternative — reusing `todos` rows with a `kind`
  field — keeps one table but mixes two lists that sort and act differently.
- **The existing per-book `claudeIssue` marks.** Migrate them in as
  book-source rows (and keep writing the item mark so the book filter chip
  stays cheap), or leave the book bucket as-is and only add the new surfaces.
  Prototype note in scene 3 assumes migrate + keep-both-in-sync via
  `setBookItemIssue`.
- **Context menu scope.** Native `contextmenu` on desktop + the ⋯ button on
  touch is what's mocked. Long-press could hijack iOS text selection — the ⋯
  is the safe touch door either way.
- **Snapshot vs live reference.** A flagged job line should probably carry a
  frozen snapshot of the row at flag time (like a version) *plus* the live
  ids, so the report stays meaningful after the row is edited or deleted.

## Files

- `prototype.html` — the clickable board (3 scenes), Moss-kit palette
- `shoot.mjs` — Playwright script that produced the PNGs
- `A*/B*/C*.png` — preview proof
