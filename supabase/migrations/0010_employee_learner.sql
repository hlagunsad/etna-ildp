-- 0010_employee_learner.sql — only employees are learners.
--
-- take_own_tna (the self-assessment / learner-scope capability) becomes employees-only: drop it
-- from supervisor + hr_admin, and align default_has_cap (the fallback that mirrors DEFAULT_MATRIX
-- in src/lib/permissions.ts — KEEP THE TWO IN SYNC). The "tna employee progress" RLS policy
-- already gates writes on app_has_cap('take_own_tna'), so supervisors/HR can't take a TNA even if
-- they somehow had a cycle. Idempotent.

delete from public.role_permission where capability = 'take_own_tna' and role in ('supervisor', 'hr_admin');

create or replace function public.default_has_cap(p_role text, cap text)
returns boolean language sql immutable set search_path = public as $$
  select case
    when p_role = 'super_admin' then true
    when p_role = 'hr_admin' then cap <> 'take_own_tna'
    when p_role = 'supervisor' then cap in ('validate_tna', 'endorse_ildp', 'view_team')
    when p_role = 'employee' then cap = 'take_own_tna'
    else false
  end;
$$;
