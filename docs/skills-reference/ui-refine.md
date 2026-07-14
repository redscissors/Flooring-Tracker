---
name: ui-refine
description: Interactive UI refinement planner for the FloorTrack app. Use this skill whenever the user wants to improve, polish, or rethink any part of the FloorTrack interface — even if they say things like "the app feels rough", "can we clean up the layout", "something feels off", "make it look better", or name a specific screen or section. The skill guides the user through a series of focused choices to build an actionable improvement list, rather than presenting a finished plan for rubber-stamping.
---

# UI Refinement Planner

This skill helps plan UI improvements to FloorTrack through a short interactive conversation. The goal is an **actionable numbered task list** the user can execute immediately — not a design document.

---

## Step 1 — Pick a focus area

If the user passed an area as an argument (e.g., `/ui-refine header`), skip this question and use that area.

Otherwise, ask:

```
AskUserQuestion:
  question: "Which part of the app do you want to focus on?"
  header: "Focus area"
  multiSelect: false
  options:
    - label: "Full app overview"
      description: "Survey the whole interface for the highest-impact improvements"
    - label: "Header & navigation"
      description: "Top bar, sign-out, app title, toolbar buttons"
    - label: "Customer list"
      description: "The sidebar or list of customers — layout, empty state, search/filter"
    - label: "Customer detail"
      description: "The main panel: areas, products, notes, version history"
    - label: "Product editor"
      description: "The form for adding/editing a tile or flooring product"
    - label: "Settings"
      description: "Waste %, mortar/grout rates, other global preferences"
```

---

## Step 2 — Pick refinement types

```
AskUserQuestion:
  question: "What kind of improvements are you looking for? Pick all that apply."
  header: "Refinement type"
  multiSelect: true
  options:
    - label: "Visual polish"
      description: "Colors, spacing, font sizes, borders, shadows — the way things look"
    - label: "Layout & structure"
      description: "Arrangement of elements, visual hierarchy, use of space, responsiveness"
    - label: "UX flow"
      description: "Button placement, feedback messages, empty states, confusing interactions"
```

---

## Step 3 — Read the relevant code

Read the source files needed for the chosen area. At minimum read `src/App.jsx`. For smaller focused areas you can skip sections of the file using offset/limit — no need to load the whole file if you're only looking at the product editor.

As you read, build a list of **candidate improvements** that match the chosen refinement types. Keep each candidate to one plain-English sentence — no code snippets, no Tailwind class names.

Aim for 3–8 candidates. If you find more, group the weaker ones together or drop the lowest-impact ones — you want the user making real choices, not clicking through a checklist of 15 items.

Stay within the existing Sage & Cream theme. Do not propose new colors or invent new design patterns — only refine what's already there.

---

## Step 4 — Present candidates in logical groups

Group related candidates (e.g., all spacing issues together, all empty-state issues together) and ask about each group in one question. Aim for no more than 3–4 AskUserQuestion calls total in this step.

For each group, ask something like:

```
AskUserQuestion:
  question: "Which of these spacing and layout changes would you like to include?"
  header: "Layout"
  multiSelect: true
  options:
    - label: "Tighten the gap between the area header and its product list"
      description: "Currently there's more space than needed, making the sections feel disconnected"
    - label: "Add a subtle divider between each customer in the sidebar"
      description: "Right now customers run together visually with no clear separation"
    - label: "Give the empty-state message in the customer list more breathing room"
      description: "The 'No customers yet' text sits too close to the top of the panel"
```

Describe each candidate plainly — what changes and why it matters — without referencing code.

---

## Step 5 — Output the task list

Collect every candidate the user included and output a clean numbered list in chat:

```
Here's your UI refinement plan — ready to execute:

1. **[File]** — [Plain English description of the change]
2. **[File]** — [Plain English description of the change]
…
```

Name the file (e.g., `src/App.jsx`) for each item so it's clear where the work happens.

End with: "Say 'do it' to apply all of these, or call out any numbers you want to skip or adjust first."

---

## Conventions to respect (from CLAUDE.md)

- All mutations go through `persist(next)` — don't touch Supabase directly.
- The Sage & Cream theme works by overriding Tailwind's slate/indigo classes in the `<style>` block. Reuse existing utility classes; don't invent new color values.
- `normC / normA / normP` normalize data — if adding new fields, extend these.
