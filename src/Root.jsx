import { useEffect, useState } from "react";
import { supabase, isConfigured } from "./lib/supabase.js";
import Auth from "./Auth.jsx";
import App from "./App.jsx";

export default function Root() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isConfigured) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!isConfigured) return <SetupNotice />;
  if (!ready) return <div className="h-screen flex items-center justify-center text-slate-400">Loading…</div>;
  if (!session) return <Auth />;

  return <App user={session.user} onSignOut={() => supabase.auth.signOut()} />;
}

function SetupNotice() {
  return (
    <div className="h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md bg-white border border-slate-200 rounded-2xl p-6 text-slate-700">
        <h1 className="text-lg font-semibold mb-2">Almost there — connect Supabase</h1>
        <p className="text-sm text-slate-500 mb-3">
          The app needs your Supabase project credentials. Create a free project at{" "}
          <a className="text-indigo-600 underline" href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a>,
          then add these to a <code className="bg-slate-100 px-1 rounded">.env</code> file (see <code className="bg-slate-100 px-1 rounded">.env.example</code>):
        </p>
        <pre className="bg-slate-900 text-slate-100 text-xs rounded-lg p-3 overflow-x-auto">VITE_SUPABASE_URL=…
VITE_SUPABASE_ANON_KEY=…</pre>
        <p className="text-sm text-slate-500 mt-3">
          Then run the SQL in <code className="bg-slate-100 px-1 rounded">supabase/schema.sql</code> and restart the dev server.
        </p>
      </div>
    </div>
  );
}
