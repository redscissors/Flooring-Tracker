-- Central Claude issue list (issue 087)
-- Run once in your Supabase project: Dashboard -> SQL Editor -> paste -> Run.
--
-- One row per "Flag for Claude" from anywhere in the app — a job line's
-- right-click menu, a price book's Claude button, or a general note typed on
-- the Issues & To-Do modal's Claude tab. Same trust model as todos: every
-- signed-in user can add, complete, and delete every issue.
--
-- Everything lives in `data` jsonb (see src/claudeissues.js):
--   { text, source: { kind: "job"|"book"|"general", custId, custName,
--     areaName, productId, bookId, bookName, sku, snapshot }, done, doneAt,
--     createdBy, createdAt }
-- `snapshot` freezes the flagged row at flag time, so the copy report stays
-- meaningful after the row is edited or deleted.

create table if not exists public.claude_issues (
  id         text primary key,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.claude_issues enable row level security;

drop policy if exists "claude issue select" on public.claude_issues;
create policy "claude issue select" on public.claude_issues
  for select to authenticated using (true);

drop policy if exists "claude issue insert" on public.claude_issues;
create policy "claude issue insert" on public.claude_issues
  for insert to authenticated with check (true);

drop policy if exists "claude issue update" on public.claude_issues;
create policy "claude issue update" on public.claude_issues
  for update to authenticated using (true) with check (true);

drop policy if exists "claude issue delete" on public.claude_issues;
create policy "claude issue delete" on public.claude_issues
  for delete to authenticated using (true);

-- Reuses set_updated_at() from schema.sql.
drop trigger if exists claude_issues_updated_at on public.claude_issues;
create trigger claude_issues_updated_at
  before update on public.claude_issues
  for each row execute function public.set_updated_at();
