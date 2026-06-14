-- 0005_notification.sql — in-app notifications.
-- Users read + mark-read their OWN notifications; only the SECURITY DEFINER triggers below
-- create them (no forging). Email delivery is stubbed (out of scope). Idempotent.

create table if not exists public.notification (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  body         text,
  link         text,            -- a Shell tab key (dashboard / tna / ildp …)
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists notification_recipient_idx on public.notification(recipient_id, created_at desc);

alter table public.notification enable row level security;
drop policy if exists "notification own read" on public.notification;
create policy "notification own read" on public.notification for select to authenticated
  using (recipient_id = auth.uid());
drop policy if exists "notification own update" on public.notification;
create policy "notification own update" on public.notification for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
-- No INSERT/DELETE policy: only the SECURITY DEFINER triggers insert.

-- Insert helper (SECURITY DEFINER → bypasses RLS). No-op if recipient is null.
create or replace function public.notify(p_recipient uuid, p_title text, p_body text, p_link text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_recipient is null then return; end if;
  insert into public.notification (recipient_id, title, body, link)
  values (p_recipient, p_title, p_body, p_link);
end;
$$;

-- TNA validated → notify the cycle owner.
create or replace function public.notify_tna_validated()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'validated' and old.status is distinct from 'validated' then
    perform public.notify(public.cycle_owner(new.dev_cycle_id),
      'TNA validated', 'Your TNA was validated — your development plan is ready.', 'ildp');
  end if;
  return new;
end;
$$;
drop trigger if exists on_tna_validated on public.tna_assessment;
create trigger on_tna_validated after update on public.tna_assessment
  for each row execute function public.notify_tna_validated();

-- ILDP endorsed / approved → notify the cycle owner.
create or replace function public.notify_ildp_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending_approval' and old.status is distinct from 'pending_approval' then
    perform public.notify(public.cycle_owner(new.dev_cycle_id),
      'ILDP endorsed', 'Your ILDP was endorsed and is awaiting approval.', 'ildp');
  elsif new.status = 'active' and old.status is distinct from 'active' then
    perform public.notify(public.cycle_owner(new.dev_cycle_id),
      'ILDP approved', 'Your ILDP was approved — it is now active.', 'ildp');
  end if;
  return new;
end;
$$;
drop trigger if exists on_ildp_status on public.ildp;
create trigger on_ildp_status after update on public.ildp
  for each row execute function public.notify_ildp_status();

-- Cycle opened (insert) → notify the owner.
create or replace function public.notify_cycle_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(new.user_id,
    'Development cycle opened', 'A development cycle was opened for you — start your baseline TNA.', 'tna');
  return new;
end;
$$;
drop trigger if exists on_cycle_insert on public.dev_cycle;
create trigger on_cycle_insert after insert on public.dev_cycle
  for each row execute function public.notify_cycle_insert();

-- Cycle advanced / closed → notify the owner.
create or replace function public.notify_cycle_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.current_year is distinct from old.current_year then
    perform public.notify(new.user_id,
      'Cycle advanced', 'Your cycle advanced to Year ' || new.current_year || ' — a new TNA is open.', 'tna');
  elsif new.status in ('passed','carry_over') and old.status is distinct from new.status then
    perform public.notify(new.user_id,
      'Cycle closed', 'Your development cycle closed: ' || replace(new.status, '_', '-') || '.', 'dashboard');
  end if;
  return new;
end;
$$;
drop trigger if exists on_cycle_update on public.dev_cycle;
create trigger on_cycle_update after update on public.dev_cycle
  for each row execute function public.notify_cycle_update();
