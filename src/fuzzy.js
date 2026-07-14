// Trigram similarity for in-memory search (ADR 0009 §6, Option A on the client).
//
// This is the SAME algorithm Postgres pg_trgm runs server-side for the order-
// book picker (supabase/pricebook-fuzzy.sql), reimplemented in JS so the
// stock/catalog search — which runs over already-loaded items, not the DB —
// tolerates typos the same way. Keeping one algorithm means both halves of the
// shared SKU dropdown agree on what "close enough" means.
//
// pg_trgm builds trigrams by lowercasing, splitting on non-alphanumerics, then
// padding each word with two leading + one trailing space and taking every
// 3-char window. similarity = |A ∩ B| / |A ∪ B| over the two trigram sets.

export function trigrams(text) {
  const set = new Set();
  const words = String(text ?? "").toLowerCase().match(/[a-z0-9]+/g) || [];
  for (const w of words) {
    const p = "  " + w + " ";
    for (let i = 0; i + 3 <= p.length; i++) set.add(p.slice(i, i + 3));
  }
  return set;
}

export function similarity(a, b) {
  const A = trigrams(a);
  const B = trigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

// Matches the RPC's p_threshold and pg_trgm's own default.
export const FUZZY_THRESHOLD = 0.3;
