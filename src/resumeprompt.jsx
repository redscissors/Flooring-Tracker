// The Compare set's resume prompt (ticket 158 Phase 4, ADR 0052): a fresh
// wedi/Schluter start on a shower whose set already keeps a build of that
// brand offers to pick it back up. Presentation only — the popup decides when
// it shows and what a pick does.
import { useEscClose } from "./widgets.jsx";
import { roomLabel, savedAgo } from "./compareset.js";

const BRAND = { wedi: "wedi", schluter: "Schluter" };
const SYS_NAME = {
  "wedi:board": "Building Panel", "wedi:membrane": "S-DRY membrane",
  "schluter:board": "KERDI-BOARD", "schluter:membrane": "KERDI membrane",
};

const fm = (n) => "$" + (+n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ResumePrompt({ brand, choices, priceOf, onPick, onNew }) {
  useEscClose(true, onNew);
  return (
    <div className="absolute inset-0 z-[58] flex items-center justify-center p-6" style={{ background: "rgba(20,15,10,.45)" }}
      onClick={onNew} data-resume>
      <div className="w-full max-w-[480px] rounded-xl border overflow-hidden shadow-2xl"
        style={{ background: "var(--ft-cream)", borderColor: "var(--ft-border-strong)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b text-[14px] font-extrabold" style={{ borderColor: "var(--ft-border-strong)" }}>
          Pick up where you left off?
        </div>
        <div className="px-4 py-3 text-[12.5px] leading-[1.5]" style={{ background: "var(--ft-card)", color: "var(--ft-muted)" }}>
          This shower has {choices.length === 1 ? "a " + BRAND[brand] + " build" : BRAND[brand] + " builds"} kept in its compare set.
          {choices.map(({ key, entry }) => {
            const price = priceOf ? priceOf(entry) : null;
            return (
              <button key={key} type="button" data-resume-pick={key} onClick={() => onPick(entry)}
                className="mt-2 w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left font-bold hover:bg-[var(--ft-hover)]"
                style={{ borderColor: "var(--ft-border-strong)", color: "var(--ft-text)", background: "var(--ft-card)" }}>
                <span className="min-w-0">
                  {BRAND[brand]} · {SYS_NAME[key]}
                  <small className="block font-semibold text-[11px]" style={{ color: "var(--ft-faint)" }}>
                    {entry.room ? roomLabel(entry.room) + "″ · " : ""}saved {savedAgo(entry.savedAt)}{entry.savedBy ? " by " + entry.savedBy : ""}
                  </small>
                </span>
                {price != null && <span className="ml-auto font-extrabold tabular-nums">{fm(price)}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 px-4 py-2.5 border-t" style={{ borderColor: "var(--ft-border-strong)", background: "var(--ft-sand)" }}>
          <button type="button" data-resume-new onClick={onNew}
            className="rounded-md border px-3 py-1.5 text-[11.5px] font-extrabold"
            style={{ borderColor: "var(--ft-border-strong)", background: "var(--ft-card)", color: "var(--ft-text)" }}>Start new</button>
        </div>
      </div>
    </div>
  );
}
