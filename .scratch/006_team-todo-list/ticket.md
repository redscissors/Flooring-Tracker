---
issue_type: Task
summary: Replace the sidebar backup/restore buttons with a shared team "Issues" to-do list (add / complete / reopen / delete / drag-reorder, done section, open-count badge); backup/restore moves to the bottom of the Settings modal.
status: done
labels: [ready-for-human]
---

# Team issue / to-do list; backup & restore tucked into Settings

## Problem / Why

- The sidebar footer spent its space on two icon buttons (backup export /
  restore) that are touched a few times a year, while the team had no place at
  all to jot down bugs, feature ideas, and shop reminders — those lived in
  texts and sticky notes.
- Requested directly: "hide the backup and restore buttons inside the settings
  and replace them with an Issues/to do button… anyone can add issues and
  features… added and removed and maybe completed… drag them around to move
  the most important one to the top."

## What changed

- **Sidebar footer**: the Download/Upload backup buttons are gone; in their
  place an **Issues** button (ListTodo icon) with a badge showing the open-item
  count. Backup/restore didn't disappear — both buttons (and the hidden file
  input) now sit in a "Backup & restore" section at the bottom of the Settings
  modal.
- **New shared table** `todos` (`supabase/todos.sql`, run once): one row per
  item, RLS open to any authenticated user — the same trust model as customers
  and shared_settings. `position` (double) orders open items; everything else
  (`text, done, doneAt, createdBy, createdAt`) lives in `data` jsonb.
- **Issues & To-Do modal** (`TeamTodos` in App.jsx):
  - Add via input + Enter/Add button; new items land on top.
  - Open items show text, who added it and when; drag the Hand handle
    (pointer-capture drag, same insertion-bar UX as product cards) to reorder —
    a drop renumbers all open items 0..n-1 in one upsert.
  - Checking an item marks it done (strikethrough, "Done" section at the
    bottom, sorted by completion); reopening puts it back on top. Items can be
    deleted individually, and "Clear done" empties the done section.
  - List refreshes from the table every time the modal opens so teammates'
    additions show up.
- **Write paths** in App.jsx (`loadTodos`, `addTodo`, `updateTodo`,
  `toggleTodo`, `delTodo`, `clearDoneTodos`, `reorderTodos`) follow the
  optimistic-update-then-write convention; startup load is best-effort like
  stock, so installs that haven't run `todos.sql` just don't get the list.
- CLAUDE.md updated (source layout, data model, feature note, conventions).

## Out of scope / later ideas

- Realtime sync while the modal is open (currently refresh-on-open,
  last-write-wins like everything else).
- Item detail: descriptions, comments, assignees, or bug/idea tags.
