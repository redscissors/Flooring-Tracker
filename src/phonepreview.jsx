// Preview harness for the phone auto-format: the real SalespersonPop plus the
// customer-form input, no Supabase. Dev-only entry (phonepreview.html).
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { SalespersonPop } from "./widgets.jsx";
import { phoneChange } from "./phone.js";

const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
const lbl = "ft-eyebrow text-[10px] mb-1 block";

function Demo() {
  const [c, setC] = useState({ phone: "" });
  const [sp, setSp] = useState({ name: "Jeff Krejci", phone: "", email: "" });
  return (
    <div className="p-6 space-y-6 max-w-sm">
      <div><label className={lbl}>Phone</label><input id="cust" type="tel" inputMode="tel" value={c.phone} onChange={(e) => setC({ phone: phoneChange(c.phone, e.target.value) })} className={inp} /></div>
      <SalespersonPop value={sp} onChange={setSp} />
      <div className="text-xs text-slate-500">stored: {JSON.stringify({ customer: c.phone, salesperson: sp.phone })}</div>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<Demo />);
