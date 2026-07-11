import { useState } from "react";
import { supabase } from "./lib/supabase.js";

// Shown when a user arrives via an invite or password-reset link. They are
// already authenticated by the link; this lets them set a real password so they
// can sign in normally afterwards.
export default function SetPassword({ email, onDone, onCancel }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (password.length < 6) { setErr("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setErr("Passwords don't match."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      onDone();
    } catch (x) {
      setErr(x.message || "Could not set password");
    } finally {
      setBusy(false);
    }
  };

  const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";

  return (
    <div className="h-screen flex items-center justify-center bg-slate-50 p-6" style={{ fontFamily: "var(--ft-ui)" }}>
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6">
        <div className="mb-5">
          <div className="ft-wordmark" style={{ fontSize: 30 }}>ned</div>
          <div className="font-semibold tracking-tight mt-2.5">Set your password</div>
          <div className="text-xs text-slate-400 -mt-0.5">{email ? email : "Create a password to finish setting up"}</div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">New password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inp} autoComplete="new-password" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Confirm password</label>
            <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inp} autoComplete="new-password" />
          </div>

          {err && <div className="text-sm rounded-lg px-3 py-2" style={{ background: "#F0E4D2", border: "1px solid var(--ft-brand-deep)", color: "#4A3D31" }}>{err}</div>}

          <button type="submit" disabled={busy} className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 transition">
            {busy ? "Saving…" : "Set password & continue"}
          </button>
        </form>

        {onCancel && (
          <button onClick={onCancel} className="w-full text-center text-xs text-slate-400 mt-4 hover:text-slate-600">
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}
