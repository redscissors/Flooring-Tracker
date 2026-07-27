# Exact matches first, ranked across both spaces (2026-07-27)

Status: done

Request:

> "I am running into a problem where the stock is too strong in the search now.
> where it pulling up stock even through an exact match in special order is
> available. […] Before we had stock being search a little bit different and it
> seems to work better."

Reported with a screenshot: searching `hanoi` returned "Showing 30 of 74
matches" — Mirage New **Ha**ven, Aquamix **Ha**ze Rmvr, Custom 380 **Ha**ystack,
Hard Maple wood vents — and not one row containing the word. The vendor book's
actual Hanoi Collection was never reachable.

## Two defects, compounding

**1. The fuzzy pass was far too generous to be the primary tier.** PR #249
(2026-07-23) replaced the stock tier's exact word-inclusion with a JS twin of
pg_trgm's `word_similarity`, so one strictness slider could govern both the
in-memory stock tier and the special-order RPC. pg_trgm pads every word to
`"  w "` before taking 3-char windows, which makes two of a query's trigrams
**free to any word sharing its first two letters**:

```
hanoi vs hanoi      1.000
hanoi vs haystack   0.333   ← clears the 0.30 setting
hanoi vs haze       0.333
hanoi vs haven      0.333
hanoi vs hard       0.333
hanoi vs maple      0.000
```

No single threshold fixes this, because the knee moves with query length — the
free pad pair is 2 of 6 trigrams for `hanoi` (needs 0.35+) but 2 of 4 for `oak`
(needs 0.55+). A slider cannot sit in the right place for both, so **exactness,
not a number, has to decide the primary tier**.

**2. Stock outranked order structurally, not by relevance.** `mergeCombined`
returned `[...stock, ...order]` — a tier ordering — and the list was then cut to
`SKU_SHOW` (30). 74 junk stock hits consumed every visible row, so an exact
special-order match was unreachable *by construction*, not merely low.

## The fix

**Exact first (B).** `useMergedResults` walks three rungs and stops at the first
that answers:

1. **exact** — every typed word literally present. `searchStock` with no
   threshold; on the order side an index-backed `search_text ILIKE '%word%'`
   (the `nearRows`/`exactRows` split in `useordersearch.js`).
2. **near-match** at `searchStrictness`, under the existing amber banner.
3. **wider retry** at `searchFallback`, same banner.

The near-match queries are never issued when the stock tier already answered
exactly (`stockExact` gates `useOrderResults`), so the common case still costs
one round trip.

**Relevance ranking across both spaces (C).** `rankMerged` (orderbook.js)
replaces `[...stock, ...order]`, ordering by `hitRank` (stock.js):

| rung | meaning |
|---|---|
| 0 | the SKU **is** the query |
| 1 | the SKU starts with the query |
| 2 | every typed word starts a word of the item's text |
| 3 | every typed word is in there somewhere |
| 4 | fuzzy only |

Ties break shelf-first, so **stock still wins at equal relevance** — it just
can't outrank a better match any more. `mergeSearch`'s exact-SKU collision and
`collapseCopies` are untouched; only the ORDER changed.

## Settings

The two sliders now govern the near-match rungs only, so the card says so:
"Strictness" → **Near-match**, "Near-match fallback" → **Wider retry**, with a
line of copy above them stating that exact matches always come first. The stored
field names (`searchStrictness` / `searchFallback`) are unchanged — no
migration, no schema churn.

**Worth knowing:** the team's "Wider retry" is currently **Off**. Under the old
model that only removed a second fuzzy pass; now it means one near-match rung
instead of two. That is fine — the near-match rung *is* the typo net — but if
sloppy typing starts coming back empty, drag it below the Near-match value.

## Proof

`before-after.png` — the harness (`preview.html` + `preview.jsx`, served by
`npm run dev`, shot by `shoot.mjs`) renders the REAL `Hit` row over the REAL
`searchStock` / `rankMerged` output. "Before" is literally the old expression
(`mergeSearch(searchStock(…, 0.30))` flattened stock-first); "after" is what the
pickers do now.

- **`hanoi`** — 11 rows → 3, all of them Hanoi. Exact-first is what fixes it.
- **`mpb770`** — every row matches exactly, so exact-first changes nothing and
  the ranking is the whole difference: the product whose SKU it is moves from
  third to first, past two accessories that merely mention the code.

Tests: `hitRank` ladder + the "fuzzy is too generous to be primary" regression
in `stock.test.js`; four `rankMerged` cases in `orderbook.test.js` (778 pass).

## Not done

The special-order RPC keeps the same padding-trigram looseness (it is the same
metric). That is now harmless — it only ever runs as a labeled near-match — so
no SQL change ships with this. If the near-match tier ever feels noisy, the fix
is a minimum shared-trigram floor in `search_price_book_items`, which would need
a hand-run migration.
