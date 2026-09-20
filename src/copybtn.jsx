// Text copy button with a brief "Copied" confirmation, shared by the order-entry
// and samples panels. Falls back to execCommand when the async clipboard API
// is unavailable (older/insecure context).
import { useState } from "react";
import { Copy, Check } from "lucide-react";

// "Copied / done" affordance — a filled moss chip matching the stock rows'
// checkboxes (accent-color: --ft-brand), white check on moss. Set inline rather
// than via Tailwind's emerald utilities, which this theme's build does not render.
export const DONE_MOSS = { color: "#fff", background: "var(--ft-brand)", borderColor: "var(--ft-brand)" };

export const writeClipboard = async (text) => {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch {}
    document.body.removeChild(ta);
  }
};

export function CopyBtn({ text, label = "Copy", disabled = false, className = "", title, onCopied }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    await writeClipboard(text);
    setDone(true); setTimeout(() => setDone(false), 1400);
    if (onCopied) onCopied();
  };
  return (
    <button onClick={copy} disabled={disabled || !text} title={title} style={done ? DONE_MOSS : undefined}
      className={"inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold border transition-colors disabled:opacity-40 disabled:cursor-default " + (done ? "" : "border-slate-200 hover:bg-slate-50 ") + className}>
      {done ? <><Check size={13} /> Copied</> : <><Copy size={13} /> {label}</>}
    </button>
  );
}
