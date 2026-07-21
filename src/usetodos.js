import { useState } from "react";
import { supabase } from "./lib/supabase.js";
import { loadTodos } from "./bootload.js";
import { uid } from "./model.js";

export function useTodos({ user, profile, ping, flashSaved, setSidebarOpen }) {
  // Team to-do / issue list (issue 006): shared rows, loaded in the background
  // after first paint for the sidebar badge and refreshed on every open.
  const [todos, setTodos] = useState([]);
  const [showTodos, setShowTodos] = useState(false);

  // Team to-do / issue list (issue 006): every item is its own shared row.
  // Open items order by `position` (smaller = higher); a drag renumbers all
  // open items 0..n-1 and writes them in one upsert. Done items keep their row
  // and sort by completion time instead.
  const todoData = (t) => ({ text: t.text, done: t.done, doneAt: t.doneAt, createdBy: t.createdBy, createdAt: t.createdAt });
  const openTodos = () => {
    setShowTodos(true); setSidebarOpen(false);
    // Refresh so the list shows what teammates added since load.
    loadTodos(supabase).then(setTodos).catch(() => { });
  };
  const addTodo = (text) => {
    const top = Math.min(0, ...todos.filter((t) => !t.done).map((t) => t.position));
    const t = { id: uid(), position: top - 1, text, done: false, doneAt: null, createdBy: profile.name || user.email || "", createdAt: Date.now() };
    setTodos((prev) => [t, ...prev]);
    (async () => { try { const { error } = await supabase.from("todos").insert({ id: t.id, position: t.position, data: todoData(t) }); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — run supabase/todos.sql?"); } })();
  };
  const updateTodo = (id, patch) => {
    const next = todos.map((t) => t.id === id ? { ...t, ...patch } : t);
    setTodos(next);
    const t = next.find((x) => x.id === id);
    (async () => { try { const { error } = await supabase.from("todos").update({ position: t.position, data: todoData(t) }).eq("id", id); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — check connection"); } })();
  };
  const toggleTodo = (id) => {
    const t = todos.find((x) => x.id === id);
    if (!t) return;
    // Reopening puts the item back on top so it gets looked at again.
    updateTodo(id, t.done
      ? { done: false, doneAt: null, position: Math.min(0, ...todos.filter((x) => !x.done).map((x) => x.position)) - 1 }
      : { done: true, doneAt: Date.now() });
  };
  const delTodo = (id) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    (async () => { try { const { error } = await supabase.from("todos").delete().eq("id", id); if (error) throw error; } catch (e) { ping("Delete failed"); } })();
  };
  const clearDoneTodos = () => {
    const ids = todos.filter((t) => t.done).map((t) => t.id);
    if (!ids.length) return;
    setTodos((prev) => prev.filter((t) => !t.done));
    (async () => { try { const { error } = await supabase.from("todos").delete().in("id", ids); if (error) throw error; } catch (e) { ping("Delete failed"); } })();
  };
  // `from`/`to` index into the open list; `to` counts positions with the moved
  // item already lifted out (same convention as moveProduct).
  const reorderTodos = (from, to) => {
    const open = todos.filter((t) => !t.done).sort((a, b) => a.position - b.position);
    const [moved] = open.splice(from, 1);
    if (!moved) return;
    open.splice(to, 0, moved);
    const pos = new Map(open.map((t, i) => [t.id, i]));
    const next = todos.map((t) => pos.has(t.id) ? { ...t, position: pos.get(t.id) } : t);
    setTodos(next);
    const rows = next.filter((t) => pos.has(t.id)).map((t) => ({ id: t.id, position: t.position, data: todoData(t) }));
    (async () => { try { const { error } = await supabase.from("todos").upsert(rows, { onConflict: "id" }); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — check connection"); } })();
  };

  return {
    todos, hydrateTodos: setTodos,
    showTodos, setShowTodos,
    openTodos, addTodo, updateTodo, toggleTodo, delTodo, clearDoneTodos, reorderTodos,
  };
}
