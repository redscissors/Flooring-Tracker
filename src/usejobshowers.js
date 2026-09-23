// ADR 0026: the configurator engines load only when a job has a placed
// shower or a row whose sq ft came from one.
import { useEffect, useMemo, useState } from "react";

export const hasShowerData = (cats) => (cats || []).some((c) => (c.products || []).some((p) =>
  (p.wedi && p.wedi.cfg) || (p.schluter && p.schluter.cfg) || (p.sfParts && p.sfParts.length)));

export function useJobShowers(categories) {
  const [mod, setMod] = useState(null);
  const need = hasShowerData(categories);
  useEffect(() => {
    if (need && !mod) import("./showersf.js").then(setMod).catch(() => {});
  }, [need, mod]);
  return useMemo(() => (need && mod ? mod.jobShowers(categories) : null), [need, mod, categories]);
}
