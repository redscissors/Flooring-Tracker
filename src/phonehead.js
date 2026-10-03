// The phone header's derived text (spec 2026-10-02, phone Clean layout).
import { money } from "./model.js";

export function phoneTotal(grandTotal, optionCount) {
  if (optionCount > 0) return { text: `${optionCount} option${optionCount === 1 ? "" : "s"}`, options: true };
  return { text: money(grandTotal), options: false };
}

// The desktop Clean rule: the job site when set, else the customer's address.
export function shownAddress(sel, cust) {
  const own = (sel?.address || "").trim();
  if (own) return { text: own, own: true };
  return { text: (cust?.address || "").trim(), own: false };
}
