-- 0011_rebrand_notifications.sql — rebrand the in-app notification text to the Caliber
-- vocabulary ("Competency Assessment" / "Growth Plan").
--
-- TEXT ONLY: redefines the four notification trigger functions from 0005 with new wording.
-- No schema change, no new objects. The function names, trigger names, and the link keys
-- ('tna' / 'ildp' / 'dashboard' — internal Shell tab keys) are intentionally unchanged, so
-- the existing triggers pick up the new text automatically. Idempotent (create or replace).

-- Assessment validated → notify the cycle owner.
create or replace function public.notify_tna_validated()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'validated' and old.status is distinct from 'validated' then
    perform public.notify(public.cycle_owner(new.dev_cycle_id),
      'Competency Assessment validated', 'Your Competency Assessment was validated — your Growth Plan is ready.', 'ildp');
  end if;
  return new;
end;
$$;

-- Growth Plan endorsed / approved → notify the cycle owner.
create or replace function public.notify_ildp_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending_approval' and old.status is distinct from 'pending_approval' then
    perform public.notify(public.cycle_owner(new.dev_cycle_id),
      'Growth Plan endorsed', 'Your Growth Plan was endorsed and is awaiting approval.', 'ildp');
  elsif new.status = 'active' and old.status is distinct from 'active' then
    perform public.notify(public.cycle_owner(new.dev_cycle_id),
      'Growth Plan approved', 'Your Growth Plan was approved — it is now active.', 'ildp');
  end if;
  return new;
end;
$$;

-- Cycle opened (insert) → notify the owner.
create or replace function public.notify_cycle_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(new.user_id,
    'Development cycle opened', 'A development cycle was opened for you — start your baseline Competency Assessment.', 'tna');
  return new;
end;
$$;

-- Cycle advanced / closed → notify the owner.
create or replace function public.notify_cycle_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.current_year is distinct from old.current_year then
    perform public.notify(new.user_id,
      'Cycle advanced', 'Your cycle advanced to Year ' || new.current_year || ' — a new Competency Assessment is open.', 'tna');
  elsif new.status in ('passed','carry_over') and old.status is distinct from new.status then
    perform public.notify(new.user_id,
      'Cycle closed', 'Your development cycle closed: ' || replace(new.status, '_', '-') || '.', 'dashboard');
  end if;
  return new;
end;
$$;
