import { useState, useRef } from "react";
import { Plus, Hand, Check, Trash2 } from "lucide-react";
import { escPush } from "./escstack.js";
import { ClaudeMark, CLAUDE_CLAY } from "./claudeflag.jsx";
import { issueRef, issueReport, SOURCE_LABEL } from "./claudeissues.js";

// The shared team issue / to-do list (issue 006), now two tabs (issue 087):
// the team list unchanged, and the central Claude issue bucket — everything
// "Flag for Claude" collected anywhere in the app, with one Copy-report action
// that builds a paste-ready markdown report for a Claude session.
export function TeamTodos({ todos, onAdd, onToggle, onDelete, onReorder, onClearDone, inp, tab = "team", onTab, claude }) {
  const openClaude = claude ? claude.issues.filter((t) => !t.done).length : 0;
  const openTeam = todos.filter((t) => !t.done).length;
  const tabCls = (on) => `flex items-center gap-1.5 text-xs font-semibold rounded-md border px-3 py-1.5 ${on ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`;
  return (
    <div>
      {claude && (
        <div className="flex gap-1.5 mb-3">
          <button onClick={() => onTab("team")} className={tabCls(tab === "team")}>Team list{openTeam ? ` (${openTeam})` : ""}</button>
          <button onClick={() => onTab("claude")} className={tabCls(tab === "claude")}>
            <span style={tab === "claude" ? { color: CLAUDE_CLAY } : undefined}><ClaudeMark size={12} /></span> Claude{openClaude ? ` (${openClaude})` : ""}
          </button>
        </div>
      )}
      {claude && tab === "claude"
        ? <ClaudeIssuesPane {...claude} inp={inp} />
        : <TeamList todos={todos} onAdd={onAdd} onToggle={onToggle} onDelete={onDelete} onReorder={onReorder} onClearDone={onClearDone} inp={inp} />}
    </div>
  );
}

// The central Claude issue bucket (issue 087): flags land here from the job
// sheet's line menu, the price book's ✳, or typed directly; each card wears
// its source. Reads newest-first; done items drop below like the team list.
function ClaudeIssuesPane({ issues, onAdd, onToggle, onDelete, onClearDone, inp }) {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const open = issues.filter((t) => !t.done);
  const doneList = issues.filter((t) => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const submit = () => { const v = text.trim(); if (!v) return; onAdd(v); setText(""); };
  const copyReport = async () => {
    try { await navigator.clipboard.writeText(issueReport(issues)); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch (x) { /* clipboard denied — nothing to roll back */ }
  };
  const srcStyle = {
    job: { background: "color-mix(in oklab, var(--ft-brand, #57703A) 13%, transparent)", color: "var(--ft-brand-deep, #40542A)" },
    book: { background: "var(--ft-band, #E7E3D6)", color: "var(--ft-muted, #57534C)" },
    general: { background: "color-mix(in oklab, #D97757 12%, transparent)", color: "#B85C3F" },
  };
  const card = (t) => (
    <div key={t.id} className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 ${t.done ? "border-slate-100 bg-slate-50" : "border-slate-200 bg-white"}`}>
      <button onClick={() => onToggle(t.id)} title={t.done ? "Reopen" : "Mark done — Claude handled it"}
        className={`shrink-0 mt-0.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center ${t.done ? "bg-indigo-600 border-transparent text-white hover:bg-indigo-700" : "border-slate-300 hover:border-indigo-600 text-transparent hover:text-indigo-600"}`}><Check size={11} strokeWidth={3} /></button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[8.5px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5" style={srcStyle[t.source.kind] || srcStyle.general}>{SOURCE_LABEL[t.source.kind]}</span>
          <span className="text-[10.5px] text-slate-500 font-semibold truncate">{issueRef(t)}</span>
        </div>
        <div className={`text-sm leading-snug break-words mt-0.5 ${t.done ? "line-through text-slate-400" : t.text ? "" : "italic text-slate-400"}`}>{t.text || "(no note — context only)"}</div>
        <div className="text-[11px] text-slate-400 mt-0.5">{[t.createdBy, t.done && t.doneAt ? "done " + new Date(t.doneAt).toLocaleDateString() : t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ""].filter(Boolean).join(" · ")}</div>
      </div>
      <button onClick={() => onDelete(t.id)} title="Delete" className="shrink-0 mt-0.5 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
    </div>
  );
  return (
    <div>
      <p className="text-sm text-slate-500 mb-3">Anything flagged for Claude — from a job line's menu, a price book, or typed here — collects on this list. Copy the report and paste it into a Claude session to work them.</p>
      <div className="flex items-center gap-2 mb-3">
        <button onClick={copyReport} disabled={open.length === 0} className="flex items-center gap-1.5 text-xs font-bold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 disabled:opacity-50">
          <span style={{ color: CLAUDE_CLAY }}><ClaudeMark size={12} /></span> {copied ? "Copied ✓" : "Copy report for Claude"}
        </button>
        <span className="ml-auto text-[11px] text-slate-400">{open.length} open · {doneList.length} done</span>
      </div>
      <div className="flex gap-2 mb-3">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="Flag something that isn't a row — 'print cuts off the freight line'…" className={inp} />
        <button onClick={submit} disabled={!text.trim()} className="shrink-0 flex items-center gap-1 text-sm rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 disabled:opacity-50"><Plus size={15} /> Add</button>
      </div>
      {open.length === 0 && doneList.length === 0 && <p className="text-sm text-slate-400">Nothing in the bucket. Right-click a product line — or click its ⋯ — and pick "Flag for Claude…". (If new flags won't save, run supabase/claude-issues.sql once.)</p>}
      <div className="space-y-1.5">{open.map(card)}</div>
      {doneList.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="ft-eyebrow text-[9px]">Done ({doneList.length})</div>
            <button onClick={onClearDone} className="text-[11px] text-slate-400 hover:text-red-500">Clear done</button>
          </div>
          <div className="space-y-1.5">{doneList.map(card)}</div>
        </div>
      )}
    </div>
  );
}

// The original team list (issue 006), unchanged behind the tab strip.
function TeamList({ todos, onAdd, onToggle, onDelete, onReorder, onClearDone, inp }) {
  const [text, setText] = useState("");
  const [to, setTo] = useState(null); // insertion bar while dragging: { index, y }
  const listRef = useRef(null);
  const open = todos.filter((t) => !t.done).sort((a, b) => a.position - b.position);
  const doneList = todos.filter((t) => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const submit = () => { const v = text.trim(); if (!v) return; onAdd(v); setText(""); };

  // Pointer drag of an open row (mouse + touch): the handle captures the
  // pointer, the row follows vertically, and the other rows' midpoints decide
  // the insertion index. Data is written once, on drop, through onReorder.
  const startDrag = (e, index) => {
    if (e.button != null && e.button !== 0) return;
    const handle = e.currentTarget;
    const row = handle.closest("[data-todo-row]");
    const list = listRef.current;
    if (!row || !list) return;
    e.preventDefault();
    try { handle.setPointerCapture(e.pointerId); } catch (x) { }
    const startY = e.clientY;
    let target = index;
    Object.assign(row.style, { position: "relative", zIndex: 30, scale: "1.02", boxShadow: "0 10px 26px rgba(40,30,20,.18)" });
    document.body.style.userSelect = "none";
    const onMove = (ev) => {
      row.style.translate = `0 ${ev.clientY - startY}px`;
      const rows = [...list.querySelectorAll("[data-todo-row]")].filter((r) => r !== row);
      let idx = 0;
      for (const r of rows) { const rc = r.getBoundingClientRect(); if (ev.clientY > rc.top + rc.height / 2) idx++; }
      if (idx === target) return;
      target = idx;
      if (idx === index) return setTo(null); // dropping back where it came from
      const lr = list.getBoundingClientRect();
      const y = rows.length === 0 ? 0 : idx < rows.length ? rows[idx].getBoundingClientRect().top - lr.top - 5 : rows[rows.length - 1].getBoundingClientRect().bottom - lr.top + 3;
      setTo({ index: idx, y });
    };
    const finish = (commit) => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onCancel);
      popEsc();
      document.body.style.userSelect = "";
      Object.assign(row.style, { position: "", zIndex: "", scale: "", boxShadow: "", translate: "" });
      setTo(null);
      if (commit && target !== index) onReorder(index, target);
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const popEsc = escPush(() => finish(false));
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onCancel);
  };

  return (
    <div>
      <p className="text-sm text-slate-500 mb-3">Shared with the whole team — anyone can add bugs, feature ideas, or shop reminders. Drag the handle to put the most important on top; check an item off when it's handled.</p>
      <div className="flex gap-2 mb-3">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="Add an issue or idea…" className={inp} />
        <button onClick={submit} disabled={!text.trim()} className="shrink-0 flex items-center gap-1 text-sm rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 disabled:opacity-50"><Plus size={15} /> Add</button>
      </div>
      {open.length === 0 && doneList.length === 0 && <p className="text-sm text-slate-400">Nothing on the list yet. (If new items won't save, run supabase/todos.sql once.)</p>}
      <div ref={listRef} className="relative space-y-1.5">
        {to && <div className="absolute left-1 right-1 h-1 rounded-full bg-indigo-600 pointer-events-none z-10" style={{ top: to.y }} />}
        {open.map((t, i) => (
          <div key={t.id} data-todo-row className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
            <button onPointerDown={(e) => startDrag(e, i)} title="Drag to reorder" className="shrink-0 mt-0.5 -m-1 p-1 rounded touch-none cursor-grab text-slate-300 hover:text-slate-500"><Hand size={14} /></button>
            <button onClick={() => onToggle(t.id)} title="Mark done" className="shrink-0 mt-0.5 w-[18px] h-[18px] rounded-full border-2 border-slate-300 hover:border-indigo-600 flex items-center justify-center text-transparent hover:text-indigo-600"><Check size={11} strokeWidth={3} /></button>
            <div className="flex-1 min-w-0">
              <div className="text-sm leading-snug break-words">{t.text}</div>
              {(t.createdBy || t.createdAt) && <div className="text-[11px] text-slate-400 mt-0.5">{[t.createdBy, t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ""].filter(Boolean).join(" · ")}</div>}
            </div>
            <button onClick={() => onDelete(t.id)} title="Delete" className="shrink-0 mt-0.5 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      {doneList.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="ft-eyebrow text-[9px]">Done ({doneList.length})</div>
            <button onClick={onClearDone} className="text-[11px] text-slate-400 hover:text-red-500">Clear done</button>
          </div>
          <div className="space-y-1.5">
            {doneList.map((t) => (
              <div key={t.id} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2">
                <button onClick={() => onToggle(t.id)} title="Reopen — puts it back on top" className="shrink-0 mt-0.5 w-[18px] h-[18px] rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700"><Check size={11} strokeWidth={3} /></button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm leading-snug break-words line-through text-slate-400">{t.text}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{[t.createdBy, t.doneAt ? "done " + new Date(t.doneAt).toLocaleDateString() : ""].filter(Boolean).join(" · ")}</div>
                </div>
                <button onClick={() => onDelete(t.id)} title="Delete" className="shrink-0 mt-0.5 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
