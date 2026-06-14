-- 0007_drop_department.sql — remove the now-dead profiles.department column.
-- Superseded by the org_unit hierarchy (migration 0006): no app code, trigger, function,
-- or RLS policy reads profiles.department, and the values were backfilled into org_unit.
-- (job_role.department is a SEPARATE column — the role's department hint — and is kept.)
-- Idempotent.

alter table public.profiles drop column if exists department;
