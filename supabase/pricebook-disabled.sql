-- Per-item enable/disable switch (importer-upgrades spec 2026-07-14, PR A).
-- Run once on existing installs, BEFORE the PR merges — additive, default
-- false (= enabled), safe to re-run. Dashboard -> SQL Editor -> paste -> Run.
-- Fresh installs get the columns from pricebooks.sql / stock.sql and the
-- filtered search function from pricebook-fuzzy.sql; this file is the
-- catch-up for installs created before 2026-07-14.
--
-- `disabled` is a COLUMN, not a field in the data jsonb, on purpose: imports
-- rewrite the whole data jsonb but never mention this column, so the team's
-- choice survives every reimport. Three flags now coexist on an item:
--   active        was in the last import file   (import-controlled)
--   discontinued  vendor says it's dead         (vendor file / hand edit)
--   disabled      don't offer it in search      (team-controlled)

alter table public.price_book_items
  add column if not exists disabled boolean not null default false;
alter table public.stock_items
  add column if not exists disabled boolean not null default false;

-- Re-create the fuzzy selection-row search with the disabled filter (new-pick
-- path only — the snapshot-resolve queries elsewhere keep resolving disabled
-- SKUs so saved estimates are untouched). Needs the search_text column from
-- pricebook-search.sql; on an install without it this statement errors, but
-- the column adds above have already landed — run the search/fuzzy files
-- first, then re-run this one.
create or replace function public.search_price_book_items(
  p_book_ids  text[],
  p_groups    jsonb,
  p_threshold real default 0.3,
  p_limit     int  default 40
)
returns setof public.price_book_items
language sql
stable
as $$
  select i.*
  from public.price_book_items i
  where i.book_id = any(p_book_ids)
    and i.active
    and not i.disabled
    and (
      -- every group must be satisfied by at least one of its alternates
      select bool_and(
        exists (
          select 1
          from jsonb_array_elements_text(grp) alt
          where word_similarity(
                  alt,
                  i.search_text || ' ' || coalesce(i.data->>'size', '')
                ) >= p_threshold
        )
      )
      from jsonb_array_elements(p_groups) grp
    )
  order by (
    -- rank by the summed best-per-group similarity (exact hits float up)
    select coalesce(sum(g.best), 0)
    from (
      select (
        select max(word_similarity(
                     alt,
                     i.search_text || ' ' || coalesce(i.data->>'size', '')))
        from jsonb_array_elements_text(grp) alt
      ) as best
      from jsonb_array_elements(p_groups) grp
    ) g
  ) desc
  limit p_limit;
$$;

grant execute on function public.search_price_book_items(text[], jsonb, real, int)
  to authenticated;
