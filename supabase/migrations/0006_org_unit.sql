-- 0006_org_unit.sql — structured org-unit hierarchy, replacing free-text profiles.department.
-- Safe expand: add org_unit + profiles.org_unit_id, backfill from the existing department
-- values, and LEAVE the (now unused) department column in place so there's no breakage
-- window during deploy. Dropping department is a trivial one-line follow-up. Idempotent.

create table if not exists public.org_unit (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  parent_id   uuid references public.org_unit(id) on delete restrict,
  created_at  timestamptz not null default now()
);
create index if not exists org_unit_parent_idx on public.org_unit(parent_id);

alter table public.org_unit enable row level security;
drop policy if exists "org_unit_read" on public.org_unit;
create policy "org_unit_read" on public.org_unit for select to authenticated using (true);
drop policy if exists "org_unit_admin" on public.org_unit;
create policy "org_unit_admin" on public.org_unit for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.profiles add column if not exists org_unit_id uuid references public.org_unit(id) on delete set null;
create index if not exists profiles_org_unit_idx on public.profiles(org_unit_id);

-- Backfill: one org_unit per distinct existing department, then link profiles to it.
insert into public.org_unit (name)
select distinct p.department
from public.profiles p
where p.department is not null and trim(p.department) <> ''
  and not exists (select 1 from public.org_unit o where o.name = p.department);

update public.profiles p
set org_unit_id = o.id
from public.org_unit o
where p.org_unit_id is null and p.department is not null and o.name = p.department;
