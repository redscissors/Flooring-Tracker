# Task 6 report: Wire the popup and show the fallback

## Edits made (all in `src/WediConfigurator.jsx`)

1. **Import changes** (final: `:20` import block, `:28` new import)
   - Removed `catalog` from the `./wedi.js` import list at line 19 (was `:18-25` before edits shifted by +1 line from the new import). `item`, `group`, `pans`, `curbs`, `kitFor`, `solve`, `figureConsumables`, `panelPlan`, `CORNER_CUT`, etc. — all left untouched.
   - Added `import { useWediCatalog } from "./usewedicatalog.js";` at line 28, immediately after the existing `import { normKitBasketEntry } from "./model.js";` line.

2. **Catalog seam replaced** (final: `:1305`)
   - `const cat = catalog();` → `const { cat, catReady, onBook } = useWediCatalog({ stockRows, bookStockReady, books, loadBookItems });`
   - The `nStock` memo directly below (now `:1306`) is untouched and still reads `cat`.

3. **Readiness guard** (final: `:2432`, immediately before `return (` at `:2434`)
   - Inserted:
     ```js
     // Never render a catalog we aren't sure of: with a wedi book present but its
     // rows not in, quoting from WEDI_STOCK would silently price at the last
     // transcription and resurrect retired items (owner, 2026-09-01). Placed
     // after every hook — see the four useMemos above — so hook order is stable.
     if (!catReady) return null;
     ```
   - Placed after the `TAB_DEFS` array and the `compareTab` JSX assembly (neither of which are hooks), and after every `useMemo`/`useEffect`/`useState`/`useRef` call in the component.

4. **Browse caption marker** (final: `:2409-2410`)
   - `["browse", "Browse", nStock + " stock · " + (cat.length - nStock) + " SO"],`
     → 
     ```js
     ["browse", "Browse", nStock + " stock · " + (cat.length - nStock) + " SO"
       + (onBook ? "" : " · transcribed table")],
     ```

## Hook-order verification (the brief's main risk)

Ran `grep -n "use[A-Z][a-zA-Z]*(" src/WediConfigurator.jsx | awk -F: '$1>=2432'` (2432 is the guard's line) against the full 2501-line file — **zero matches**. Every `use*(` call in the component (the four `useMemo`s the brief names, at `:1306`, `:1309`, `:1318`, `:1345`, `:1348` after the +1 line shift from the new import, plus all the state/effect hooks earlier in the component body) sits strictly before the guard at `:2432`. The guard is the last statement before the final JSX `return (` at `:2434`, and the component's closing brace is the file's last line (2501), so nothing — hook or otherwise — sits between the guard and the end of the component except the JSX return itself.

I also confirmed via `grep -n "catalog(" src/WediConfigurator.jsx` that the removed `catalog` import had exactly one call site in the file (the seam I replaced), so no other reference was left dangling.

## Verification output

**`node --test src/*.test.js`**
```
ℹ tests 1234
ℹ suites 0
ℹ pass 1234
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```
1234 pass, 0 fail — matches the task instructions' expected count exactly (the brief's own "1226" figure was stale; the task instructions' re-verified "1234" is what the suite actually produces, unchanged by this task since it adds no tests).

**`npm run build`**
Exit 0. `✓ built in 14.92s`, only the pre-existing "chunks larger than 500 kB" advisory (unrelated to this change, not an error).

**`npm run lint`**
7 pre-existing errors, 0 new:
- `App.jsx:167` `claimProjectNo` unused
- `WediConfigurator.jsx:13` `useId` unused (pre-existing, untouched by this task)
- `WediConfigurator.jsx:20` `CORNER_CUT` unused (pre-existing, untouched by this task)
- `prototypes.jsx:11` `Eye`, `Trash2` unused (2 errors)
- `wedi.test.js:11` `CURB_LAP`, `benchWallShadowSf` unused (2 errors)

Count and set of errors unchanged from before this task's edits — my change added no new unused imports/vars and removed none of the existing ones.

## Files changed

- `C:\Users\User\Documents\Claude ReadWrite\Flooring-Tracker\src\WediConfigurator.jsx` (only file touched)

`git status --porcelain` confirms no other tracked file was modified (the untracked `.scratch/`/`.claude/worktrees/` entries listed by git status predate this task and are unrelated).

## Self-review

- `catalog` is gone from the `./wedi.js` import destructure; `item`, `group`, `pans`, and every other name in that list are present, unchanged, in the same order.
- The guard sits after every hook call (verified above) and before the sole `return (`.
- `cat` still flows to: the `nStock` memo, the Browse caption (`cat.length - nStock`), and (unchanged, not part of this task's edits) any other reader further down in the JSX/Browse tab body that already consumed `cat` before this task.
- `onBook` is now read in exactly one place — the Browse caption — matching the brief's "marker" requirement; it is destructured but this is its only use, which is intentional per the brief (issue 6, step 3).
- No prop plumbing was needed or added — `stockRows`, `bookStockReady`, `books`, `loadBookItems` were already component props (confirmed at the signature, line 561-564) and already passed through unchanged to the Compare tab.
- `App.jsx`, `AppsWorkspace.jsx`, `wedipreview.jsx`, `src/wedi.js`, `src/wediadapter.js`, `src/usewedicatalog.js`, `src/wedifixture.js`, `src/pricebook.js`, `src/orderbook.js` — none touched.

## Concerns

None. The diff is a clean, minimal four-part change matching the brief exactly; the full test suite, build, and lint all came back as expected with no regressions. Per the outer task instructions, I did not run the dev server or attempt browser verification — that step is explicitly reserved for the controller.
