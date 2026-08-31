import { useState } from "react";
import { supabase } from "./lib/supabase.js";
import { loadSampleRequests } from "./bootload.js";

// Sample-request state + write paths (spec 2026-08-28). Shaped like
// useClaudeIssues: shared rows, optimistic local update, one write per action.
// setSampleOrdered takes an ID LIST so "Mark all ordered" is one upsert, not a
// write per row.
export function useSamples({ user, profile, ping, flashSaved }) {
  const [sampleRequests, setSampleRequests] = useState([]);

  const reqData = ({ id, ...rest }) => rest;
  const refreshSampleRequests = () => { loadSampleRequests(supabase).then(setSampleRequests).catch(() => { }); };

  const addSampleRequest = (req) => {
    setSampleRequests((prev) => [req, ...prev]);
    (async () => { try { const { error } = await supabase.from("sample_requests").insert({ id: req.id, data: reqData(req) }); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — run supabase/samples.sql?"); } })();
  };
  const delSampleRequest = (id) => {
    setSampleRequests((prev) => prev.filter((r) => r.id !== id));
    (async () => { try { const { error } = await supabase.from("sample_requests").delete().eq("id", id); if (error) throw error; } catch (e) { ping("Delete failed"); } })();
  };
  const setSampleOrdered = (ids, ordered) => {
    const set = new Set(ids);
    const stamp = ordered
      ? { status: "ordered", orderedBy: profile.name || user.email || "", orderedAt: Date.now() }
      : { status: "need", orderedBy: "", orderedAt: null };
    const next = sampleRequests.map((r) => set.has(r.id) ? { ...r, ...stamp } : r);
    setSampleRequests(next);
    const rows = next.filter((r) => set.has(r.id)).map((r) => ({ id: r.id, data: reqData(r) }));
    (async () => { try { const { error } = await supabase.from("sample_requests").upsert(rows, { onConflict: "id" }); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — check connection"); } })();
  };

  return {
    sampleRequests, hydrateSampleRequests: setSampleRequests, refreshSampleRequests,
    addSampleRequest, delSampleRequest, setSampleOrdered,
  };
}
