import { useState } from "react";
import { supabase } from "./lib/supabase.js";
import { loadClaudeIssues } from "./bootload.js";
import { uid } from "./model.js";

// Central Claude issue list state + write paths (issue 087). Shaped like
// useTodos: shared rows, optimistic local update, one write per action. New
// issues land on top (the list reads newest-first); done items keep their row.
export function useClaudeIssues({ user, profile, ping, flashSaved }) {
  const [claudeIssues, setClaudeIssues] = useState([]);

  const issueData = (t) => ({ text: t.text, source: t.source, done: t.done, doneAt: t.doneAt, createdBy: t.createdBy, createdAt: t.createdAt });
  const refreshClaudeIssues = () => { loadClaudeIssues(supabase).then(setClaudeIssues).catch(() => { }); };

  const addClaudeIssue = (text, source) => {
    const t = { id: uid(), text: (text || "").trim(), source: source || { kind: "general" }, done: false, doneAt: null, createdBy: profile.name || user.email || "", createdAt: Date.now() };
    setClaudeIssues((prev) => [t, ...prev]);
    (async () => { try { const { error } = await supabase.from("claude_issues").insert({ id: t.id, data: issueData(t) }); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — run supabase/claude-issues.sql?"); } })();
    return t;
  };
  const updateClaudeIssue = (id, patch) => {
    const next = claudeIssues.map((t) => t.id === id ? { ...t, ...patch } : t);
    setClaudeIssues(next);
    const t = next.find((x) => x.id === id);
    (async () => { try { const { error } = await supabase.from("claude_issues").update({ data: issueData(t) }).eq("id", id); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — check connection"); } })();
  };
  const toggleClaudeIssue = (id) => {
    const t = claudeIssues.find((x) => x.id === id);
    if (!t) return;
    updateClaudeIssue(id, t.done ? { done: false, doneAt: null } : { done: true, doneAt: Date.now() });
  };
  const delClaudeIssue = (id) => {
    setClaudeIssues((prev) => prev.filter((t) => t.id !== id));
    (async () => { try { const { error } = await supabase.from("claude_issues").delete().eq("id", id); if (error) throw error; } catch (e) { ping("Delete failed"); } })();
  };
  const clearDoneClaudeIssues = () => {
    const ids = claudeIssues.filter((t) => t.done).map((t) => t.id);
    if (!ids.length) return;
    setClaudeIssues((prev) => prev.filter((t) => !t.done));
    (async () => { try { const { error } = await supabase.from("claude_issues").delete().in("id", ids); if (error) throw error; } catch (e) { ping("Delete failed"); } })();
  };

  return {
    claudeIssues, hydrateClaudeIssues: setClaudeIssues, refreshClaudeIssues,
    addClaudeIssue, updateClaudeIssue, toggleClaudeIssue, delClaudeIssue, clearDoneClaudeIssues,
  };
}
