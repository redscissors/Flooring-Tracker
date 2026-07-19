import { X } from "lucide-react";

export function AppsWorkspace({ onClose }) {
  return (
    <div className="print:hidden fixed inset-0 z-50 p-2 md:p-5" style={{ background: "rgba(20,15,10,.4)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl border border-slate-200 w-full h-full flex overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <aside className="w-56 shrink-0 border-r border-slate-200 bg-slate-50/50 flex flex-col">
          <div className="px-4 pt-4 pb-3 flex items-center justify-between">
            <h3 className="ft-serif text-2xl">Apps</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>
          <nav className="px-2 space-y-0.5">
            <div className="w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm bg-indigo-600 text-white">Label Generator</div>
          </nav>
        </aside>
        <div className="flex-1 overflow-y-auto p-6"><h2 className="ft-serif text-3xl">Label Generator</h2><p className="text-slate-500 mt-2">Coming together…</p></div>
      </div>
    </div>
  );
}
