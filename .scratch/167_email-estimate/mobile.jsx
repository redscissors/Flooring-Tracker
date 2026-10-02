// The phone ⋯ sheet's footer: the REAL MobileSheet with App.jsx's footer
// markup (Total · Email · Print) copied verbatim — the sheet itself lives
// inside App, which needs Supabase.
import { createRoot } from "react-dom/client";
import { Mail, Printer } from "lucide-react";
import "../../src/index.css";
import { MobileSheet } from "../../src/mobile.jsx";

createRoot(document.getElementById("preview")).render(
  <MobileSheet open onClose={() => {}} title="Marsh — whole first floor" footer={<>
    <div className="flex-1 min-w-0" style={{ lineHeight: 1.15 }}>
      <div className="ft-eyebrow text-[8.5px]">Total</div>
      <div className="ft-mono text-[17px] font-bold" style={{ color: "var(--ft-brand-deep)" }}>$12,847.20</div>
    </div>
    <button aria-label="Email estimate" title="Email estimate as a PDF" className="h-[38px] w-[40px] shrink-0 flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 disabled:opacity-50"><Mail size={16} /></button>
    <button className="h-[38px] shrink-0 flex items-center justify-center gap-1.5 text-[13px] font-bold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-7"><Printer size={15} /> Print</button>
  </>}>
    <div className="text-sm text-slate-400 py-10 text-center">Project name, address, price tier… (unchanged)</div>
  </MobileSheet>
);
