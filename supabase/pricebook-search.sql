-- Price book library — fast selection-row search (ADR 0009 §6)
-- Run once, AFTER supabase/pricebooks.sql: Dashboard -> SQL Editor -> Run.
-- Safe to run before or after order books hold any data, and safe to re-run.
--
-- The selection-row SKU/product pickers search special-order items with a
-- server-side query (order books run to thousands of rows — the VTC list alone
-- is ~6,800 — so they are never eagerly loaded). Without this migration that
-- query still works via a per-field ILIKE over the jsonb (the app falls back
-- automatically), but every keystroke is a sequential scan. This adds the
-- generated search column §6 specifies plus a trigram GIN index so the search
-- stays instant as the library grows.
--
-- search_text is a STORED generated column: Postgres recomputes it on every
-- insert/upsert, so it can never drift from data — imports need no extra step.

create extension if not exists pg_trgm;

alter table public.price_book_items
  add column if not exists search_text text
  generated always as (
    lower(
      coalesce(sku, '') || ' ' ||
      coalesce(data->>'description', '') || ' ' ||
      coalesce(data->>'product', '') || ' ' ||
      coalesce(data->>'brand', '') || ' ' ||
      coalesce(data->>'mfg', '') || ' ' ||
      coalesce(data->>'color', '')
    )
  ) stored;

-- Trigram GIN index: makes `search_text ILIKE '%term%'` (substring, the pattern
-- the pickers issue) index-backed instead of a full scan.
create index if not exists price_book_items_search_trgm
  on public.price_book_items using gin (search_text gin_trgm_ops);
