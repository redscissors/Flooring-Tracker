import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, ClipboardList, Download, X, Check, ChevronRight, Hand, Pencil, BookOpen, Database, Link2, Link2Off, MoreHorizontal, RotateCcw, AlertTriangle } from "lucide-react";
import { supabase } from "./lib/supabase.js";
import { parseVendorLink, entryProblems, entryFileName, bookmarkletSource, clearHandoff, poolSession, sheetRecord, recordKey, applySesid, mergeEntries, newGroup, moveSheetInGroups, sheetMatchesGroup, rememberIntoGroups, setSheetBook, stripHandoffMark, decodeHandoff, decodeHandoffSession, pendingForSheet, sessionlessVendor } from "./vendorfetch.js";
import { bookStaleness, DEFAULT_STALE_DAYS } from "./orderbook.js";
import { DotMenu } from "./widgets.jsx";

export const FLAG_SEMANTICS = [["", "— ignore —"], ["discontinued", "Discontinued"], ["freight", "Extra freight"], ["madeToOrder", "Made to order"], ["transitioning", "Transitioning"]];

// Amber chip for a stale book (§8.3): last imported longer ago than the
// staleness threshold. A months-old vendor cost list quietly misprices jobs, so
// the age is surfaced wherever the book is named.
export function StaleChip({ days }) {
  return (
    <span title={`Last imported ${days} days ago — vendors re-issue cost lists roughly quarterly; re-import to be sure prices are current`}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
      <AlertTriangle size={11} /> Stale · {days}d
    </span>
  );
}

// Vendor sheet fetch (ADR 0019): the bookmarklet (or a pasted link) supplies
// portal price-list links; the Netlify relay fetches each sheet's bytes; the
// results become a File[] handed to the SAME multi-file drop router a
// drag-drop uses, so routing/diff/apply are unchanged.
// --- Vendor sheet fetch (ADR 0019, 0020) ------------------------------------
// The old "Fetch vendor sheets" modal grew into a page (a tab in the Price book
// library): remembered sheets organized into sign-in groups, each re-fetchable
// on demand with per-sheet progress. The fetch engine (relay + retries +
// streamed progress) is factored out so a group's "Re-download all" and a
// single row's re-download share it.

// Prefer the Supabase Edge Function (minutes-long window — a big sheet the
// portal builds on demand can outlast a Netlify function's ceiling); fall back
// to the Netlify relay only when the Edge twin isn't deployed (404) or is
// unreachable. A 5xx from a live Edge Function is retried in place, never
// downgraded to the shorter-window relay.
async function relayVendorFetch(entry, token) {
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (base) {
    try {
      const r = await fetch(`${base}/functions/v1/vendor-fetch`, { method: "POST", headers: { authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, "content-type": "application/json" }, body: JSON.stringify(entry) });
      if (r.status !== 404) return r;
    } catch { /* unreachable — fall back */ }
  }
  return fetch("/api/vendor-fetch", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(entry) });
}

// Drain the response, reporting a 0..1 fraction when the portal sends a
// Content-Length. On-demand sheets are often chunked with none — then the bar
// stays indeterminate (fraction reported as null).
async function readSheetBytes(res, onFraction) {
  const total = Number(res.headers.get("content-length")) || 0;
  if (!res.body || !res.body.getReader) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total) onFraction(Math.min(0.98, received / total));
  }
  const out = new Uint8Array(received);
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.length; }
  return out;
}

// Fetch one sheet through the relay with the portal's on-demand-build retries.
// onProgress gets { value, note } while fetching (value null = indeterminate).
// Resolves to { file } or { error }.
async function runFetch(entry, token, onProgress) {
  let msg = "network error";
  for (let t = 1; t <= 3; t++) {
    onProgress({ value: null, note: t === 1 ? "" : `portal is slow — retry ${t - 1} of 2…` });
    if (t > 1) await new Promise((r) => setTimeout(r, 2500));
    try {
      const res = await relayVendorFetch(entry, token);
      if (res.ok) {
        const bytes = await readSheetBytes(res, (v) => onProgress({ value: v, note: "" }));
        return { file: new File([bytes], entryFileName(entry), { type: "application/vnd.ms-excel" }) };
      }
      let err = "";
      try { err = (await res.json()).error || ""; } catch {}
      if (err === "session-expired") {
        // A token-free vendor has no session to renew, and the relay sends no
        // cookies — Emser's downloads require its login (verified 2026-07-21),
        // so a fresh link can't help either. Point at download-and-drop; the
        // bookmark/paste advice stays for token-carrying (Dancik) portals.
        return { error: sessionlessVendor(entry.vendor)
          ? "this vendor's site requires its own sign-in to download — grab the sheet from their site while signed in and drop the file on this page"
          : "portal session expired — paste a freshly opened sheet's link (or click the bookmark again)" };
      }
      msg = err === "vendor-timeout"
        ? "the portal took too long to build this sheet — try again in a minute (it's usually quick the second time), or download it by hand and drop it in"
        : (err || `failed (${res.status})`);
      if (res.status < 500) return { error: msg }; // only slow/server errors are worth retrying
    } catch { msg = "network error"; }
  }
  return { error: msg };
}

// The bookmarklet setup steps (drag-to-bookmarks + copy), shared by the empty
// state and the "Set up one-click fetch" disclosure.
function VendorBookmarklet() {
  const bmSrc = bookmarkletSource();
  const [copied, setCopied] = useState(false);
  return (
    <ol className="text-sm text-slate-600 list-decimal ml-5 space-y-1.5">
      <li>Drag this button to your bookmarks bar:{" "}
        <a ref={(el) => { if (el) el.setAttribute("href", bmSrc); }} onClick={(e) => e.preventDefault()} className="inline-block rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 px-2 py-0.5 text-xs font-medium cursor-grab" title="Drag me to the bookmarks bar">⤓ FloorTrack sheets</a>
        {" "}<button onClick={() => { navigator.clipboard?.writeText(bmSrc).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }} className="text-[11px] text-slate-400 underline hover:text-slate-600">{copied ? "copied" : "or copy the code"}</button>
        <span className="block text-[11px] text-slate-400">(copying: make a new bookmark and paste the code as its URL)</span>
      </li>
      <li>Log into the vendor portal (e.g. Virginia Tile connect24) — any page works once you're signed in.</li>
      <li>Click the bookmark — it copies your sign-in to the clipboard (no new tab). Come back here and hit <span className="font-medium text-slate-600">Paste sign-in</span> to unlock every saved sheet, ready to download. (On portals that list their sheets as links, it grabs those too.)</li>
    </ol>
  );
}

// The neat little sign-in box. The primary path is one button: click the
// bookmark on the portal (it copies your sign-in to the clipboard), come back
// here, hit "Paste sign-in". It reads the clipboard, folds the sign-in in, and
// every saved sheet for that portal lights up green, ready to download.
// A collapsed "paste a link instead" reveals the manual textarea fallback —
// needed to bootstrap menu-style portals (Downloads-page copy) and unchanged in
// behaviour: "Unlock" donates the link's session without saving the sheet,
// "Add to board" also remembers it. Both the button and the fallback accept a
// copied sign-in blob OR a plain price-list URL.
function SignInPaste({ onPasteSession, onUnlock, onAdd, inp }) {
  const [manual, setManual] = useState(false);
  const [text, setText] = useState("");
  const [note, setNote] = useState(null); // { unlocked } on success | { err } otherwise
  const [busy, setBusy] = useState(false);
  const BAD = "That doesn't look like a FloorTrack sign-in or a price-list link.";

  const pasteFromClipboard = async () => {
    setBusy(true);
    let clip = "";
    try { clip = await navigator.clipboard.readText(); } catch {}
    setBusy(false);
    if (clip) { const r = onPasteSession(clip); if (r) { setNote(r); setManual(false); return; } }
    setManual(true);
    setNote({ err: clip
      ? "That clipboard text isn't a FloorTrack sign-in — click the bookmark on the portal first, or paste a sheet link below."
      : "Couldn't read the clipboard. Paste the copied text (or a sheet link) below, then Unlock." });
  };
  const unlock = () => { const r = onPasteSession(text) || onUnlock(text); if (r) { setText(""); setNote(r); } else setNote({ err: BAD }); };
  const add = () => { const r = onPasteSession(text); if (r) { setText(""); setNote(r); return; } if (onAdd(text)) { setText(""); setNote(null); } else setNote({ err: BAD }); };

  return (
    <>
      <div className="flex items-center gap-2">
        <button onClick={pasteFromClipboard} disabled={busy} title="Reads the sign-in the bookmark copied to your clipboard" className="flex items-center gap-1.5 text-sm rounded-lg bg-indigo-600 text-white px-3 py-1.5 font-medium hover:bg-indigo-700 disabled:opacity-50">
          <ClipboardList size={14} /> Paste sign-in
        </button>
        <button onClick={() => { setManual((v) => !v); setNote(null); }} className="text-[11px] text-slate-400 hover:text-slate-600 underline shrink-0">{manual ? "hide link box" : "paste a link instead"}</button>
      </div>
      {manual && (
        <div className="mt-2">
          <textarea value={text} onChange={(e) => { setText(e.target.value); if (note) setNote(null); }} rows={2} placeholder="https://connect24.virginiatile.com/…getPrettyPriceList…" className={inp + " font-mono text-[11px]"} />
          <div className="flex items-center justify-end gap-2 mt-2">
            <button onClick={add} disabled={!text.trim()} title="Also save this sheet to the board" className="text-sm rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50">Add to board</button>
            <button onClick={unlock} disabled={!text.trim()} title="Unlock this sign-in's downloads — the sheet isn't saved" className="text-sm rounded-lg bg-indigo-600 text-white px-3 py-1.5 font-medium hover:bg-indigo-700 disabled:opacity-50">Unlock downloads</button>
          </div>
        </div>
      )}
      {note && (
        note.err ? (
          <div className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
            <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500" />
            <span>{note.err}</span>
          </div>
        ) : (
          <div className={"mt-2 flex items-start gap-1.5 text-xs " + (note.unlocked ? "text-emerald-700" : "text-slate-500")}>
            <Check size={13} className="mt-0.5 shrink-0 text-emerald-600" />
            <span>{note.unlocked
              ? `Sign-in captured — ${note.unlocked} saved ${note.unlocked === 1 ? "sheet is" : "sheets are"} ready to download below.`
              : "Sign-in captured, but no saved sheets match it yet — use “paste a link instead” → “Add to board” to keep one."}</span>
          </div>
        )
      )}
    </>
  );
}

// A collapsible ⋯-menu section that points a sheet at a price book that
// already exists (the "merge" path — the sheet then presents as that book's
// row). Shared by the loose-sheet and linked-book rows. Excludes the book the
// sheet already feeds.
function bookLinkMenu({ books, sheet, onLinkBook, onDone, open, setOpen, label }) {
  return (
    <>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 hover:bg-slate-50">
        <ChevronRight size={13} className={"text-slate-400 transition-transform " + (open ? "rotate-90" : "")} /> {label}
      </button>
      {open && (
        <div className="max-h-40 overflow-y-auto bg-slate-50">
          {(books || []).length === 0 ? (
            <div className="pl-8 pr-3 py-1.5 text-[12px] text-slate-400">No price books yet</div>
          ) : (books || []).map((b) => (
            <button key={b.id} disabled={b.id === sheet.bookId} onClick={() => { onLinkBook(sheet, b.id); onDone(); }} className="w-full text-left pl-8 pr-3 py-1.5 text-[13px] hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent truncate">{b.name || "Untitled"}</button>
          ))}
        </div>
      )}
    </>
  );
}

// A linked sheet presents as its BOOK (ADR 0024): name + meta up front, the
// filename demoted to the ⋯ menu. Row click opens the book; the refresh
// control fetches the sheet and parks it for review (the pill).
function VendorBookRow({ sheet, siblings = [], book, group, groups, books, prog, locked, mismatch, running, stale, pending, checked, onToggle, onRedownload, onReview, onRemove, onMove, onLinkBook, onUnlinkBook, onOpenBook }) {
  const feeds = [sheet, ...siblings];
  const [menu, setMenu] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const menuBtn = useRef(null);
  const others = groups.filter((g) => g.id !== group.id);
  const fetching = prog?.state === "fetching";
  const openMenu = (v) => { setMenu(v); if (!v) { setMoveOpen(false); setLinkOpen(false); } };
  const feedNote = siblings.length ? `${feeds.length} sheets · ` : "";
  const meta = pending ? "downloaded — changes waiting"
    : fetching ? `downloading ${entryFileName(sheet)}…`
    : `${feedNote}${book.data?.lastImport?.skus ? `${book.data.lastImport.skus} items · ` : ""}${sheet.lastFetched ? `fetched ${new Date(sheet.lastFetched).toLocaleDateString()}` : "not fetched yet"}`;
  return (
    <div className={"px-2.5 py-1.5 " + (checked ? "bg-indigo-50" : pending ? "bg-indigo-50/40" : stale?.stale ? "bg-amber-50" : "")}>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={checked} onChange={onToggle} className="shrink-0" title="Select for batch download" />
        <BookOpen size={14} className="text-slate-400 shrink-0" />
        <button onClick={() => onOpenBook(book.id)} className="min-w-0 flex-1 text-left" title={`${book.name || "Untitled"} — open this price book (source sheet${feeds.length > 1 ? "s" : ""}: ${feeds.map(entryFileName).join(", ")})`}>
          <div className="text-[12.5px] font-medium truncate">{book.name || "Untitled"}</div>
          <div className="text-[10px] text-slate-400 truncate">{meta}</div>
        </button>
        {mismatch && <span className="shrink-0 leading-none" title="This sheet is from a different portal account — it needs its own sign-in link to download."><AlertTriangle size={12} className="text-amber-500" /></span>}
        {stale?.stale && !pending && <span className="shrink-0 leading-none" title={`Last imported ${stale.days} days ago — refresh to update.`}><AlertTriangle size={12} className="text-amber-500" /></span>}
        {prog?.state === "done" && !pending && <Check size={13} className="text-emerald-600 shrink-0" />}
        {prog?.state === "error" && <AlertTriangle size={12} className="text-red-500 shrink-0" />}
        {pending && !fetching && (
          <button onClick={() => onReview(pending)} title={`${entryFileName(sheet)} is downloaded — open this book's import review`} className="shrink-0 rounded-full bg-indigo-600 text-white text-[10px] font-semibold px-2 py-px hover:bg-indigo-700">Review</button>
        )}
        {!fetching && !pending && <button onClick={() => onRedownload(sheet)} disabled={running} title={locked ? "Refresh this book's sheet (no live sign-in yet — a failed try says how to unlock)" : "Ready — refresh this book's sheet"} className={"p-0.5 disabled:opacity-40 shrink-0 " + (locked || prog?.state === "done" ? "text-slate-400 hover:text-indigo-600" : "ft-live")}><RotateCcw size={12} /></button>}
        <button ref={menuBtn} onClick={() => openMenu(!menu)} title="More" className="p-0.5 text-slate-400 hover:text-slate-600 shrink-0"><MoreHorizontal size={14} /></button>
        <DotMenu open={menu} onClose={() => openMenu(false)} anchorRef={menuBtn}>
          <div className="px-3 py-1 text-[11px] text-slate-400">
            Source sheet{feeds.length > 1 ? "s" : ""}:
            {feeds.map((f) => <div key={recordKey(f)} className="text-slate-600 truncate" title={entryFileName(f)}>{entryFileName(f)}</div>)}
          </div>
          <button onClick={() => { onOpenBook(book.id); openMenu(false); }} className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 hover:bg-slate-50"><BookOpen size={13} className="text-slate-400" /> Open price book</button>
          <button onClick={() => { onUnlinkBook(sheet); openMenu(false); }} className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 hover:bg-slate-50"><Link2Off size={13} className="text-slate-400" /> Unlink price book</button>
          {bookLinkMenu({ books, sheet, onLinkBook, onDone: () => openMenu(false), open: linkOpen, setOpen: setLinkOpen, label: "Link to a different book" })}
          {others.length > 0 && (
            <>
              <div className="my-1 border-t border-slate-100" />
              <button onClick={() => setMoveOpen((v) => !v)} className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 hover:bg-slate-50">
                <ChevronRight size={13} className={"text-slate-400 transition-transform " + (moveOpen ? "rotate-90" : "")} /> Move to another sign-in
              </button>
              {moveOpen && (
                <div className="max-h-40 overflow-y-auto bg-slate-50">
                  {others.map((g) => (
                    <button key={g.id} onClick={() => { onMove(sheet, group.id, g.id); openMenu(false); }} className="w-full text-left pl-8 pr-3 py-1.5 text-[13px] hover:bg-slate-100 truncate">{g.name}</button>
                  ))}
                </div>
              )}
            </>
          )}
          <div className="my-1 border-t border-slate-100" />
          <button onClick={() => { onRemove(group.id, sheet); openMenu(false); }} className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 text-red-600 hover:bg-red-50"><X size={13} /> Forget this sheet</button>
        </DotMenu>
      </div>
      {fetching && (
        <div className="pl-6 pr-1 pt-1">
          <div className={"ft-progress h-1" + (prog.value == null ? " ft-progress-indeterminate" : "")}>
            {prog.value != null && <div className="ft-progress-fill" style={{ width: `${Math.round(prog.value * 100)}%` }} />}
          </div>
        </div>
      )}
      {prog?.state === "error" && <div className="pl-6 pt-0.5 text-[10px] text-red-600" title={prog.note}>{prog.note}</div>}
    </div>
  );
}

// One remembered sheet on a dense board row: checkbox · filename · warn icons ·
// re-download · ⋯ menu. Clicking the name toggles selection for the batch bar.
// Downloads are never pre-locked (ADR 0021): a fetch without this portal's live
// session fails on the spot with a "sign in" note on the error sub-line. Amber
// icons flag a portal-account mismatch and a stale linked book (row tints amber
// too). The ⋯ menu creates/unlinks a price book, moves the sheet to another
// sign-in (collapsible list), or forgets it.
function VendorSheetRow({ sheet, group, groups, books, prog, locked, mismatch, running, stale, bookName, checked, onToggle, onRedownload, onRemove, onMove, onCreateBook, onLinkBook, onUnlinkBook, pending, onReview }) {
  const [menu, setMenu] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const menuBtn = useRef(null);
  const others = groups.filter((g) => g.id !== group.id);
  const fetching = prog?.state === "fetching";
  const openMenu = (v) => { setMenu(v); if (!v) { setMoveOpen(false); setLinkOpen(false); } };
  const linkItem = bookLinkMenu({ books, sheet, onLinkBook, onDone: () => openMenu(false), open: linkOpen, setOpen: setLinkOpen, label: "Link to an existing price book…" });
  return (
    <div className={"px-2.5 py-1.5 " + (checked ? "bg-indigo-50" : stale?.stale ? "bg-amber-50" : "")}>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={checked} onChange={onToggle} className="shrink-0" title="Select for batch download" />
        <button onClick={onToggle} className="text-[12.5px] truncate min-w-0 flex-1 text-left" title={entryFileName(sheet) + (bookName ? ` — feeds ${bookName}` : "")}>{entryFileName(sheet)}</button>
        {mismatch && <span className="shrink-0 leading-none" title="This sheet is from a different portal account — it needs its own sign-in link to download."><AlertTriangle size={12} className="text-amber-500" /></span>}
        {stale?.stale && !pending && <span className="shrink-0 leading-none" title={`${bookName || "Its price book"} was last imported ${stale.days} days ago — re-download this sheet to refresh it.`}><AlertTriangle size={12} className="text-amber-500" /></span>}
        {prog?.state === "done" && !pending && <Check size={13} className="text-emerald-600 shrink-0" />}
        {prog?.state === "error" && <AlertTriangle size={12} className="text-red-500 shrink-0" />}
        {pending && !fetching && (
          <button onClick={() => onReview(pending)} title={`${entryFileName(sheet)} is downloaded — open its import review`} className="shrink-0 rounded-full bg-indigo-600 text-white text-[10px] font-semibold px-2 py-px hover:bg-indigo-700">Review</button>
        )}
        {!fetching && <button onClick={() => onRedownload(sheet)} disabled={running} title={locked ? "Download this sheet (no live sign-in yet — a failed try says how to unlock)" : "Ready — download this sheet"} className={"p-0.5 disabled:opacity-40 shrink-0 " + (locked || prog?.state === "done" ? "text-slate-400 hover:text-indigo-600" : "ft-live")}><RotateCcw size={12} /></button>}
        <button ref={menuBtn} onClick={() => openMenu(!menu)} title="More" className="p-0.5 text-slate-400 hover:text-slate-600 shrink-0"><MoreHorizontal size={14} /></button>
        <DotMenu open={menu} onClose={() => openMenu(false)} anchorRef={menuBtn}>
          {sheet.bookId ? (
            <>
              <div className="px-3 py-1 text-[11px] text-slate-400 truncate">Feeds <span className="text-slate-600">{bookName || "a deleted book"}</span></div>
              <button onClick={() => { onUnlinkBook(sheet); openMenu(false); }} className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 hover:bg-slate-50"><Link2Off size={13} className="text-slate-400" /> Unlink price book</button>
            </>
          ) : (
            <>
              <button onClick={() => { onCreateBook(sheet); openMenu(false); }} disabled={running} title="Download this sheet and start a new price book from it" className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"><Plus size={13} className="text-slate-400" /> Create price book from this sheet</button>
              {linkItem}
            </>
          )}
          {others.length > 0 && (
            <>
              <div className="my-1 border-t border-slate-100" />
              <button onClick={() => setMoveOpen((v) => !v)} className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 hover:bg-slate-50">
                <ChevronRight size={13} className={"text-slate-400 transition-transform " + (moveOpen ? "rotate-90" : "")} /> Move to another sign-in
              </button>
              {moveOpen && (
                <div className="max-h-40 overflow-y-auto bg-slate-50">
                  {others.map((g) => (
                    <button key={g.id} onClick={() => { onMove(sheet, group.id, g.id); openMenu(false); }} className="w-full text-left pl-8 pr-3 py-1.5 text-[13px] hover:bg-slate-100 truncate">{g.name}</button>
                  ))}
                </div>
              )}
            </>
          )}
          <div className="my-1 border-t border-slate-100" />
          <button onClick={() => { onRemove(group.id, sheet); openMenu(false); }} className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 text-red-600 hover:bg-red-50"><X size={13} /> Forget this sheet</button>
        </DotMenu>
      </div>
      {fetching && (
        <div className="pl-6 pr-1 pt-1">
          <div className={"ft-progress h-1" + (prog.value == null ? " ft-progress-indeterminate" : "")}>
            {prog.value != null && <div className="ft-progress-fill" style={{ width: `${Math.round(prog.value * 100)}%` }} />}
          </div>
        </div>
      )}
      {prog?.state === "error" && <div className="pl-6 pt-0.5 text-[10px] text-red-600" title={prog.note}>{prog.note}</div>}
    </div>
  );
}

// One sign-in as a slim board column: name · download-all · a ⋯ menu holding
// rename / sign-in link / delete, then single-line sheet rows. Sheets move
// between sign-ins from a row's ⋯ menu (the pointer-drag went away with the
// board layout — ADR 0021).
function VendorGroupCard({ group, groups, books, sheetSesid, sheetInfo, progress, running, selected, onToggleSheet, onRedownloadAll, onRedownloadSheet, onPatch, onDelete, onRemoveSheet, onMoveSheet, onCreateBook, onLinkBook, onUnlinkBook, onOpenBook, pendingFor, onReview, inp }) {
  const [menu, setMenu] = useState(false);
  const menuBtn = useRef(null);
  const [editName, setEditName] = useState(false);
  const [nameDraft, setNameDraft] = useState(group.name);
  const [editUrl, setEditUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState(group.loginUrl || "");
  const [confirmDel, setConfirmDel] = useState(false);

  const commitName = () => { const n = nameDraft.trim(); if (n && n !== group.name) onPatch(group.id, { name: n }); else setNameDraft(group.name); setEditName(false); };
  const commitUrl = () => { onPatch(group.id, { loginUrl: urlDraft.trim() }); setEditUrl(false); };
  const groupLive = group.sheets.length > 0 && group.sheets.some((s) => sheetSesid(s));

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="px-2.5 py-2 border-b border-slate-100">
        <div className="flex items-center gap-1">
          {editName ? (
            <input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onBlur={commitName} onKeyDown={(e) => { if (e.key === "Enter") commitName(); if (e.key === "Escape") { e.preventDefault(); setNameDraft(group.name); setEditName(false); } }} className={inp + " text-sm font-medium"} />
          ) : (
            <h3 className="text-[13px] font-semibold truncate flex-1 min-w-0" title={group.name}>{group.name}</h3>
          )}
          <button onClick={() => onRedownloadAll(group)} disabled={running || group.sheets.length === 0} title={groupLive ? "Ready — download every sheet in this sign-in" : "Download every sheet in this sign-in"} className={"p-1 disabled:opacity-40 shrink-0 " + (groupLive ? "ft-live" : "text-indigo-600 hover:text-indigo-700")}><Download size={14} /></button>
          <button ref={menuBtn} onClick={() => setMenu((v) => !v)} title="Sign-in options" className="p-1 text-slate-400 hover:text-slate-600 shrink-0"><MoreHorizontal size={14} /></button>
          <DotMenu open={menu} onClose={() => setMenu(false)} anchorRef={menuBtn} width={192}>
            <button onClick={() => { setNameDraft(group.name); setEditName(true); setMenu(false); }} className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 hover:bg-slate-50"><Pencil size={13} className="text-slate-400" /> Rename sign-in</button>
            <button onClick={() => { setUrlDraft(group.loginUrl || ""); setEditUrl(true); setMenu(false); }} className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 hover:bg-slate-50"><Link2 size={13} className="text-slate-400" /> {group.loginUrl ? "Edit" : "Add"} sign-in link</button>
            <div className="my-1 border-t border-slate-100" />
            <button onClick={() => { setConfirmDel(true); setMenu(false); }} className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 text-red-600 hover:bg-red-50"><Trash2 size={13} /> Delete sign-in…</button>
          </DotMenu>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5 min-w-0">
          {group.loginUrl && <a href={group.loginUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline shrink-0"><Link2 size={11} /> Sign in</a>}
          <span className="truncate">{group.sheets.length} sheet{group.sheets.length === 1 ? "" : "s"}</span>
        </div>
        {editUrl && (
          <input autoFocus value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)} onBlur={commitUrl} onKeyDown={(e) => { if (e.key === "Enter") commitUrl(); if (e.key === "Escape") { e.preventDefault(); setEditUrl(false); } }} placeholder="https://portal-sign-in…" className={inp + " text-[11px] mt-1.5"} />
        )}
      </div>
      {confirmDel && (
        <div className="flex items-center gap-2 flex-wrap px-2.5 py-2 text-xs bg-red-50 border-b border-red-100">
          <span className="flex-1 text-red-600">Delete "{group.name}" and forget its {group.sheets.length} sheet{group.sheets.length === 1 ? "" : "s"}? Saved estimates are unaffected.</span>
          <button onClick={() => { onDelete(group.id); setConfirmDel(false); }} className="rounded-md bg-red-600 text-white px-2.5 py-1 font-medium hover:bg-red-700 shrink-0">Delete</button>
          <button onClick={() => setConfirmDel(false)} className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-white shrink-0">Cancel</button>
        </div>
      )}
      {group.sheets.length === 0 ? (
        <p className="px-2.5 py-2 text-[11px] text-slate-400">No sheets yet — paste a link above, or move one here from a row's ⋯ menu.</p>
      ) : (() => {
        const linked = group.sheets.filter((s) => sheetInfo(s).book);
        const loose = group.sheets.filter((s) => !sheetInfo(s).book);
        // One row per BOOK, not per sheet: a book fed by several sheets (Mirage's
        // flooring + trim + product chart) would otherwise repeat down the column
        // once per file. The row reports the extra sheets and acts on all of them.
        const byBook = [];
        for (const s of linked) {
          const info = sheetInfo(s);
          const hit = byBook.find((b) => b.book?.id === info.book?.id);
          if (hit) hit.sheets.push(s); else byBook.push({ book: info.book, stale: info.stale, sheets: [s] });
        }
        const rowProps = (s) => ({ sheet: s, group, groups, books, prog: progress[recordKey(s)], locked: !sheetSesid(s), mismatch: !sheetMatchesGroup(s, group), running, pending: pendingFor(s), checked: selected.has(recordKey(s)), onToggle: () => onToggleSheet(s), onRedownload: onRedownloadSheet, onReview, onRemove: onRemoveSheet, onMove: onMoveSheet, onLinkBook });
        return (
          <div className="divide-y divide-slate-100">
            {byBook.map(({ book, stale, sheets }) => {
              const all = sheets.every((s) => selected.has(recordKey(s)));
              return (
                <VendorBookRow key={book?.id || recordKey(sheets[0])} {...rowProps(sheets[0])} siblings={sheets.slice(1)} book={book} stale={stale}
                  checked={all}
                  onToggle={() => sheets.forEach((s) => { if (selected.has(recordKey(s)) === all) onToggleSheet(s); })}
                  onRedownload={() => sheets.forEach((s) => onRedownloadSheet(s))}
                  onUnlinkBook={onUnlinkBook} onOpenBook={onOpenBook} />
              );
            })}
            {loose.length > 0 && linked.length > 0 && <div className="px-2.5 pt-1.5 pb-0.5 text-[9px] font-semibold uppercase tracking-widest text-slate-400">Loose sheets</div>}
            {loose.map((s) => { const info = sheetInfo(s); return (
              <VendorSheetRow key={recordKey(s)} {...rowProps(s)} stale={info.stale} bookName={null} onCreateBook={onCreateBook} onUnlinkBook={onUnlinkBook} />
            ); })}
          </div>
        );
      })()}
    </div>
  );
}

export function useVendorFetch({ settings, setSettings, books, vendorPending, vendorSession, onSessionUsed, onPool, addBook }) {
  const [sesidPool, setSesidPool] = useState(vendorPending || []); // live-session pool (sesids) from full links
  const [sessions, setSessions] = useState([]); // bare bookmarklet sessions (host|user -> sesid), unlock only
  const [sessionNote, setSessionNote] = useState(null); // "sign-in captured" banner after a bookmarklet grab
  const [progress, setProgress] = useState({});
  const [running, setRunning] = useState(false);

  const staleDays = settings.ops?.staleDays || DEFAULT_STALE_DAYS;
  const groups = settings.ops?.vendorGroups || [];
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const writeGroups = (next) => setSettings({ ops: { ...(settings.ops || {}), vendorGroups: next } });

  // Fold a bookmarklet / paste hand-off into both the live-session pool (which
  // unlocks re-downloads) and the groups (so a freshly captured sheet appears
  // under its sign-in). Idempotent, so a repeat hand-off is a no-op.
  useEffect(() => {
    if (!vendorPending || !vendorPending.length) return;
    setSesidPool((p) => mergeEntries(p, vendorPending));
    const next = rememberIntoGroups(groupsRef.current, vendorPending.map(sheetRecord));
    if (JSON.stringify(next) !== JSON.stringify(groupsRef.current)) writeGroups(next);
    clearHandoff();
  }, [vendorPending]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fold a bookmarklet's bare session grab into the unlock pool without ever
  // remembering a sheet (the whole point of grabbing the token instead of a
  // link). Report how many saved sheets it just unlocked, then clear the hand-off.
  useEffect(() => {
    if (!vendorSession) return;
    setSessions((prev) => poolSession(prev, vendorSession, groupsRef.current));
    const unlocked = groupsRef.current.reduce((n, g) => n + g.sheets.filter((s) => s.host === vendorSession.host && (!vendorSession.user || s.user === vendorSession.user)).length, 0);
    setSessionNote({ unlocked });
    onSessionUsed && onSessionUsed();
  }, [vendorSession]); // eslint-disable-line react-hooks/exhaustive-deps

  const liveSesid = {};
  for (const e of sesidPool) { const k = `${e.host}|${e.user}`; if (!liveSesid[k]) liveSesid[k] = e.sesid; }
  for (const s of sessions) { liveSesid[`${s.host}|${s.user}`] = s.sesid; } // a fresh bookmarklet grab outranks stale link tokens
  // A sessionless vendor's sheets are always live: the sentinel keeps every
  // liveness read truthy, and applySesid clamps it back to "" for the relay.
  const sheetSesid = (s) => (sessionlessVendor(s.vendor) ? "none-needed" : liveSesid[`${s.host}|${s.user}`]);

  // Staleness of the price book a sheet feeds: amber once the linked book's last
  // import is past the owner-set threshold (the same one the book list uses).
  const bookById = {};
  for (const b of books || []) bookById[b.id] = b;
  const sheetInfo = (s) => {
    const book = s.bookId ? bookById[s.bookId] : null;
    return { book, stale: book ? bookStaleness(book.data?.lastImport?.at, staleDays) : null };
  };

  const parseLinks = (text) => (text || "").split(/\s+/).map(parseVendorLink).filter((e) => e && !entryProblems(e));

  // The clipboard sign-in blob the bookmarklet copies (marked base64 of
  // {v:1,links,session}). Fold its session into the unlock pool AND remember any
  // links it carried, then report how many saved sheets are now live. Returns
  // null when the text isn't a sign-in blob, so the caller can fall back to
  // treating it as a plain price-list URL.
  const pasteSignIn = (text) => {
    const raw = stripHandoffMark(text);
    const links = decodeHandoff(raw) || [];
    const session = decodeHandoffSession(raw);
    if (!links.length && !session) return null;
    if (session) setSessions((prev) => poolSession(prev, session, groupsRef.current));
    if (links.length) setSesidPool((p) => mergeEntries(p, links));
    const nextGroups = links.length ? rememberIntoGroups(groupsRef.current, links.map(sheetRecord)) : groupsRef.current;
    if (nextGroups !== groupsRef.current && JSON.stringify(nextGroups) !== JSON.stringify(groupsRef.current)) writeGroups(nextGroups);
    const portals = new Set(links.map((e) => `${e.host}|${e.user}`));
    if (session) {
      if (session.user) portals.add(`${session.host}|${session.user}`);
      else for (const g of nextGroups) for (const s of g.sheets) if (s.host === session.host) portals.add(`${s.host}|${s.user}`);
    }
    const unlocked = nextGroups.reduce((n, g) => n + g.sheets.filter((s) => portals.has(`${s.host}|${s.user}`)).length, 0);
    return { unlocked };
  };

  // Temp unlock: pool the pasted link's live session token so every remembered
  // sheet for its sign-in becomes fetchable, without saving the pasted sheet.
  const unlockPasted = (text) => {
    const found = parseLinks(text);
    if (!found.length) return null;
    setSesidPool((p) => mergeEntries(p, found));
    const portals = new Set(found.map((e) => `${e.host}|${e.user}`));
    const unlocked = groups.reduce((n, g) => n + g.sheets.filter((s) => portals.has(`${s.host}|${s.user}`)).length, 0);
    return { unlocked };
  };
  const addPasted = (text) => {
    const found = parseLinks(text);
    if (!found.length) return false;
    setSesidPool((p) => mergeEntries(p, found));
    writeGroups(rememberIntoGroups(groups, found.map(sheetRecord)));
    return true;
  };

  const patchGroup = (id, patch) => writeGroups(groups.map((g) => g.id === id ? { ...g, ...patch } : g));
  const delGroup = (id) => writeGroups(groups.filter((g) => g.id !== id));
  const addGroup = () => writeGroups([...groups, newGroup()]);
  const removeSheet = (groupId, sheet) => writeGroups(groups.map((g) => g.id === groupId ? { ...g, sheets: g.sheets.filter((s) => recordKey(s) !== recordKey(sheet)) } : g));
  const moveSheet = (sheet, fromId, toId) => writeGroups(moveSheetInGroups(groupsRef.current, sheet, fromId, toId));

  // Downloads are never pre-locked (ADR 0021): run() takes plain sheet records
  // and resolves each one's live session itself — a sheet whose portal has no
  // fresh link yet fails on its own row with a note saying how to unlock,
  // instead of a disabled button. The sesid mechanic is unchanged (ADR 0019).
  const NO_SESSION = "no live sign-in — sign in on this portal and click the bookmark (or paste a fresh link), then retry";
  const run = async (picks) => {
    const list = (picks || []).filter(Boolean);
    if (!list.length || running) return;
    setRunning(true);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const fetched = [], ok = [];
    for (const s of list) {
      const k = recordKey(s);
      const ses = sheetSesid(s);
      if (!ses) { setProgress((m) => ({ ...m, [k]: { state: "error", note: NO_SESSION } })); continue; }
      const e = applySesid(s, ses);
      setProgress((m) => ({ ...m, [k]: { state: "fetching", value: null, note: "" } }));
      const res = await runFetch(e, token, (p) => setProgress((m) => ({ ...m, [k]: { state: "fetching", value: p.value, note: p.note } })));
      if (res.file) { fetched.push({ sheet: sheetRecord(e), file: res.file }); ok.push(e); setProgress((m) => ({ ...m, [k]: { state: "done" } })); }
      else { setProgress((m) => ({ ...m, [k]: { state: "error", note: res.error } })); }
    }
    if (ok.length) {
      writeGroups(rememberIntoGroups(groupsRef.current, ok.map((e) => ({ ...sheetRecord(e), lastFetched: Date.now() }))));
    }
    setRunning(false);
    if (fetched.length) onPool(fetched);
    return ok.map((e) => recordKey(e));
  };

  // "Create price book from this sheet": download the one sheet, spin up a new
  // order book named from it, link the sheet to it (so future re-downloads keep
  // that book fresh and the stale flag has a book to watch), and hand the file
  // to the normal import review targeted at the new book.
  const createBookFromSheet = async (sheet) => {
    if (running || !addBook) return;
    const k = recordKey(sheet);
    const ses = sheetSesid(sheet);
    if (!ses) { setProgress((m) => ({ ...m, [k]: { state: "error", note: NO_SESSION } })); return; }
    setRunning(true);
    setProgress((m) => ({ ...m, [k]: { state: "fetching", value: null, note: "" } }));
    const { data } = await supabase.auth.getSession();
    const res = await runFetch(applySesid(sheet, ses), data.session?.access_token, (p) => setProgress((m) => ({ ...m, [k]: { state: "fetching", value: p.value, note: p.note } })));
    setRunning(false);
    if (!res.file) { setProgress((m) => ({ ...m, [k]: { state: "error", note: res.error } })); return; }
    setProgress((m) => ({ ...m, [k]: { state: "done" } }));
    const id = await addBook({ kind: "order", name: entryFileName(sheet).replace(/\.xls$/i, "") });
    let next = rememberIntoGroups(groupsRef.current, [{ ...sheetRecord(sheet), lastFetched: Date.now() }]);
    writeGroups(setSheetBook(next, sheet, id));
    onPool([{ sheet: { ...sheetRecord(sheet), bookId: id }, file: res.file }]);
  };
  const unlinkSheetBook = (sheet) => writeGroups(setSheetBook(groupsRef.current, sheet, null));
  // Point a sheet at a book that already exists (the "merge" path): the sheet
  // starts feeding that book, so it presents as that book's row and re-downloads
  // keep it fresh — no duplicate book minted. Same write path as unlink.
  const linkSheetBook = (sheet, bookId) => writeGroups(setSheetBook(groupsRef.current, sheet, bookId));

  return { groups, writeGroups, sheetSesid, sheetInfo, progress, running, run, createBookFromSheet, linkSheetBook, unlinkSheetBook, patchGroup, delGroup, addGroup, removeSheet, moveSheet, pasteSignIn, unlockPasted, addPasted, sessionNote, setSessionNote };
}

export function VendorFetchPage({ vf, books, pending, onReview, onOpenBook, leadColumn, inp }) {
  const [selSheets, setSelSheets] = useState(() => new Set()); // recordKeys picked for the batch bar
  const { groups, sheetSesid, sheetInfo, progress, running, sessionNote, setSessionNote } = vf;
  const clearKeys = (keys) => setSelSheets((prev) => { const n = new Set(prev); for (const k of keys || []) n.delete(k); return n; });
  const runAnd = async (picks) => clearKeys(await vf.run(picks));
  const toggleSheet = (sheet) => setSelSheets((prev) => { const n = new Set(prev); const k = recordKey(sheet); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const removeSheet = (groupId, sheet) => { vf.removeSheet(groupId, sheet); setSelSheets((prev) => { const n = new Set(prev); n.delete(recordKey(sheet)); return n; }); };
  const redownloadAll = (g) => runAnd(g.sheets);
  const redownloadSheet = (s) => runAnd([s]);
  const downloadSelected = () => runAnd(groups.flatMap((g) => g.sheets.filter((s) => selSheets.has(recordKey(s)))));

  return (
    <div>
      {sessionNote && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
          <Check size={14} className="text-emerald-600 shrink-0" />
          <span className="flex-1 text-emerald-800">{sessionNote.unlocked
            ? `Sign-in captured from the bookmark — ${sessionNote.unlocked} saved ${sessionNote.unlocked === 1 ? "sheet is" : "sheets are"} ready to download.`
            : "Sign-in captured, but there are no saved sheets for it yet — paste a sheet link with “Add to board” to start one."}</span>
          <button onClick={() => setSessionNote(null)} title="Dismiss" className="p-0.5 text-emerald-600 hover:text-emerald-800 shrink-0"><X size={13} /></button>
        </div>
      )}

      <div className="mt-3 grid gap-3 items-start grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
        {leadColumn}
        {groups.length === 0 ? (
          <div className="rounded-xl border border-slate-200 p-6 text-center">
            <Download size={22} className="mx-auto text-slate-300" />
            <h3 className="mt-2 text-sm font-medium text-slate-600">No sign-ins yet</h3>
            <p className="mt-1 text-xs text-slate-400">Paste a portal sign-in above and click the bookmark on a vendor portal, or paste a price-list link. Sheets land here grouped by sign-in, ready to fetch and re-fetch.</p>
          </div>
        ) : (
          groups.map((g) => (
            <VendorGroupCard key={g.id} group={g} groups={groups} books={books} sheetSesid={sheetSesid} sheetInfo={sheetInfo} progress={progress} running={running} selected={selSheets} onToggleSheet={toggleSheet} onRedownloadAll={redownloadAll} onRedownloadSheet={redownloadSheet} onPatch={vf.patchGroup} onDelete={vf.delGroup} onRemoveSheet={removeSheet} onMoveSheet={vf.moveSheet} onCreateBook={vf.createBookFromSheet} onLinkBook={vf.linkSheetBook} onUnlinkBook={vf.unlinkSheetBook} onOpenBook={onOpenBook} pendingFor={(s) => pendingForSheet(pending, s)} onReview={onReview} inp={inp} />
          ))
        )}
        <button onClick={vf.addGroup} className="rounded-xl border border-dashed border-slate-300 min-h-[5.5rem] flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:bg-slate-50"><Plus size={14} /> New sign-in</button>
      </div>

      {selSheets.size > 0 && (
        <div className={`fixed ${pending.length ? "bottom-[4.25rem]" : "bottom-5"} left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-xl border border-slate-200 bg-white shadow-xl pl-4 pr-2 py-2`}>
          <span className="text-sm font-semibold whitespace-nowrap">{selSheets.size} selected</span>
          <button onClick={downloadSelected} disabled={running} className="rounded-lg bg-indigo-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap">Download selected</button>
          <button onClick={() => setSelSheets(new Set())} title="Clear selection" className="p-1.5 text-slate-400 hover:text-slate-600"><X size={14} /></button>
        </div>
      )}
    </div>
  );
}

// Books with no portal sheet — hand-kept/unlinked registry books (the ERP
// stock exports among them). First column of the library board (ADR 0024).
export function InHouseColumn({ books, groups, bookStale, onOpen }) {
  const linkedIds = new Set();
  for (const g of groups) for (const s of g.sheets || []) if (s.bookId) linkedIds.add(s.bookId);
  const inHouse = books.filter((b) => !linkedIds.has(b.id));
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="px-2.5 py-2 border-b border-slate-100 bg-slate-50 rounded-t-xl">
        <h3 className="text-[13px] font-semibold">In-house</h3>
        <div className="text-[11px] text-slate-400 mt-0.5">no portal — imported by hand</div>
      </div>
      <div className="divide-y divide-slate-100">
        {inHouse.map((b) => (
          <button key={b.id} onClick={() => onOpen(b.id)} className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-slate-50">
            <Database size={14} className="text-slate-400 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-medium truncate">{b.name || "Untitled"}</span>
              <span className="block text-[10px] text-slate-400">{b.kind === "stock" ? "stock" : "special order"}{b.active ? "" : " · off"}</span>
            </span>
            {bookStale(b).stale && <AlertTriangle size={12} className="text-amber-500 shrink-0" aria-label={`Stale — imported ${bookStale(b).days} days ago`} />}
          </button>
        ))}
      </div>
    </div>
  );
}

// "Paste sign-in" popover: the add-a-sign-in box (paste row + bookmark setup)
// tucked behind a header button so the board stays the focus (ADR 0024).
export function PasteSignInPopover({ vf, setupOpen, setSetupOpen, inp, lbl }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className={`flex items-center gap-1.5 text-xs rounded-md border px-2.5 py-1.5 ${open ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
        <Hand size={13} /> Paste sign-in
      </button>
      {open && (
        <div className="absolute left-0 mt-1 w-80 max-w-[calc(100vw-2rem)] z-50 rounded-xl border border-slate-200 bg-white shadow-xl p-3">
          <div className="flex items-center justify-between gap-2">
            <label className={lbl + " mb-0"}>Add a sign-in</label>
            <button onClick={() => setSetupOpen((v) => !v)} className="text-[11px] text-indigo-600 hover:underline shrink-0">{setupOpen ? "Hide setup" : "Set up bookmark"}</button>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 mb-2">Click the bookmark on a vendor portal, then paste it here — no new tab.</p>
          <SignInPaste onPasteSession={vf.pasteSignIn} onUnlock={vf.unlockPasted} onAdd={vf.addPasted} inp={inp} />
          {setupOpen && (
            <div className="mt-3 border-t border-slate-200 pt-3">
              <p className="text-xs text-slate-500 mb-2">One bookmark copies your portal sign-in to the clipboard — paste it here to unlock every saved sheet for download:</p>
              <VendorBookmarklet />
              <p className="text-[11px] text-slate-400 mt-2">First time on a portal, or the bookmark can't reach your sign-in? Open one sheet, copy its link from the browser's Downloads page (Ctrl+J → right-click → Copy link address), then use “paste a link instead” → “Add to board” to save it.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
