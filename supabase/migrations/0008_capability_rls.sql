-- 0008_capability_rls.sql — make the configurable permission matrix (role_permission)
-- authoritative at the RLS layer for the capability-shaped WRITE actions.
--
-- Until now RLS was purely scope-based (is_admin / is_manager_of / owner); revoking a
-- capability was enforced only in the app + privileged routes — NOT for the client-direct
-- endorse / approve / library writes, which have no route gate. This closes that gap.
--
-- Lockout-proof: super_admin is always allowed (it has zero role_permission rows by design),
-- and the role_permission WRITE policy stays hardcoded to super_admin (migration 0003), so an
-- admin can always re-grant. Reads stay role-structural by design. Idempotent.

-- default_has_cap: mirrors DEFAULT_MATRIX in src/lib/permissions.ts — KEEP THE TWO IN SYNC.
create or replace function public.default_has_cap(p_role text, cap text)
returns boolean language sql immutable set search_path = public as $$
  select case
    when p_role in ('super_admin','hr_admin') then true
    when p_role = 'supervisor' then cap in ('take_own_tna','validate_tna','endorse_ildp','view_team')
    when p_role = 'employee' then cap = 'take_own_tna'
    else false
  end;
$$;

-- app_has_cap: mirrors buildMatrix / hasCapability — super always true; a role with any rows is
-- authoritative; a role with no rows falls back to the built-in default.
create or replace function public.app_has_cap(cap text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.app_role() = 'super_admin' then true
    when exists (select 1 from public.role_permission where role = public.app_role())
      then exists (select 1 from public.role_permission where role = public.app_role() and capability = cap)
    else public.default_has_cap(public.app_role(), cap)
  end;
$$;

-- ── Capability-shaped WRITE policies: re-created verbatim + a single app_has_cap conjunct ────
-- (only ever RESTRICTS; the SoD/scope predicates are copied exactly from 0001).

drop policy if exists "tna employee progress" on public.tna_assessment;
create policy "tna employee progress" on public.tna_assessment for update to authenticated
  using (public.cycle_owner(dev_cycle_id) = auth.uid() and public.app_has_cap('take_own_tna') and status in ('not_started','in_progress'))
  with check (public.cycle_owner(dev_cycle_id) = auth.uid() and status in ('in_progress','submitted'));

drop policy if exists "tna validate (supervisor/hr)" on public.tna_assessment;
create policy "tna validate (supervisor/hr)" on public.tna_assessment for update to authenticated
  using ((public.is_manager_of(public.cycle_owner(dev_cycle_id)) or public.is_admin()) and public.app_has_cap('validate_tna') and status = 'submitted')
  with check (status = 'validated' and validated_by = auth.uid()
              and public.cycle_owner(dev_cycle_id) <> auth.uid());

drop policy if exists "ildp endorse" on public.ildp;
create policy "ildp endorse" on public.ildp for update to authenticated
  using (public.is_manager_of(public.cycle_owner(dev_cycle_id)) and public.app_has_cap('endorse_ildp') and status = 'pending_endorsement')
  with check (status = 'pending_approval' and endorsed_by = auth.uid()
              and public.cycle_owner(dev_cycle_id) <> auth.uid());

drop policy if exists "ildp approve" on public.ildp;
create policy "ildp approve" on public.ildp for update to authenticated
  using (public.is_admin() and public.app_has_cap('approve_ildp') and status = 'pending_approval')
  with check (status = 'active' and approved_by = auth.uid()
              and public.cycle_owner(dev_cycle_id) <> auth.uid());

-- ── Library reference-table writes: is_admin() → app_has_cap('manage_library') ───────────────
-- Same default set (super + hr), now revocable via the matrix. Mirrors the 0001 loop; org_unit
-- (from 0006) is included since it's authored in the same Library, gated by manage_library.
do $$
declare t text;
begin
  foreach t in array array['job_role','proficiency_scale','proficiency_level','competency',
                           'competency_level_descriptor','role_competency_target',
                           'assessment_item','training_resource','org_unit']
  loop
    execute format('drop policy if exists %I on public.%I;', t||'_admin', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.app_has_cap(''manage_library'')) with check (public.app_has_cap(''manage_library''));', t||'_admin', t);
  end loop;
end $$;
