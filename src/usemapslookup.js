// src/usemapslookup.js
// The network half of address lookup: talk to /.netlify/functions/maps, debounce
// what the user types, and abandon a request the moment it's superseded.
//
// Cost discipline lives here. Autocomplete bills per REQUEST, so every keystroke
// firing one would burn the month's free allowance in an afternoon: 350ms
// debounce, a 4-character floor, one in-flight request at a time, and no repeat
// call for an unchanged input (shouldSuggest). The real backstop is the daily
// quota cap the owner sets in Cloud Console — this is the polite half.
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabase.js";
import { relayProblems } from "./mapsrelay.js";
import { parseSuggestions, parseDetails, parseDistance, shouldSuggest } from "./mapslookup.js";

const ENDPOINT = "/.netlify/functions/maps";
const DEBOUNCE_MS = 350;

// Running `npm run dev` serves the app from Vite alone, where this path 404s —
// the feature is inert locally unless the site is served by `netlify dev`, and
// says so rather than looking broken.
const call = async (body, signal) => {
  const problem = relayProblems(body);
  if (problem) return { error: "bad-request" };
  if (!supabase) return { error: "unauthorized" };
  let session;
  try {
    ({ data: { session } = {} } = await supabase.auth.getSession());
  } catch {
    return { error: "unauthorized" };
  }
  if (!session?.access_token) return { error: "unauthorized" };
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST", signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    return { error: "offline" };
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) return { error: json?.error || "upstream" };
  return json?.error ? { error: json.error } : json;
};

export const fetchDistance = async (origin, destination) => {
  const out = await call({ op: "distance", origin, destination });
  if (out?.error) return out;
  const d = parseDistance(out);
  return d || { error: "no-route" };
};

// Resolving a picked suggestion to its complete address — the postal code
// Autocomplete leaves out. Returns "" on any failure: the caller keeps the
// prediction text it already showed, because a missing ZIP is never worse
// than a pick that does nothing.
export const fetchPlaceDetails = async (placeId, sessionToken) => {
  if (!placeId) return "";
  const out = await call({ op: "details", placeId, ...(sessionToken ? { sessionToken } : {}) });
  return out?.error ? "" : parseDetails(out);
};

export const probeMaps = () => call({ op: "probe" });

// A session is one typing burst plus the details call that ends it — Google
// prices the pair together. Generated lazily so a field that is never typed in
// never mints one, and retired the moment the session terminates.
const newToken = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function useAddressSuggest() {
  const [suggestions, setSuggestions] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);
  const abort = useRef(null);
  const last = useRef("");
  const token = useRef("");

  const clear = useCallback(() => {
    clearTimeout(timer.current);
    abort.current?.abort();
    last.current = "";
    token.current = "";
    setSuggestions([]); setErr(""); setLoading(false);
  }, []);

  // Hands the caller the token to terminate this session with, and retires it:
  // the next burst opens a new session, which is what Google prices.
  const takeToken = useCallback(() => { const t = token.current; token.current = ""; return t; }, []);

  useEffect(() => () => { clearTimeout(timer.current); abort.current?.abort(); }, []);

  const ask = useCallback((input) => {
    clearTimeout(timer.current);
    if (!shouldSuggest(input, last.current)) return;
    timer.current = setTimeout(async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      last.current = String(input).trim();
      setLoading(true);
      try {
        if (!token.current) token.current = newToken();
        const out = await call({ op: "suggest", input, sessionToken: token.current }, ctrl.signal);
        if (ctrl.signal.aborted) return;
        if (out?.error) { setErr(out.error); setSuggestions([]); }
        else { setErr(""); setSuggestions(parseSuggestions(out)); }
      } catch (e) {
        if (e?.name !== "AbortError") { setErr("upstream"); setSuggestions([]); }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  return { suggestions, err, loading, ask, clear, takeToken };
}
