-- run once: project numbers (N100) — spec docs/superpowers/specs/2026-08-14-project-numbers-design.md
-- Adds projects.project_no (unique, permanent), backfills existing real-named
-- projects oldest-first from 100, and installs the claim RPC the app calls on
-- a project's first real name. The name test mirrors src/model.js
-- isRealProjectName: blank, 'New Project' and quick auto-names never number.

alter table public.projects add column if not exists project_no integer;
create unique index if not exists projects_project_no_key on public.projects (project_no);

-- Backfill, guarded so a re-run can never renumber anything.
do $$
begin
  if not exists (select 1 from public.projects where project_no is not null) then
    update public.projects p set project_no = s.n
    from (
      select id, 99 + row_number() over (order by created_at, id) as n
      from public.projects
      where coalesce(trim(data->>'name'), '') <> ''
        and trim(data->>'name') not in ('New Project', 'Quick price')
        and trim(data->>'name') !~ '^Q-.*-\d{1,2}/\d{1,2}$'
    ) s
    where p.id = s.id;
  end if;
end $$;

create sequence if not exists public.project_no_seq;
select setval('public.project_no_seq', coalesce((select max(project_no) from public.projects), 99));
grant usage, select on sequence public.project_no_seq to authenticated;

-- Atomic + idempotent: the first caller mints, every later call (retries, the
-- per-keystroke name field, a second device) reads the same number back.
-- security invoker — the update runs under the caller's own RLS rights.
create or replace function public.claim_project_no(pid text) returns integer
language sql as $$
  update public.projects set project_no = nextval('public.project_no_seq')
    where id = pid and project_no is null;
  select project_no from public.projects where id = pid;
$$;
