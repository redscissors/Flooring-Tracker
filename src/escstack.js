// One global Escape ladder: every open layer (menu, popover, modal, workspace,
// mobile sheet) registers a close handler while it's open, and Escape closes
// ONLY the most recently opened one — so repeated presses walk back layer by
// layer until the main screen (App registers navigation as the always-active
// bottom entry: project → customer → home). A press from inside a text-entry
// field blurs it AND closes the top layer in the same press (2026-07-22 —
// the old blur-first step made every popup two Escapes to leave); field-local
// Escape semantics (closing a search panel, cancelling a rename) keep
// precedence by calling ev.preventDefault(), which stops the ladder for that
// press. SELECT stays blur-only: a native dropdown's Escape close is
// indistinguishable from a plain press, and closing a layer under it would
// eat the dismiss.
// No react import — node --test drives this file; the useEscClose hook that
// components register through lives in widgets.jsx.
const stack = [];

export const isTextEntry = (el) => !!(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable));

export function handleEscKey(ev) {
  if (ev.key !== "Escape" || ev.repeat || ev.defaultPrevented || ev.isComposing) return;
  if (isTextEntry(ev.target)) {
    ev.target.blur();
    if (ev.target.tagName === "SELECT") return;
  }
  const top = stack[stack.length - 1];
  if (top) top.fn(ev);
}

let bound = false;
// Imperative registration (the card/todo drags). Returns the unregister
// function; the caller pops when its gesture ends.
export function escPush(fn) {
  if (!bound) { bound = true; window.addEventListener("keydown", handleEscKey); }
  const entry = { fn };
  stack.push(entry);
  return () => { const i = stack.indexOf(entry); if (i !== -1) stack.splice(i, 1); };
}
