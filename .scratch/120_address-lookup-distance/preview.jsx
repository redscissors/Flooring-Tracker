// Preview harness for address lookup + distance: the REAL AddressField, the
// REAL useAddressSuggest hook, the REAL parsers (mapslookup.js) and the REAL
// chips — only the network is stubbed, at the `window.fetch` boundary for
// /.netlify/functions/maps, exactly as the shipped hook calls it.
//
// Session: `useAddressSuggest` (usemapslookup.js) calls
// `supabase.auth.getSession()` before every relay call, and a null client
// short-circuits straight to {error:"unauthorized"}. This harness is run
// with the real VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY passed to the vite
// process (so `supabase` is a real, non-null client and the hook's real
// branch runs), but no interactive sign-in happens in a headless preview —
// so `supabase.auth.getSession` is stubbed here to resolve a fake session
// token. This exercises the real "client exists, ask it for a session"
// branch; only the session's own network round trip is faked. No real
// credential lives in this file.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { AddressField } from "../../src/widgets.jsx";
import { useToast } from "../../src/usetoast.js";
import { supabase } from "../../src/lib/supabase.js";

if (supabase) {
  supabase.auth.getSession = async () => ({ data: { session: { access_token: "preview-fake-token" } } });
}

// The relay, faked at the fetch boundary: everything above it — the hook, the
// debounce, the parsers, the chips — is the real code the app ships.
const ROUTE = { routes: [{ distanceMeters: 29610, duration: "1620s" }] };
// No postal codes here: Autocomplete omits them, verified against the live API
// 2026-09-01. DETAILS below is what supplies the ZIP when a suggestion is picked.
const SUGGESTIONS = {
  suggestions: [
    { placePrediction: { placeId: "ChIJharris", text: { text: "4905 Harris Rd, Broadview Heights, OH, USA" } } },
    { placePrediction: { placeId: "ChIJharrison", text: { text: "4905 Harrison Ave, Cleveland, OH, USA" } } },
    { placePrediction: { placeId: "ChIJharvard", text: { text: "4905 Harvard Ave, Newburgh Heights, OH, USA" } } },
  ],
};

// What Place Details returns per prediction — the complete address a picked
// field ends up holding.
const DETAILS = {
  ChIJharris: "4905 Harris Rd, Broadview Heights, OH 44147, USA",
  ChIJharrison: "4905 Harrison Ave, Cleveland, OH 44102, USA",
  ChIJharvard: "4905 Harvard Ave, Newburgh Heights, OH 44105, USA",
};

let netMode = "ok"; // "ok" | "not-configured" | "over-quota" | "no-route"
const reply = (body) => {
  if (netMode !== "ok" && netMode !== "no-route") return { error: netMode };
  if (body.op === "suggest") return SUGGESTIONS;
  if (body.op === "details") return { formattedAddress: DETAILS[body.placeId] || "" };
  return netMode === "no-route" ? { error: "no-route" } : ROUTE;
};

window.fetch = async (url, opts) => {
  if (!String(url).includes("/.netlify/functions/maps")) throw new Error("unexpected fetch: " + url);
  await new Promise((r) => setTimeout(r, 120)); // so "Measuring…" is shootable
  return { ok: true, json: async () => reply(JSON.parse(opts.body)) };
};

const SHOP = "1 Shop St, Akron, OH";
const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
const lbl = "ft-eyebrow text-[10px] mb-1 block";

function Card({ title, cardKey, children }) {
  return (
    <div data-card={cardKey} className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="ft-eyebrow text-[9px] mb-3" style={{ color: "var(--ft-faint)" }}>{title}</div>
      <label className={lbl}>Project address</label>
      {children}
    </div>
  );
}

function Preview() {
  const { toast, ping } = useToast();
  const [uiMode, setUiMode] = useState("ok");
  const setMode = (m) => { netMode = m; setUiMode(m); };

  // 1: suggestions open under a partly-typed address
  const [v1, setV1] = useState("");
  // 2: pick a suggestion -> fresh distance chip
  const [v2, setV2] = useState("");
  const [d2, setD2] = useState(null);
  // 3: a stale stored distance -> drift chip + Recheck
  const [v3, setV3] = useState("9 New Rd, Akron, OH");
  const [d3, setD3] = useState({ miles: 18.4, minutes: 27, from: SHOP, to: "9 Old Rd", at: 1 });
  // 4/5: error cards (not-configured / over-quota) surface in the suggestions dropdown
  const [v4, setV4] = useState("");
  const [v5, setV5] = useState("");
  // 6: no-route surfaces as the distance error after picking a suggestion
  const [v6, setV6] = useState("");
  const [d6, setD6] = useState(null);

  return (
    <div className="min-h-screen p-8" style={{ background: "var(--ft-cream)" }}>
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="ft-serif" style={{ fontSize: 28, lineHeight: 1 }}>Address lookup + distance</h1>
        <div className="flex items-center gap-2 text-[12px] flex-wrap">
          <span className="text-slate-500">Relay:</span>
          {["ok", "not-configured", "over-quota", "no-route"].map((m) => (
            <button key={m} onClick={() => setMode(m)} data-mode={m}
              className={"rounded-md border px-2.5 py-1 font-semibold " + (uiMode === m ? "border-indigo-300 text-indigo-700 bg-white" : "border-slate-200 text-slate-500")}>
              {m}
            </button>
          ))}
        </div>

        <Card title="1 — suggestions open" cardKey="suggestions">
          <AddressField value={v1} onChange={setV1} inp={inp} placeholder="Project address…" ping={ping}
            suggest shopAddress={SHOP} distance={null} onDistance={() => {}} />
        </Card>

        <Card title="2 — picked suggestion, fresh distance" cardKey="fresh-distance">
          <AddressField value={v2} onChange={setV2} inp={inp} placeholder="Project address…" ping={ping}
            suggest shopAddress={SHOP} distance={d2} onDistance={setD2} />
        </Card>

        <Card title="3 — stale stored distance, Recheck" cardKey="stale-distance">
          <AddressField value={v3} onChange={setV3} inp={inp} placeholder="Project address…" ping={ping}
            suggest shopAddress={SHOP} distance={d3} onDistance={setD3} />
        </Card>

        <Card title="4 — not-configured (no Google key)" cardKey="not-configured">
          <AddressField value={v4} onChange={setV4} inp={inp} placeholder="Project address…" ping={ping}
            suggest shopAddress={SHOP} distance={null} onDistance={() => {}} />
        </Card>

        <Card title="5 — over-quota (daily limit reached)" cardKey="over-quota">
          <AddressField value={v5} onChange={setV5} inp={inp} placeholder="Project address…" ping={ping}
            suggest shopAddress={SHOP} distance={null} onDistance={() => {}} />
        </Card>

        <Card title="6 — no-route (no route between addresses)" cardKey="no-route">
          <AddressField value={v6} onChange={setV6} inp={inp} placeholder="Project address…" ping={ping}
            suggest shopAddress={SHOP} distance={d6} onDistance={setD6} />
        </Card>
      </div>
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-md bg-slate-900 text-white text-[13px] font-medium px-4 py-2 shadow-lg">{toast}</div>}
    </div>
  );
}

createRoot(document.getElementById("preview")).render(<Preview />);
