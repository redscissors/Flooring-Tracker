# SDD ledger — plan: docs/superpowers/plans/2026-09-01-wedi-stock-book.md

Spec: docs/superpowers/specs/2026-09-01-wedi-stock-book-design.md (read, reachable)
Branch: wedi-stock-book-118 (off main @ synced). Plan commit: d7baa32.
Verified baseline before any task: 1211 pass, 0 fail (`node --test src/*.test.js`).

## Pre-flight conflict scan

### Cross-task rows (every pair sharing a file or interface)

| Tasks | Produced → Consumed | Finding |
|---|---|---|
| 1 → 2 | `src/wediadapter.test.js` (T1 creates, T2 appends) | T2's appended block opens with an `import`. Legal — ESM imports hoist — but unusual placement. **Ruling below (R3).** |
| 1 → 2, 4 | `FIXTURE_ROWS` (152 persisted rows) | Names and shape agree across all three tasks. Clean. |
| 2 → 4 | `adaptBookRows`, `descOf` | Agree. T4 is the proving ground for `descOf`; T2's own descOf tests are weaker by design. Clean. |
| 2 → 5 | `adaptBookRows` | Agrees. Clean. |
| 3 → 4 | `setStockSource` / `clearStockSource` | Agree. Clean. |
| 3 → 5 | `setStockSource` / `clearStockSource` | Agree. Clean. |
| 3 → 6 | `stockSourceIsBook` | **Conflict.** T3 declared it "for the UI marker (Task 6)", but T6 uses the hook's `onBook` and never calls it. **Ruling R1.** |
| 5 → 6 | `useWediCatalog` → `{cat, catReady, onBook}` | Agree. Clean. |
| 3 → 6 | `wedi.js` import list in WediConfigurator | T6 drops only `catalog`; verified `catalog()` has exactly one call site (`:1304`). `item`/`group`/`pans` stay and follow the installed source. Clean. |

### Per-task self-agreement rows

| Task | Finding |
|---|---|
| 1 | Generator output ↔ fixture tests ↔ expected stderr counts all agree (152/2 warnings, verified by running the real pipeline). Clean. |
| 2 | Tests ↔ implementation agree; every asserted value measured against the real workbook. Clean. |
| 3 | Tests ↔ code agree. Files-to-modify line numbers match the verified `wedi.js`. Clean. |
| 4 | **Defect.** `kitFor("US3000039", {})` — `US3000039` is a *curb*; `kitFor(panKey, opts)` takes a pan. Both sides would be null and the deep-equal would pass vacuously — a test asserting nothing, which the review rubric treats as a defect. `solve({w:60,d:38,drain:"center"})` was also unverified. **Ruling R2.** |
| 5 | `setStockSource` called inside `useMemo` is a side effect in a memo. Idempotent, and a discarded memo re-runs, so source and `cat` cannot desync. Accepted; noted for the reviewer. Clean. |
| 6 | **Defect.** Step 2 contradicted itself: "immediately after the hook call" vs "after all hooks". Four hooks run after the seam (`:1308/:1317/:1344/:1347`), so an early return at `:1306` throws "Rendered fewer hooks than expected". **Ruling R4.** |
| 7 | Docs only; no code interface. Clean. |

### Rulings

- **R1 — `stockSourceIsBook` stays, its description was wrong.** Keep the export: it is how Task 3's tests assert installer state without reaching into module internals, and the seam's tests are the contract for the seam. Corrected Task 3's Interfaces to say it is a test affordance and that Task 6 deliberately uses the reactive `onBook` instead. *Cost if wrong:* one exported function used only by tests — a reviewer may still flag it as YAGNI, and the answer is this ledger entry.
- **R2 — Task 4's engine-invariance test uses verified keys.** Replaced with `kitFor("US9100004")` and `solve({w:36,d:60,curb:"curbed",drain:"any"})`, both copied verbatim from the pinned tests at `wedi.test.js:498`, plus two guard assertions so the test cannot pass vacuously. *Cost if wrong:* the invariance check covers one pan family rather than several; the equivalence test in the same file is the broader net.
- **R3 — T2's appended import is acceptable.** ESM hoists it. Implementer may move it to the top of the file for readability; not a requirement. *Cost if wrong:* cosmetic only.
- **R4 — Task 6's readiness guard moves to just before the final JSX return** (`WediConfigurator.jsx:2426`), with an explicit instruction to verify no `use*(` call sits between the guard and the end of the component. *Cost if wrong:* a not-ready render throws a React hook-order error on open — loud and immediate, not silent.

Plan amended for R1, R2, R4 before Task 1 dispatch (the task brief is extracted from the plan text, so an unamended plan would hand the implementer the defects).

## Progress

Task 1: dispatched (implementer sonnet, BASE 4e4be4c) — DONE, commit 726348a, suite 1213/0,
        generator stderr matched the checksum on first run with no iteration.
Task 1: task review dispatched (sonnet) over 4e4be4c..726348a.
Task 1: minor (deferred): wediadapter.test.js vendorSkus assertion does not exercise normFits at
        test time — parseMapped already normalized before the fixture was written, so normBookItem's
        second pass is idempotent. Test-depth limit inherent to the plan's mandated code, not an
        implementation defect. Final review should triage whether Task 2 needs adapter-level coverage.
Task 1: complete (commits 4e4be4c..726348a, review clean — spec compliant, quality approved)
Task 2: dispatched (implementer sonnet, BASE 726348a).
Task 2: DONE, commit 24b0639, suite 1220/0, RED confirmed (module-not-found) before GREEN.
        Implementer concern: descOf restores size+thickness but not sfPerUnit into desc.
        Anticipated — the plan's Task 4 Step 3 lists sfPerUnit re-append as a likely adjustment.
Task 2: task review dispatched (sonnet) over 726348a..24b0639.
Task 2: review verdict — spec compliant, quality Approved, 1 Important + 1 Minor.
Task 2: Ruling: descOf's missing sfPerUnit restoration — FIX NOW, do not defer to Task 4.
        The plan scoped descOf's full proof to Task 4, so this finding is plan-adjacent and mine
        to rule on. Fixing now because (a) the skill routes Important findings into the loop
        regardless of an "Approved" verdict, (b) `sf` is in Task 4's DERIVED comparison list so
        Task 4 fails on it with certainty, and (c) isolating it here keeps it out of Task 4's
        descOf tuning loop where it would be one failure among several.
        Controller measurement corrected the review's scope: 4 fixture rows carry sfPerUnit
        (28954/322, 1518096/104, 1518097/106, 29542/53), not the single row the review cited.
        Cost if wrong: one extra test and a slightly longer descOf; the re-append could in
        principle perturb dims() parsing, which is why the fix message requires checking the
        four rows' dimensions are unchanged, and Task 4's 151-row equality is the backstop.
Task 2: minor (deferred): wediadapter.js:33-34 comment names 47815 and 47733 as rows repeating
        the shop code in a vendor column, but only 47815 is exercised by a test.
Task 2: fix round 1/5 dispatched (resumed original implementer).
Task 2: fix round 1/5 (1 addressed, 0 open — descOf now restores sfPerUnit; re-reviewer
        independently confirmed dims() unperturbed on all 4 affected rows + 2 controls;
        commits 24b0639..4e984c8)
Task 2: minor (deferred): added descOf test covers only SKU 28954 and only the sf-regex match,
        with no persisted dims()-safety assertion. Low priority — Task 4's 151-row equality
        compares w/d/t/sf for every row, which is strictly stronger automated protection.
Task 2: complete (commits 726348a..4e984c8, review clean after 1 fix round)
Task 3: Ruling: R5 — the plan's seam test asserted item("US5000009") === null after installing a
        book. Wrong: US5000009 is ALSO a WEDI_SO pricelist row (wedi.js:3571, "wedi Washer Master
        Pack"), so buildCatalog still emits it as a special-order entry and the assertion fails.
        Amended to probe two codes: US5000032 (one of the 46 stock rows with no pricelist twin)
        for the null case, and US5000009 asserting .stock === false. The amended test proves more
        than the original intended — that the swap leaves the pricelist half untouched.
        Cost if wrong: none identified; both probes were verified against the real tables.
Task 3: dispatched (implementer sonnet, BASE 809dc59).
Task 3: DONE, commit c174dc6, suite 1223/0 (wedi.test.js 45/45: 43 pinned + 2 new).
        Controller verified independently: 0 deletions in wedi.test.js (additions only, pinned
        expectations untouched); wedi.js diff is exactly the planned footprint — STOCK_SRC decl,
        one `const rows = STOCK_SRC || WEDI_STOCK`, both WEDI_STOCK.forEach sites swapped, three
        new exports. 34 insertions / 2 deletions.
Task 3: task review dispatched (sonnet) over 809dc59..c174dc6.
Task 3: review verdict — spec compliant, quality Approved, 0 Critical/Important.
        Reviewer grep-verified both WEDI_STOCK.forEach sites converted and that no other function
        in wedi.js reads CAT/INDEX/WEDI_STOCK directly — the seam is complete, not half-swapped.
Task 3: minor (deferred, CARRY TO TASK 5): setStockSource([]) silently behaves as
        clearStockSource(), so an empty-but-successful book fetch is indistinguishable from
        "no book" at the wedi.js layer. Must be distinguished UPSTREAM in the hook.
        Note: the planned Task 5 hook already does this — hasBook comes from targetIds, and
        onBook = hasBook && catReady && bookRows.length, so an empty book falls back AND shows
        the visible marker, which matches the spec ("until the book has rows, the engine runs
        on WEDI_STOCK"). Carrying the pointer into Task 5's dispatch anyway.
Task 3: complete (commits 809dc59..c174dc6, review clean)
Task 4: dispatched (implementer OPUS — the plan expects real iteration here, BASE c174dc6).
Task 4: implementer returned DONE_WITH_CONCERNS — tests 1 and 2 PASS (all 151 stock entries
        reproduce the transcribed catalog across every DERIVED field; 0 in misc), test 3 FAILS.
        4 of 151 entries failed on the first run; 4 descOf changes over 3 iterations fixed them.
        Implementer correctly refused to weaken test 3 and escalated instead.
Task 4: Ruling: R6 — test 3's failure is a PLAN defect of mine, not an implementation failure.
        Test 3 deep-equals whole kitFor/solve trees, which carry catalog entries, which carry
        `desc` — the single field the plan excludes from DERIVED as not byte-reproducible. I
        applied that exclusion to test 1 and forgot it in test 3.
        VERIFIED INDEPENDENTLY before ruling (scratchpad verify_t3.mjs, deep leaf-diff of both
        trees): exactly 3 differing leaves, 100% of them `desc`, on 2 entries —
        kitFor.lines.7.item.desc (US5000033 sealing collar, lifted 1/2" reinserted at front) and
        solve.2.pieces.1 / solve.2.floorLines.1 (073783528, 24"x 48" canonicalised to 24x48).
        Zero price, quantity, key or geometry differences anywhere in either tree.
        Fix: strip `desc` recursively from both trees, compare everything else deeply. That is
        the plan's own exclusion applied consistently, and it leaves the test's power intact —
        it would still catch any price/quantity/geometry movement.
        Cost if wrong: the engine-invariance test stops guarding `desc` on entry objects. `desc`
        is a parse input, not a quoted output, and test 1 already pins every field derived FROM
        it (w/d/t/sf/len/group/sub/name/sizeText) for all 151 rows.
Task 4: fix round 1/5 dispatched (resumed original implementer, plan amended first).
Task 4: BOOKKEEPING CORRECTION — the "fix round 1/5" line above is mislabelled. Task 4 had not
        been reviewed yet, so that exchange was DONE_WITH_CONCERNS concern-handling BEFORE first
        review (per skill: correctness concerns are addressed before review), not a fix round in
        the review loop. Task 4's fix-round counter is therefore still at 0/5.
Task 4: DONE after concern-handling. Commits fbd28d5 (test + 4 descOf fixes) and 8cbd762
        (test 3 desc strip). Suite 1226/0. Implementer mutation-probed the stripped test: cost
        moves, retail moves, unit EA->BX and a dropped row are all caught; 3 probes missed with
        a claimed no-op explanation (all 17 entries reachable in the engine trees have pricelist
        twins, so makeEntry resolves dims from soRow before reading the stock desc). That claim
        is handed to the reviewer to verify rather than accepted.
Task 4: task review dispatched (OPUS — descOf's dangling-hyphen and non-integer-marks heuristics
        need real scrutiny for overfit) over c174dc6..8cbd762.
Task 4: review verdict — spec compliant, quality Approved, 1 Important + 8 Minor + 1 warning item.
Task 4: Ruling: R7 — RATIFY the unauthorized adapter->engine import. wediadapter.js now does
        `import { inch } from "./wedi.js"` plus two private helpers (spell, sizeOf), which the
        brief did not explicitly authorize. Ratified because schluteradapter.js:8 already imports
        classify from schluter.js — adapter->engine import is the established pattern in this
        codebase — the reviewer confirmed no import cycle, and reusing the engine's own inch()
        beats re-deriving a fraction vocabulary in a second file. Lazy-chunk discipline is
        unaffected: wedi.js was already lazy-only (see the wediquery boot-half test).
        Cost if wrong: wediadapter.js can never be imported from the boot path — already true
        before this change, and Task 5's hook is documented LAZY-CHUNK-ONLY for the same reason.
Task 4: Ruling: R8 — FIX Important #1 (dangling-hyphen rule) now rather than defer. descOf is
        production code that runs on FUTURE exports, which is the entire purpose of the book, so
        a shape-only heuristic that can silently relocate a real board thickness is geometry
        corruption on rows nobody has inspected. The reviewer's counter-case is sound: THICK_FRAC_RE
        taking the first fraction of the ORIGINAL string does not prove the first dangling hyphen
        in the RESIDUE is the removal site. Fix is small — bail to lead-thickness when candidates
        are ambiguous. Folding in Minor #4's latent `$`-in-replacement bug since it is the same
        three lines, and Minor #6's synthetic heuristic tests since the new bail path needs
        covering tests anyway. Cost if wrong: slightly more conservative reconstruction on an
        ambiguous future row — which is the old, known behavior, not a new failure mode.
Task 4: minor (deferred): #2 sizeOf marks both values when either is non-integer (4x8.5 -> 4"x8-1/2").
Task 4: minor (deferred): #3 spell() re-quantizes non-dyadic decimals to the nearest 64th.
Task 4: minor (deferred): #5 test 3 has no coverage of any desc-derived field; that coverage comes
        from test 1, which pins name/finish/len/drain/channel/sf/w/d/t/sizeText across all 151
        including the 46 twin-less rows where descOf is load-bearing. Record it that way — the
        implementer's "twins make it a no-op" theorem is over-broad.
Task 4: minor (deferred): #7 stockHalf() comparator returns 1 for equal keys (plan-mandated).
Task 4: minor (deferred): #8 stripDesc re-plainifies objects, neutralizing deepStrictEqual's
        prototype check inside the trees. Inert on today's plain-data trees.
Task 4: fix round 1/5 dispatched (resumed original implementer) — Important #1 + Minor #4 + #6.
Task 4: fix round 1/5 (3 addressed, 0 open — hyphen bail on ambiguity, $-in-replacement fixed,
        4 heuristic unit tests added; commits 8cbd762..f6d239e). Re-reviewer hand-traced the bail
        and confirmed the new tests discriminate against the pre-fix rule rather than trusting
        the implementer's RED transcript. Structural guarantee recorded: 0 of 151 fixture rows
        have 2+ dangling-hyphen candidates, so the bail cannot have altered a pinned entry.
Task 4: complete (commits c174dc6..f6d239e, review clean after 1 fix round). Suite 1231/0.
        ACCEPTANCE PROPERTY PROVEN: all 151 stock entries reproduce the transcribed catalog
        across all 19 DERIVED fields; 0 rows in misc; engine trees identical modulo desc.
Task 5: dispatched (implementer sonnet, BASE f6d239e).
Task 5: DONE, commit 3166e2e, suite 1232/0. Flagged React-import-under-node:test risk did not
        materialize. Controller verified scope: only usewedicatalog.js + its test, 0 out-of-scope
        files. Gate reads as designed — no book -> bookRows=[] -> catReady true, onBook false;
        book with no loader or a failed fetch -> bookRows=null -> catReady false (wait);
        book with rows -> setStockSource(adaptBookRows(...)), onBook true.
Task 5: task review dispatched (OPUS — this is the safety gate the owner asked for; a hole in it
        is the silent stale-pricing failure) over f6d239e..3166e2e, with five explicit attack
        questions on interleavings, partial fetch failure, targetIds churn, and side-effect-in-memo.
Task 5: review verdict — NEEDS FIXES. 2 Critical + 2 Important + 5 Minor. Both Criticals are
        defects in MY plan's hook code, transcribed faithfully by the implementer.
Task 5: Ruling: R9 — APPROVE deviation from the plan for both Criticals; plan amended first so
        the corrected design is the record, not a patch on top of a wrong one.
        C1: setBookRows([]) on the no-book branch is indistinguishable from "empty book loaded",
        so when books hydrate late (the effect's own comment calls this ordinary) catReady goes
        true and the hook serves WEDI_STOCK while a real book with rows is mid-fetch. Fix: rows
        travel WITH the id-set they were fetched for; the gate requires loadedIds === targetIds.
        C2: onBook keyed on pre-adapter bookRows.length while the install passes post-adapter
        adaptBookRows(...). A mis-mapped book adapts to [], setStockSource([]) collapses to the
        fallback, and the UI flies an on-the-book marker over the transcribed table — a false
        positive, worse than no marker. Fix: adapt once, gate on the adapted length.
        Both are exactly the failure this task exists to prevent. Cost if wrong: the gate is
        more conservative — it waits in ambiguous states rather than quoting.
Task 5: Ruling: R10 — FIX Important #3 (/wedi/i matches "Swedish"). Real and compounding with
        C2: a "Swedish oak" stock book adapts to zero rows. \b-anchored, negative case tested.
Task 5: Ruling: R11 — PARK Important #4 (setStockSource inside useMemo; an abandoned concurrent
        render mutates module state the committed tree won't re-establish). Real, and the
        reviewer calls it latent rather than routine. Not fixing now because the correct fix
        needs either a new wedi.js getter (Task 3 is closed and the seam is reviewed) or a
        version-counter that risks a STALE FIRST PAINT — a regression in the very property being
        protected. Task 6 gates render on catReady, which narrows the window further. Carried to
        the final whole-branch review for triage against the whole diff.
        Cost if wrong: under concurrent-render abandonment, item()/group() could momentarily read
        a source `cat` does not reflect. No user-visible path to it has been demonstrated.
Task 5: Ruling: R12 — FOLD IN Minors #5 (stockRows as a needless memo dep forcing full catalog
        rebuilds), #6 (loadBookItems missing from deps wedges the hook if it arrives late),
        #7 (no terminal .catch — a sync throw or an undefined list escapes), and #9 (extract
        foldBookLists/gateOf as pure functions and pin the transition table). #9 is the highest
        value item after the Criticals: the reviewer notes that READING the hook did not catch
        either Critical, and a transition-table test would have.
Task 5: minor (deferred): #8 no error signal in the return shape — a permanently failed fetch is
        indistinguishable from "still loading", so the user-visible outcome of a dropped
        connection is an eternal unexplained spinner. Needs UI design; Task 6/final review.
Task 5: fix round 1/5 dispatched (resumed original implementer, plan amended first).
Task 5: fix commit 703a8bd, suite 1234/0. Implementer confirmed both Critical regression cases
        genuinely fail under the old gate arithmetic before trusting them as pins. Controller
        verified scope: 0 out-of-scope files; gateOf/foldBookLists exported; \bwedi\b anchored;
        loadedIds freshness check present; adapted computed before the gate.
Task 5: scoped re-review dispatched (sonnet) over 3166e2e..703a8bd, with an explicit instruction
        to hand-trace the transition table and independently confirm the old arithmetic fails
        both regressions.
Task 5: fix round 1/5 (4 addressed, 0 open; commits 3166e2e..703a8bd). Re-reviewer hand-traced
        all three gate states and all three regression cases, independently confirming each
        diverges under the OLD arithmetic: A.1 {true,false}->{false,false}, A.2 {true,true}->
        {false,false}, B {true,true}->{true,false}. Parked useMemo finding confirmed untouched.
Task 5: minor (deferred, FOR FINAL REVIEW — same family as the parked useMemo finding):
        the cat memo's `if (!catReady) return []` branch neither installs nor clears, so when a
        book switch drives catReady true->false the module-level wedi.js source still holds the
        PREVIOUS book's rows while this hook reports []. Shared with comparekit.js (Schluter
        popup's Compare tab), so a stale install is readable elsewhere during the wait window.
        Byte-identical between old and new code, so not new breakage. NOT fixed here because the
        obvious patch (clear on !catReady) trades a stale-book read for a stale-TABLE read, which
        is the failure the gate exists to prevent — it needs design judgment against the whole
        diff, which is the final review's job.
Task 5: complete (commits f6d239e..703a8bd, review clean after 1 fix round). Suite 1234/0.
Task 6: dispatched (implementer sonnet, BASE 703a8bd). Browser verification retained by the
        controller — the subagent does code, tests, build and lint only.
Task 6: DONE, commit 0ef86dd, suite 1234/0, build exit 0, lint 7 pre-existing / 0 new.
        Controller verified the high-risk edit mechanically: guard sits at WediConfigurator.jsx:2432
        with ZERO use*( calls after it (the hook-order hazard is closed); `catalog` removed from
        the wedi.js import while item/group/pans remain; marker at :2410.
Task 6: BROWSER VERIFICATION (controller-owned, done): started the dev server, loaded
        wedi-preview.html. No console errors — the guard did not break hook order. Popup renders
        fully with prices. Browse caption reads "151 stock · 118 SO · transcribed table", i.e.
        counts identical to the pinned baseline with the fallback now VISIBLE. The harness passes
        no wedi stock book, so this exercises exactly the no-book fallback state. Screenshot taken.
Task 6: task review dispatched (sonnet) over 703a8bd..0ef86dd.
Task 6: review verdict — spec compliant, quality Approved, 0 Critical/Important.
        Reviewer independently re-verified hook-order stability (scanned :1305-2432 for any
        top-level early return; the guard at :2432 is the only one) rather than trusting the
        implementer's grep, and confirmed nothing between the hook call and the guard indexes
        into cat, so the not-ready [] is safe by construction.
Task 6: minor (deferred): a not-ready render still evaluates browseTab/compareTab before the
        guard discards them. Inherent to the guard-before-final-return strategy the hook-order
        requirement forces. Bounded (filtering an empty array), not a functional risk.
Task 6: complete (commits 703a8bd..0ef86dd, review clean)
Task 7: dispatched (implementer sonnet, BASE 0ef86dd) — docs reconciliation, final task.
Task 7: DONE_WITH_CONCERNS, commit 5a7e1b1 (spec, new ADR 0036, ADR 0032, ADR README index).
        Suite unchanged 1234/0; 0 files under src/ touched. ADR 0036 matches 0032's house format.
Task 7: Ruling: R13 — APPROVE the implementer's two self-directed deviations. (a) My brief cited
        wedi.js:4060-4071 and :4331; those drifted when Task 3 added lines. Verifying and using
        4042-4072 / 4339 is correct — doc citations pointing at the wrong lines are worse than
        none. (b) Adding an ADR README index row was not in the brief's file list, but an index
        that omits the ADR is a broken index; that is completing the task, not exceeding it.
Task 7: Ruling: R14 — AUTHORIZE the spec status change (implementer's concern 3, raised and
        correctly left unactioned). The header said "Draft, awaiting owner review" while ADR 0036
        beside it says Accepted and the code has shipped and been reviewed. Changing it to
        "Implemented on branch wedi-stock-book-118; open question 3 still with the owner" —
        deliberately NOT "accepted"/"approved", which would claim an owner judgment nobody has
        made. Scope line also corrected: it undersold the change by omitting usewedicatalog.js
        and the WediConfigurator wiring. Open question 3 (fallback lifetime) stays open.
        Cost if wrong: a status line the owner may want reworded; trivially reversible.
Task 7: concern-handling before first review dispatched (resumed implementer).
Task 7: concern-handling complete, commit 4bc0b1e. Spec header now reads "Implemented on branch
        wedi-stock-book-118; open question 3 (fallback lifetime) still with the owner" and the
        Scope line names usewedicatalog.js and the WediConfigurator wiring. Suite 1234/0.
Task 7: task review dispatched (sonnet) over 0ef86dd..4bc0b1e.
Task 7: review verdict — NEEDS FIXES. 1 Critical (wrong number in the spec), 1 Important, 1 Minor.
        Everything structural (ADR placement, status wording, open-question handling, corrected
        line citations) verified correct, including the implementer's own mid-task self-correction.
Task 7: Ruling: R15 — the Critical is HALF right, and the fix is bigger than the reviewer's.
        CONTROLLER RE-MEASURED both quantities directly (scratchpad desc_counts.mjs, against the
        committed fixture and the real adapter):
          (a) RAW importer description vs table desc  -> 105 / 151 differ
          (b) POST-descOf reconstruction vs table desc ->  25 / 151 differ
        BOTH numbers are real and measure DIFFERENT things. 105 is the damage the importer does,
        and is why descOf exists at all; 25 is what survives reconstruction, and is why desc is
        excluded from the acceptance test. The spec collapsed them into one claim, which IS
        misleading — the reviewer was right about that. It was WRONG about provenance: 105 was
        measured by the controller during design, not conflated with task-4-report's "105 stock
        rows with a pricelist twin". The two being equal is a coincidence.
        Fix: state both numbers with what each one means, rather than swapping 105 for 25.
        Cost if wrong: none identified; both figures re-measured from the committed fixture.
Task 7: Ruling: R16 — the "84" figure (flags-off scenario) is a real controller measurement from
        this session but is NOT reproducible from anything in the repo, since nothing reruns the
        import with leadWidthSize/sfFromDescription disabled. Keeping the claim but attributing it
        as a one-off design-time measurement, so a future reader knows not to expect a test to
        confirm it. Cost if wrong: a doc sentence a reader cannot re-derive; attribution makes
        that explicit rather than implying a checkable fact.
Task 7: NOTE for the final review — the implementer's report (task-7-report.md:268-271) certified
        the 105/151 figure as "checked against the repo" when it had not been re-derived. The
        number turned out defensible on other grounds, but the self-review's verification claims
        should not be taken at face value for adjacent numbers.
Task 7: minor (deferred): answered question 2 still sits under the "Still open for the owner"
        heading rather than moving to "Answered" — the brief instructed it that way; reads oddly.
Task 7: fix round 1/5 dispatched (resumed original implementer).
Task 7: fix round 1/5 (2 addressed, 1 NEW opened — the $0-rows contradiction the controller
        spotted and asked the re-reviewer to adjudicate; confirmed genuine). Commit b7fb429.
        Both original findings fully addressed: the paragraph now carries 105 (raw) and 25
        (post-descOf) with what each measures, names the pricelist-twin coincidence as unrelated,
        and attributes 84 as a design-time-only measurement. The implementer also retracted and
        replaced its own inaccurate verification certification with a three-way breakdown of what
        it re-derived vs carried — the honest correction, not a restatement.
Task 7: REMAINING FINDING (in scope): design.md:63-68 still glosses 1518104/1518105 as "live $0
        rows ... land as $0 lines", contradicting the same document's Answered section at :247,
        which correctly records them as samples at $0 COST and $100 RETAIL. "Land as $0 lines" is
        simply wrong for a $100-retail row. Passage 1 was never touched by any of the seven tasks.
Task 7: fix round 2/5 dispatched (resumed original implementer).
Task 7: fix round 2 landed (commit db69b78) — the $0-rows bullet now agrees with the Answered
        section. But it introduced a NEW overclaim the controller caught on inspection:
        "Confirmed with the owner". Audited every owner-attribution added on this branch:
          TRUE  — 29WEDIT out of scope (owner said exactly this in session)
          TRUE  — "the owner has since asked to move wedi the same way" (pre-existing spec text)
          FAIR  — ADR 0036 "Accepted" (the owner asked for the move and chose the injection design)
          FALSE — "Confirmed with the owner" for the 1518104/1518105 samples
          FALSE-ish — "Answered (2026-09-01)" under "Still open for the OWNER", same rows
        The samples question was resolved by CONTROLLER MEASUREMENT of the workbook and the
        transcribed table. The owner was told the finding and never responded to it. Attributing
        it to them is the same class of error as writing "Accepted" on the spec header, which I
        ruled against earlier — and it matters more here, because the owner reads this document
        and would be reading back a conclusion presented as their own.
Task 7: Ruling: R17 — reattribute both to measurement. The factual question ("genuinely $0 or a
        sheet artifact?") is answered by the data and needs no owner judgment, so it can stay
        resolved — it just has to say HOW it was resolved. Cost if wrong: none; strictly more
        accurate, and it leaves the owner free to disagree with a reading they never made.
Task 7: fix round 3/5 dispatched (resumed original implementer).
Task 7: fix round 2/5 and 3/5 verified together (all addressed, 0 open; commits b7fb429..9af8095).
        Re-reviewer confirmed no daylight remains between the $0 bullet and the open-questions
        entry, audited every remaining owner attribution in the document as accurate, and
        confirmed question 3 (fallback lifetime) is still genuinely open.
Task 7: complete (commits 0ef86dd..9af8095, review clean after 3 fix rounds)

=== ALL SEVEN TASKS COMPLETE ===
Suite 1234 pass / 0 fail (from an 1211 baseline). Build exit 0. Lint 7 pre-existing, 0 new.
Branch: 9125b923..9af8095, 20 commits, 15 files, +2027/-29.

=== FINAL WHOLE-BRANCH REVIEW (opus) — VERDICT: NOT READY ===
1 Critical, 5 Important, 4 Minor, plus triage of the 10 known findings.
CONTROLLER VERIFIED THE THREE MERGE-BLOCKERS INDEPENDENTLY BEFORE ACTING:
  C1 CONFIRMED — useWediCatalog is at WediConfigurator.jsx:1305, but `build` (:869, calls kitFor)
     and `kitTotals` (:1290, calls group/pans) run BEFORE it and their dep arrays contain no
     catalog source. `return null` does not unmount, so those memos cache values computed from
     WEDI_STOCK on the not-ready render and never recompute once the book installs. Result: Kits
     tab + build column price from the transcribed table while onBook is true and the marker is
     SUPPRESSED. Invisible today only because book and table agree to the cent.
  I2 CONFIRMED — grep: SchluterConfigurator has 0 references to useWediCatalog, yet its Compare
     tab reaches comparekit.js -> wedi.js catalog(), and CompareTab's onQuoteOptions is wired to
     addCompareOptions (App.jsx:2811). Wedi prices that depend on session history can be written
     into a project. ADR 0036 files this as a FUTURE hazard; it is present.
  I4 CONFIRMED — grep: "bookId" appears 0 times in wediadapter.js and 0 times in wedi.js. ADR
     0036's first Consequence claims stocked wedi lines gain a bookId and move to tier 1 of
     isSpecialOrder. Both halves are false.
  I5 CONFIRMED — src/CLAUDE.md has 0 entries for wediadapter/usewedicatalog/wedifixture vs 9 for
     the Schluter counterparts, and nothing records that wedi's catalog is now installable state.
Ruling: R18 — ONE fix wave (per the skill), scoped to correctness + false documentation:
     C1, known-7 (subsumed), known-1 (the reviewer showed its blocker was false: stockSourceIsBook
     IS the getter), I1, I2, I3's CRASH GUARDS only, I4, I5, M1, M2, M3, and known-4's round-trip
     guard. DEFERRED TO THE OWNER, not fixed: I3's plausibility floor (refuse to install a book
     missing SKU.* constants) — that is a behavior addition the owner should weigh, not a defect
     fix I should take unilaterally; plus known findings 3, 5, 6, 9, 10 (test/doc polish).
FIX WAVE: agent landed 56bde1f (C1 + findings 7, 1, I1, M1) then STOPPED when the process exited.
        Controller finished inline: b4e00a0 (I2), 089c717 (I3 guards), 83a9ab3 (I4/I5/M3/known-4).
Ruling: R19 — I3's finding was HALF WRONG and the report says so. Measured: 22 of the 24 SKU.*
        constants also live in WEDI_SO, so item() resolves them as SO entries when the book drops
        them; the only two stock-only codes (sdrySeal, sdrySealTrowel) already go through the
        guarded push(). The reviewer reasoned from code shape without checking whether those SKUs
        could actually null. Guard landed anyway because 8b retires WEDI_SO and then it IS
        reachable; the test pins what is true rather than staging an unreachable crash.
Ruling: R20 — writing M3's test corrected my own framing: usOf's no-US-code fallback is
        POSITIONAL, and its stability is inherited from normFits' sort, not intrinsic. Pinned as
        such. Cost if wrong: none — strictly more accurate than the claim it replaced.
Verification: 1238 pass / 0 fail; build exit 0; lint 7 pre-existing (verified SAME seven —
        CORNER_CUT is unused on main too, so the split orphaned nothing). Browser: wedi popup
        renders post-split, no console errors, marker intact; Schluter Compare tab renders both
        columns priced, no errors, wedi column reaching the fallback THROUGH the gate.
STILL OPEN: the scoped re-review of the fix wave (the skill's one re-review) has NOT been run —
        the user stopped the prior agent, so no new one launched without an explicit ask.
FIX-WAVE RE-REVIEW (fable 5.1) — VERDICT: all findings addressed, 0 new Critical/Important.
        Both controller revisions independently REPRODUCED and upheld:
        A (I3) sound — a script installing a one-row book confirmed 22/24 constants survive via
          WEDI_SO as stock:false entries, only sdrySeal/sdrySealTrowel vanish, and both go
          through the guarded push(). Root cause named: buildCatalog emits orphaned SO rows.
          QUALIFIER accepted: the guard's false branch is exercised by nothing and cannot be
          without a seam into WEDI_SO — it is untested code landed for 8b.
        B (M3) correct — usOf's fallback is positional; 0 of 152 rows have two non-US candidates,
          7 use the fallback, 0 have unsorted vendorSkus.
        C1 split verified structurally: one unconditional hook in the wrapper, body is a distinct
          component so React mounts it fresh, no body memo can observe an uninstalled source,
          props threading intact.
Task 7-class defect FIXED (a4c1d0e): CLAUDE.md's usOf note contradicted the M3 test in the SAME
        commit — the exact class Task 7 existed to remove. Reworded to match the pinned truth.
RESIDUAL MINORS FOR THE OWNER (not fixed, no second fix wave per the skill):
  1. C1's split means losing readiness mid-session UNMOUNTS the body, discarding tab/pan/basket/
     custom-room state. Pre-fix that window blanked the popup but PRESERVED state. Brief, and
     seed-restored in the open-layer-restore case, but it is a real behavioural trade-off the
     Critical fix introduced.
  2. The re-assert effect reads stockSourceIsBook(), a boolean — it cannot tell book A from book
     B, so an abandoned render that installed a DIFFERENT adapted array leaves the committed tree
     satisfied. Fully closing known finding 1 needs an identity getter.
  3. wedi.js:5039 (panel) and :5148 (cover -> coverFrameFor) dereference item(SKU.*) with the same
     WEDI_SO-only backstop as the consumables — they become reachable at 8b and should ride the
     same plausibility-floor decision.
