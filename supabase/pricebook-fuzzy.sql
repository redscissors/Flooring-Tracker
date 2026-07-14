-- Price book library — fuzzy selection-row search (ADR 0009 §6, Option A + D)
-- Run once, AFTER supabase/pricebook-search.sql (needs pg_trgm + the generated
-- search_text column). Dashboard -> SQL Editor -> Run. Safe to re-run.
--
-- Today the selection-row picker matches order items by exact substring
-- (search_text ILIKE '%word%'), so a misspelled or nickname query finds
-- nothing. This adds a trigram-similarity search: a query word matches when it
-- is *approximately* present, so "reducar" still finds "Reducer".
--
-- Option D (trade synonyms) lives in the app (src/synonyms.js) so the
-- vocabulary is easy to edit without a SQL change. The picker expands each
-- typed word into a GROUP of alternates and sends the groups as jsonb, e.g.
--   [["reducer","t-molding","stairnose","threshold"], ["oak"]]
-- A row matches when EVERY group has at least one alternate whose trigram
-- word_similarity to the row's text clears p_threshold. Rows are ranked by the
-- sum of each group's best similarity, so exact hits (~1.0) sort to the top.
--
-- word_similarity(short, long) scores the query word against the best-matching
-- span of the row's text — the right measure for "does this word roughly appear
-- here", where plain similarity() would punish long descriptions.
--
-- security invoker (the default) keeps table RLS: a caller only ever gets rows
-- their price_book_items policy already allows.

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

-- Perf note: the existing gin_trgm_ops index on search_text accelerates the
-- `<%` OPERATOR form, not the word_similarity(...) >= x function form used above
-- for a clean per-call threshold. At the current library size (~6,800 rows for
-- the VTC book) a scan is well under 100ms. If the library ever grows to tens
-- of thousands of rows, switch the WHERE clause to `alt <% (search_text || ...)`
-- and set the threshold via set_limit()/pg_trgm.word_similarity_threshold to
-- stay index-backed.
