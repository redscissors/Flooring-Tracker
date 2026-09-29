// Pure half of the Compare print sheet (compareprint.jsx), split out so
// node --test can import it without JSX.
import { CELL_KEYS } from "./compareset.js";
import { TIER_LONG } from "./uiconst.js";

export const printColumns = (cells, checked, missOf) => cells
  .filter((c) => checked.includes(c.key) && !missOf(c))
  .sort((a, b) => CELL_KEYS.indexOf(a.key) - CELL_KEYS.indexOf(b.key));

export const tierLabel = (tier) => (tier && tier !== "retail" && TIER_LONG[tier] ? TIER_LONG[tier] + " pricing" : "");

export const fm = (n) => "$" + (+n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
