-- 0003_role_permission.sql — configurable RBAC.
-- A role × capability table that drives the app's permission matrix and the privileged
-- routes. Editable by Super Admin only. super_admin is intentionally NOT seeded here — it
-- is always granted in code (canWith / hasCapability), so it can never be locked out.
-- Idempotent: safe to re-run.

create table if not exists public.role_permission (
  role       text not null check (role in ('super_admin','hr_admin','supervisor','employee')),
  capability text not null,
  primary key (role, capability)
);

alter table public.role_permission enable row level security;

-- Read by any authenticated user (the client loads the matrix to gate the UI).
drop policy if exists "role_permission read" on public.role_permission;
create policy "role_permission read" on public.role_permission for select to authenticated using (true);

-- Written by Super Admin ONLY — a fixed check (not matrix-driven) so editing permissions
-- can never be revoked from super-admins, preventing a lockout.
drop policy if exists "role_permission write" on public.role_permission;
create policy "role_permission write" on public.role_permission for all to authenticated
  using (public.app_role() = 'super_admin') with check (public.app_role() = 'super_admin');

-- Seed the current defaults for hr_admin / supervisor / employee.
insert into public.role_permission (role, capability) values
  ('employee','take_own_tna'),
  ('supervisor','take_own_tna'),
  ('supervisor','validate_tna'),
  ('supervisor','endorse_ildp'),
  ('supervisor','view_team'),
  ('hr_admin','take_own_tna'),
  ('hr_admin','validate_tna'),
  ('hr_admin','endorse_ildp'),
  ('hr_admin','view_team'),
  ('hr_admin','approve_ildp'),
  ('hr_admin','view_org'),
  ('hr_admin','manage_users'),
  ('hr_admin','view_audit'),
  ('hr_admin','advance_year'),
  ('hr_admin','manage_library')
on conflict (role, capability) do nothing;
