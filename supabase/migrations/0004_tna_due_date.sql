-- 0004_tna_due_date.sql — a TNA submission deadline for the cycle scheduler.
-- Nullable + additive: null = no deadline = always on time. Safe to re-run.
alter table public.tna_assessment add column if not exists due_date date;
