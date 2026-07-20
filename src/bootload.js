// Boot-time read loaders and their row mappers, out of App.jsx (ADR 0026) so
// the boot sequence is unit-testable. Every loader takes the supabase client
// as a required first param; this module must never import ./lib/supabase.js —
// that file reads import.meta.env at evaluation (Vite-only) and would crash
// node --test, besides dragging the client SDK into a dependency-free suite.
import { fetchAllRows } from "./fetchall.js";
import { normStockItem } from "./stock.js";
import { normLabel } from "./labels.js";
import { normalizeSettings, serializeSettings, catalogHasSeedUnderlayments } from "./catalog.js";

export const SHARED_SETTINGS_ID = "singleton";

// The light list row: everything the sidebar draws/searches/sorts, projected out
// of the jsonb server-side. Shared by the initial load and server-side search.
export const LIST_SELECT = "id, created_at, updated_at, customer_id, name:data->>name, address:data->>address, phone:data->>phone, email:data->>email, quick:data->>quick";
export const lightRow = (r) => ({
  id: r.id,
  customerId: r.customer_id ?? null,
  createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
  name: r.name || "", address: r.address || "", phone: r.phone || "", email: r.email || "",
  // ->> projects the jsonb boolean out as text "true"/"false" (or null).
  quick: r.quick === true || r.quick === "true",
  _full: false,
});

// Customer (person) rows: contact info lives in the data jsonb; builder_id is a
// real column.
export const PERSON_SELECT = "id, created_at, updated_at, builder_id, name:data->>name, phone:data->>phone, email:data->>email, address:data->>address, notes:data->>notes";
export const personRow = (r) => ({ id: r.id, builderId: r.builder_id ?? null, name: r.name || "", phone: r.phone || "", email: r.email || "", address: r.address || "", notes: r.notes || "", createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(), updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now() });
export const builderRow = (r) => ({ id: r.id, name: r.name || "" });

// Fetch every project, but LIGHT: only the fields the list draws/searches/
// sorts, projected out of the jsonb server-side. The heavy detail stays on the
// server until a project is opened (loadDetail in App.jsx).
export const loadProjects = async (db) => {
  const { data: rows, error } = await db.from("projects").select(LIST_SELECT);
  if (error) throw error;
  return (rows || []).map(lightRow);
};
// People (customers) and builders are small — load them whole. Best-effort:
// an install that hasn't run supabase/migrate-hierarchy.sql yet just gets
// empty lists (the projects list still works on its own).
export const loadPeople = async (db) => {
  try {
    const { data: rows, error } = await db.from("customers").select(PERSON_SELECT);
    if (error) throw error;
    return (rows || []).map(personRow);
  } catch (x) { return []; }
};
export const loadBuilders = async (db) => {
  try {
    const { data: rows, error } = await db.from("builders").select("id, name");
    if (error) throw error;
    return (rows || []).map(builderRow);
  } catch (x) { return []; }
};

// The one shared settings record every signed-in user reads and writes
// (ADR 0002). Read and seed are split so the read can run in parallel with the
// app_data blob whose settings are the seed fallback.
export const loadSettingsRow = async (db) => {
  const { data: row, error } = await db.from("shared_settings").select("data").eq("id", SHARED_SETTINGS_ID).maybeSingle();
  if (error) throw error;
  return row;
};
// Persist when the stored record is missing, still pre-catalog, or lacks any
// of the starter underlayments, so the backfilled catalog (with stable ids)
// becomes the canonical shared copy.
export const resolveSharedSettings = async (db, row, fallbackRaw) => {
  const hasRow = row?.data && Object.keys(row.data).length;
  const settings = normalizeSettings(hasRow ? row.data : fallbackRaw);
  if (!hasRow || !row.data.catalog || !catalogHasSeedUnderlayments(row.data.catalog)) {
    try { await db.from("shared_settings").upsert({ id: SHARED_SETTINGS_ID, data: serializeSettings(settings) }, { onConflict: "id" }); } catch (x) { /* best-effort seed */ }
  }
  return settings;
};

export const loadStock = async (db) => {
  // select * so the app keeps working whether or not the disabled column
  // exists yet (pricebook-disabled.sql); a named select of a missing column
  // errors and would silently kill the SKU picker.
  const rows = await fetchAllRows(() => db.from("stock_items").select("*").order("sku"));
  return rows.map(normStockItem);
};

export const normBook = (row) => ({
  id: row.id, kind: row.kind || "order", name: row.name || "",
  active: row.active !== false, data: row.data || {},
  updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
});

export const loadBooks = async (db) => {
  const { data: rows, error } = await db.from("price_books").select("id, kind, name, active, data, updated_at");
  if (error) throw error;
  return (rows || []).map(normBook);
};

export const todoFromRow = (r) => ({ id: r.id, position: r.position ?? 0, text: r.data?.text || "", done: !!r.data?.done, doneAt: r.data?.doneAt || null, createdBy: r.data?.createdBy || "", createdAt: r.data?.createdAt || null });
export const loadTodos = async (db) => {
  const { data: rows, error } = await db.from("todos").select("id, position, data").order("position");
  if (error) throw error;
  return (rows || []).map(todoFromRow);
};

// Labels page with fetchAllRows since the shared set can exceed the 1000-row cap.
export const loadLabels = async (db) => {
  const rows = await fetchAllRows(() => db.from("labels").select("id, position, data").order("position"));
  return rows.map((r) => normLabel({ id: r.id, position: r.position ?? 0, ...(r.data || {}) }));
};
