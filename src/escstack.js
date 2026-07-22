// One global Escape ladder: every open layer (menu, popover, modal, workspace,
// mobile sheet) registers a close handler while it's open, and Escape closes
// ONLY the most recently opened one — so repeated presses walk back layer by
// layer until the main screen (App registers navigation as the always-active
// bottom entry: project → customer → home). A press whose target is a
// text-entry field only blurs it: field-local Escape semantics (closing a
// search panel, cancelling a rename) stay on the element, and the next press
// starts closing layers.
// No react import — node --test drives this file; the useEscClose hook that
// components register through lives in widgets.jsx.
const stack = [];

export const isTextEntry = (el) => !!(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable));

export function handleEscKey(ev) {
  if (ev.key !== "Escape" || ev.repeat || ev.defaultPrevented) return;
  if (isTextEntry(ev.target)) { ev.target.blur(); return; }
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
