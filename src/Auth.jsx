import { useState } from "react";
import { Layers } from "lucide-react";
import { supabase } from "./lib/supabase.js";

export default function Auth() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(""); setMsg("");
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg("Account created. If email confirmation is on, check your inbox, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (x) {
      setErr(x.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";

  return (
    <div className="h-screen flex items-center justify-center bg-slate-50 p-6" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center"><Layers size={20} className="text-white" /></div>
          <div>
            <div className="font-semibold tracking-tight">FloorTrack</div>
            <div className="text-xs text-slate-400 -mt-0.5">{mode === "signup" ? "Create your account" : "Sign in to continue"}</div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inp} autoComplete="email" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Password</label>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={inp} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
          </div>

          {err && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>}
          {msg && <div className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{msg}</div>}

          <button type="submit" disabled={busy} className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 transition">
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="text-center text-sm text-slate-500 mt-4">
          {mode === "signup" ? "Already have an account?" : "Need an account?"}{" "}
          <button onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setErr(""); setMsg(""); }} className="text-indigo-600 font-medium hover:underline">
            {mode === "signup" ? "Sign in" : "Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}
