# FloorTrack — Domain Language

The shared vocabulary for FloorTrack, a tool for flooring/tile contractors to
manage customer jobs, product selections, and material estimates.

## Language

### Builders, customers, and jobs (see ADR 0005)

**Builder**:
A general contractor or production builder that Customers come from (e.g. a GC
who sends the shop many buyers). A canonical entry you **link to**, not free
text, so "P&L" and "P & L" can't split into two groups. Has many Customers;
optional (a Customer can be direct, with no builder).
_Avoid_: Company (that's the materials catalog term — see below), GC, vendor.

**Customer**:
A person or account the shop sells to. Holds contact info (phone, email,
address) **once** and owns many **Projects**. Optionally sits under a Builder.
_Avoid_: Client, job (a Customer is no longer a single job — see Project).

**Project** (a.k.a. Job):
A single flooring job — its areas, selections, saved versions, and attachments.
Belongs to one Customer. This is what "Customer" meant before ADR 0005; the
`customers` table was renamed `projects`.
_Avoid_: Estimate (that's the printed output of a Project), order.

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

**Waste factor**:
The overage added to measured square footage before ordering. Kept as two rates —
one for **tile**, one shared by every other flooring type (**hardwood, vinyl,
laminate, carpet**) — stored as `waste: { tile, floor }`. Tile grout/mortar always
bill at the tile rate; a carton or underlayment line uses whichever rate matches
its own flooring type. A pre-split record's single `wastePct` number migrates onto
both rates, so old data keeps the overage it had.
_Avoid_: "the 10%" (it is no longer one number).

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

**Base unit** (see ADR 0006):
The material half of a two-part grout — the SpectraLock Full/Comm. unit or the
PermaColor Sanded/Unsanded base — that a pigment (SpectraLock Part C, PermaColor
Color Kit) is mixed into. Modeled as a **companion of the grout product**: it is
ordered 1:1 with the grout's kit count (`base order = ceil(grout order / per)`,
where a Commercial unit is `per` 4) and consolidates into the bottom materials
summary. Defined once from the price book's "Bulk & Base Units" pairing.
_Avoid_: "base coat" (that's a mortar), "part B".

**SKU link** (see ADR 0006):
An optional price-book SKU stored **on a catalog product** (grout/mortar/
underlayment). It is a product attribute, not the key a Selection stores — jobs
still link **by name** (ADR 0002). Read only when editing the catalog (pre-fill,
refresh, defining a base companion), never at calculation time (ADR 0003), and
shown next to each material in the order totals. A grout linked to a **book
family** (ADR 0007) additionally snapshots the picked color's own SKU onto the
Selection (`grout.sku`, display-only); that per-color SKU outranks the catalog
product's SKU on the printed lines.

**Book family** (see ADR 0007):
The price-book grout family a catalog grout offers its colors from — stored as
the stock items' `product` name from the Grout & Caulk sheet (one stock item
per family × color, one SKU each). Linked on the catalog grout's `book` field;
empty means the grout uses the standard code-defined color list and no
per-color SKUs.
_Avoid_: "brand" (a family is one product line, not the manufacturer).

**Enabled** (show/hide):
The on/off state on a company or product controlling whether it appears in
Selection dropdowns. Disabling hides it from *future* picks; it is never deleted
and never affects already-saved jobs.
_Avoid_: Active, archived (a retired Customer concept — see ADR 0004; this is catalog show/hide).

## Relationships

- A **Builder** has many **Customers** (a Customer may have none — "direct").
- A **Customer** has many **Projects**; a **Project** has many **Areas**; an
  **Area** has many **Selections**.
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
- **"Customer" changed meaning (ADR 0005).** It used to mean a single job; now a
  Customer is a person/account that owns many **Projects**. The single-job thing
  is a **Project**. The DB table `customers` was renamed `projects`; a new
  `customers` table holds the person.

## Example dialogue

> **Dev:** When someone adds a Selection to an Area and picks "PermaColor Select,"
> what does the job actually store?
> **Domain expert:** Just the name. The math finds the coverage by looking that
> name up in the catalog.
> **Dev:** So if you hide that grout later?
> **Domain expert:** It drops off the dropdown for new selections, but the old job
> still shows it and still calculates — it's only *hidden*, not gone. And two
> grouts can't share a name, so the lookup never gets confused.
