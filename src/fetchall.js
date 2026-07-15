// Supabase (PostgREST) silently caps every select at 1000 rows unless the
// query pages through with .range(). A whole-table load that ignores this
// truncates quietly — the VTC core book's import diff read only the first
// 1000 items and reported everything past the cap as "new" forever.
//
// `buildQuery` must return a FRESH query each call (builders are single-use)
// and should include a stable .order() so pages don't skip or repeat rows.
export const PAGE_ROWS = 1000;

export async function fetchAllRows(buildQuery) {
  const out = [];
  for (let from = 0; ; from += PAGE_ROWS) {
    const { data: rows, error } = await buildQuery().range(from, from + PAGE_ROWS - 1);
    if (error) throw error;
    out.push(...(rows || []));
    if (!rows || rows.length < PAGE_ROWS) return out;
  }
}
