# FloorTrack — Domain Language

The shared vocabulary for FloorTrack, a tool for flooring/tile contractors to
manage customer jobs, product selections, and material estimates.

## Language

### Jobs and selections

**Customer** (a.k.a. Job):
A single flooring job for one customer, holding its areas, selections, saved
versions, and attachments.
_Avoid_: Client, account.

**Area**:
A named room or zone within a Customer (e.g. "Master Bath") that holds product
selections.
_Avoid_: Category, room.

**Selection**:
One product line chosen for an Area — its material type, dimensions, pricing, and
(for tile) its grout/mortar choices. This is the per-job thing a user adds to an
area.
_Avoid_: "Product" (overloaded — see *Flagged ambiguities*), line item.

**Version**:
A saved snapshot of a Customer's selections at a point in time, for comparison or
rollback.

### The catalog (new — see ADR 0002)

**Shared Settings**:
The shop-wide configuration shared by every signed-in user — the waste factor plus
the catalog. Replaces the former per-user settings.
_Avoid_: Preferences, my settings (it is no longer per-person).

**Catalog**:
The shared, team-editable set of grout and mortar products, organized by company,
that feeds a Selection's grout/mortar dropdowns.

**Company**:
A manufacturer grouping within the catalog (e.g. Laticrete) that contains grout or
mortar products, and carries its own enabled state.
_Avoid_: Brand, vendor, supplier.

**Grout product / Mortar product**:
A selectable catalog entry carrying its own numbers (a grout product's coverage
rate; a mortar product's coverage tiers and price) and an enabled state. Names are
unique within grout and within mortar.

**Enabled** (show/hide):
The on/off state on a company or product controlling whether it appears in
Selection dropdowns. Disabling hides it from *future* picks; it is never deleted
and never affects already-saved jobs.
_Avoid_: Active, archived (a retired Customer concept — see ADR 0004; this is catalog show/hide).

## Relationships

- A **Customer** has many **Areas**; an **Area** has many **Selections**.
- A tile **Selection** references one grout product and one mortar product **by
  name** (not by id or company) — the name is a unique key into the **Catalog**.
- The **Catalog** has many **Companies**; a **Company** has many **Grout/Mortar
  products**.
- A product appears in a Selection's dropdown only when both its **Company** and
  the product itself are **Enabled**.
- **Shared Settings** is one shared record for the whole team.

## Flagged ambiguities

- **"Product" is overloaded.** It meant both (a) a per-job line on an Area and (b)
  a grout/mortar entry in the catalog. Resolved: the per-job thing is a
  **Selection**; the catalog thing is a **Grout product / Mortar product**.
- **"Settings" changed meaning.** It was per-user; as of ADR 0002 it is
  **Shared Settings** (shop-wide). Old per-user settings are retired.

## Example dialogue

> **Dev:** When someone adds a Selection to an Area and picks "PermaColor Select,"
> what does the job actually store?
> **Domain expert:** Just the name. The math finds the coverage by looking that
> name up in the catalog.
> **Dev:** So if you hide that grout later?
> **Domain expert:** It drops off the dropdown for new selections, but the old job
> still shows it and still calculates — it's only *hidden*, not gone. And two
> grouts can't share a name, so the lookup never gets confused.
