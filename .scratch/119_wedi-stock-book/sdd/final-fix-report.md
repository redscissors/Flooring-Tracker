# Final review fix wave — report

The dispatched fix agent landed C1 and was stopped mid-I2 when the process
exited; the controller finished the wave inline. Commits below.

## Landed by the agent

**56bde1f — C1 (Critical), plus known findings 7, 1, I1, M1.**
`WediConfigurator` is now a wrapper (`:615`) holding exactly one hook, gating
on `catReady`, with a real error state and retry; the body is a separate
component (`:635`) that only mounts once the source is installed. No memo
inside it can hold a fallback-derived price, because the body does not exist
until the install has happened — which is stronger than reordering hooks,
since memoization caches across renders and a source swap between renders
would not invalidate `kitTotals` no matter where the hook sat.
Also: `bookError`/`bookErrorOf`/`retryBook` (finding 7 — a failed fetch used
to render literally nothing forever); an idempotent re-assert `useEffect`
using `stockSourceIsBook()` as the getter (finding 1 — its stated blocker was
false); `loadBookItems` moved into a ref with a `nonce` for retry so the deps
are `[enabled, targetIds, hasLoader, nonce]` (I1 — the book refetched on every
parent render, without reintroducing the wedged-hook bug the dep was added to
fix); `stockRows` dropped from the hook (M1).

## Landed by the controller

**b4e00a0 — I2.** The Schluter popup's Compare tab reached `comparekit` →
`wedi.js` `catalog()` with no installer, so its wedi column priced off
whatever the last wedi popup left behind — and `onQuoteOptions` commits those
figures into a project. The install now happens inside `CompareTab` rather
than `SchluterConfigurator`, keeping wedi's tables out of the Schluter chunk;
each host's own engine is switched off (`enabled: !wediHost`) or fed nulls, so
neither double-installs. The wedi column waits on `catReady` and reports a
load failure instead of quoting through it.

**089c717 — I3 (crash guards), with the finding CORRECTED.**
The review said a missing fastener or sealant SKU is a TypeError that takes
out the popup. Measured: it is not reachable today. 22 of the 24 `SKU.*`
constants also appear in `WEDI_SO`, so `item()` still resolves them — as
special-order entries — when the book drops them; the only two stock-only
codes (`sdrySeal`, `sdrySealTrowel`) already go through the guarded `push()`.
The reviewer reasoned from code shape without checking whether those specific
SKUs could null. The guard still landed, because 8b retires `WEDI_SO` and the
pricelist stops backstopping the other 22 — at which point it becomes real.
The test pins what is actually true rather than staging a crash that cannot
happen.

**83a9ab3 — I4, I5, M3, known finding 4.**
I4: ADR 0036 claimed stocked wedi lines gain a `bookId` and move to tier 1 of
`isSpecialOrder`. `bookId` appears zero times in `wediadapter.js` and
`wedi.js`; `adaptRow` emits a six-field stockRow with no such field; and
`orderentry.js:44` short-circuits only for a bookId NOT in `stockBookIds`, so
tier 2 stays load-bearing either way. Rewritten to say so.
I5: `src/CLAUDE.md` had zero entries for `wediadapter.js`,
`usewedicatalog.js`, `wedifixture.js` against nine for the Schluter
counterparts, and nothing recording that wedi's catalog is now installable
module state. Added, including the sole-installer rule — which now covers
CompareTab as well as WediConfigurator, per I2.
Known finding 4: `spell()` bails to the raw decimal when `inch()` cannot
represent the value (0.3 would have returned 19/64 = 0.296875) — a value
change in a file whose contract is zero drift.
M3: `usOf`'s no-US-shaped-code fallback is POSITIONAL. Writing the test
corrected the assumption behind it: its stability is inherited from
`normFits`' sort, not intrinsic to the rule. Pinned as such, with the measured
fact that 0 of 151 rows exercise it.

## NOT fixed, deliberately

I3's "plausibility floor" (refusing to install a book missing `SKU.*`
constants) is a behavior change about how defensive the app should be with a
partial import. That is the owner's call, not a defect fix, and it is
surfaced rather than taken unilaterally. Known findings 3, 5, 6, 9, 10 remain
as deferred polish.

## Verification

- `node --test src/*.test.js` — **1238 pass, 0 fail** (from an 1211 baseline)
- `npm run build` — exit 0
- `npm run lint` — 7 errors, the pre-existing count. Checked that they are the
  SAME seven: `CORNER_CUT` is unused on `main` too, so the split orphaned
  nothing.
- Browser, controller-run: the wedi popup renders after the split with no
  console errors, prices unchanged, Browse reading
  `151 stock · 118 SO · transcribed table`. The Schluter popup's Compare tab
  renders both columns fully priced with no console errors — the wedi column
  reaching the fallback THROUGH the gate rather than by inheritance.

## How C1 was verified

Not by the green suite — `node --test` cannot load `.jsx`, so no test covers
this file. Structurally: the wrapper contains exactly one hook call, so hook
order cannot vary; and the body is a child component, so React mounts it
fresh, meaning its `useMemo` cache cannot predate the install performed in the
parent's render. Confirmed in the browser above.
