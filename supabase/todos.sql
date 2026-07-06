-- Team to-do / issue list (issue 006)
-- Run once in your Supabase project: Dashboard -> SQL Editor -> paste -> Run.
--
-- One row per item on the shared team list (bugs, feature ideas, shop
-- reminders). Same trust model as customers / shared_settings: every
-- signed-in user can add, edit, complete, reorder, and delete every item.
--
-- `position` orders the open items (smaller = higher on the list); the app
-- renumbers on drag-reorder. Everything else lives in `data` jsonb:
--   { text, done, doneAt, createdBy, createdAt }

create table if not exists public.todos (
  id         text primary key,
  position   double precision not null default 0,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.todos enable row level security;

drop policy if exists "todo select" on public.todos;
create policy "todo select" on public.todos
  for select to authenticated using (true);

drop policy if exists "todo insert" on public.todos;
create policy "todo insert" on public.todos
  for insert to authenticated with check (true);

drop policy if exists "todo update" on public.todos;
create policy "todo update" on public.todos
  for update to authenticated using (true) with check (true);

drop policy if exists "todo delete" on public.todos;
create policy "todo delete" on public.todos
  for delete to authenticated using (true);

-- Reuses set_updated_at() from schema.sql.
drop trigger if exists todos_updated_at on public.todos;
create trigger todos_updated_at
  before update on public.todos
  for each row execute function public.set_updated_at();
