-- eTNA → ILDP — schema, RBAC helpers, scoped RLS (with separation of duties), and the
-- DICT NICS domain seed. Run once in the Supabase SQL editor (SQL Editor → New query → Run).
-- Demo USERS are created separately by `npm run seed` (needs the secret key / admin API).

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- Access control --------------------------------------------------------------
create table if not exists public.job_role (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  department  text
);

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'employee'
                check (role in ('super_admin','hr_admin','supervisor','employee')),
  manager_id  uuid references public.profiles(id) on delete set null,  -- supervisor scope
  job_role_id uuid references public.job_role(id) on delete set null,
  department  text,
  status      text not null default 'active' check (status in ('invited','active','disabled')),
  created_at  timestamptz not null default now()
);
create index if not exists profiles_manager_idx on public.profiles(manager_id);

create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  actor_email text,
  action      text not null check (action in
                ('create','update','submit','validate','acknowledge','endorse','approve','advance_year')),
  entity_type text not null,
  entity_id   uuid,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_entity_idx on public.audit_log(entity_type, entity_id);

-- Competency library (reference; seeded) --------------------------------------
create table if not exists public.proficiency_scale (
  id   uuid primary key default gen_random_uuid(),
  name text not null
);

create table if not exists public.proficiency_level (
  id       uuid primary key default gen_random_uuid(),
  scale_id uuid not null references public.proficiency_scale(id) on delete cascade,
  rank     int  not null,             -- the single source of truth for all gap math
  label    text not null,
  unique (scale_id, rank)
);

create table if not exists public.competency (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  name        text not null,
  description text,
  category    text,
  comp_group  text check (comp_group in ('core','common','technical')),  -- "group" is reserved
  scale_id    uuid not null references public.proficiency_scale(id)
);

create table if not exists public.competency_level_descriptor (
  id            uuid primary key default gen_random_uuid(),
  competency_id uuid not null references public.competency(id) on delete cascade,
  level_id      uuid not null references public.proficiency_level(id) on delete cascade,
  indicator_text text not null,
  unique (competency_id, level_id)
);

-- Targets (reference; seeded) -------------------------------------------------
create table if not exists public.role_competency_target (
  id             uuid primary key default gen_random_uuid(),
  job_role_id    uuid not null references public.job_role(id) on delete cascade,
  competency_id  uuid not null references public.competency(id) on delete cascade,
  target_level_id uuid not null references public.proficiency_level(id),
  weight         int not null default 1,
  is_critical    boolean not null default false,
  unique (job_role_id, competency_id)
);

-- Cycle & assessment ----------------------------------------------------------
create table if not exists public.dev_cycle (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  start_date    date not null default current_date,
  end_date      date,
  baseline_year int not null,
  current_year  int not null default 1 check (current_year between 1 and 3),
  status        text not null default 'active'
                  check (status in ('active','review','passed','carry_over','closed')),
  snapshot_of_targets jsonb not null,   -- locked [{competencyId,targetRank,weight,isCritical}]
  created_at    timestamptz not null default now()
);
create index if not exists dev_cycle_user_idx on public.dev_cycle(user_id);

create table if not exists public.tna_assessment (
  id           uuid primary key default gen_random_uuid(),
  dev_cycle_id uuid not null references public.dev_cycle(id) on delete cascade,
  cycle_year   int not null check (cycle_year between 1 and 3),
  type         text not null check (type in ('baseline','annual')),
  method       text not null default 'self+validated',
  status       text not null default 'not_started'
                 check (status in ('not_started','in_progress','submitted','validated','finalized','returned')),
  submitted_at timestamptz,
  validated_by uuid references public.profiles(id),
  validated_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (dev_cycle_id, cycle_year)
);
create index if not exists tna_cycle_idx on public.tna_assessment(dev_cycle_id);

create table if not exists public.assessment_item (
  id            uuid primary key default gen_random_uuid(),
  competency_id uuid not null references public.competency(id) on delete cascade,
  prompt_text   text not null,
  response_type text not null default 'scale' check (response_type in ('scale','yes_no'))
);

create table if not exists public.tna_response (
  id               uuid primary key default gen_random_uuid(),
  tna_assessment_id uuid not null references public.tna_assessment(id) on delete cascade,
  item_id          uuid not null references public.assessment_item(id),
  raw_answer       text,
  derived_level_id uuid references public.proficiency_level(id),
  unique (tna_assessment_id, item_id)
);

create table if not exists public.competency_result (
  id               uuid primary key default gen_random_uuid(),
  tna_assessment_id uuid not null references public.tna_assessment(id) on delete cascade,
  competency_id    uuid not null references public.competency(id),
  assessed_level_id uuid references public.proficiency_level(id),
  assessed_rank    int,
  score            numeric,
  unique (tna_assessment_id, competency_id)
);
create index if not exists result_tna_idx on public.competency_result(tna_assessment_id);

-- Plan & training -------------------------------------------------------------
create table if not exists public.ildp (
  id              uuid primary key default gen_random_uuid(),
  dev_cycle_id    uuid not null unique references public.dev_cycle(id) on delete cascade,
  status          text not null default 'draft'
                    check (status in ('draft','pending_endorsement','pending_approval','active','completed','closed')),
  acknowledged_by uuid references public.profiles(id), acknowledged_at timestamptz,
  endorsed_by     uuid references public.profiles(id), endorsed_at timestamptz,
  approved_by     uuid references public.profiles(id), approved_at timestamptz,
  version         int not null default 1,
  created_at      timestamptz not null default now()
);

create table if not exists public.ildp_item (
  id                uuid primary key default gen_random_uuid(),
  ildp_id           uuid not null references public.ildp(id) on delete cascade,
  competency_id     uuid not null references public.competency(id),
  baseline_level_id uuid references public.proficiency_level(id),
  target_level_id   uuid references public.proficiency_level(id),
  current_level_id  uuid references public.proficiency_level(id),
  gap_size          int not null default 0,
  priority          int not null default 0,
  gap_status        text not null default 'open'
                      check (gap_status in ('open','improving','stalled','regressed','closed','new','retargeted')),
  item_status       text not null default 'open' check (item_status in ('open','in_progress','completed')),
  target_completion_date date,
  unique (ildp_id, competency_id)
);
create index if not exists ildp_item_ildp_idx on public.ildp_item(ildp_id);

create table if not exists public.training_resource (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  provider        text check (provider in ('internal','e-tesda','coursebank','external')),
  url             text,
  competency_id   uuid references public.competency(id),
  target_level_id uuid references public.proficiency_level(id),
  mode            text check (mode in ('online','classroom','on-the-job')),
  cost            numeric default 0
);

create table if not exists public.training_record (
  id                  uuid primary key default gen_random_uuid(),
  ildp_item_id        uuid not null references public.ildp_item(id) on delete cascade,
  training_resource_id uuid references public.training_resource(id),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  status              text not null default 'planned'
                        check (status in ('planned','in_progress','completed','verified')),
  started_at          timestamptz,
  completed_at        timestamptz,
  verified_by         uuid references public.profiles(id),
  evidence_url        text
);

-- Tracking --------------------------------------------------------------------
create table if not exists public.progress_snapshot (
  id            uuid primary key default gen_random_uuid(),
  dev_cycle_id  uuid not null references public.dev_cycle(id) on delete cascade,
  cycle_year    int not null,
  competency_id uuid not null references public.competency(id),
  assessed_rank int,
  target_rank   int,
  gap_size      int,
  gap_status    text,
  captured_at   timestamptz not null default now(),
  unique (dev_cycle_id, cycle_year, competency_id)
);
create index if not exists snapshot_cycle_idx on public.progress_snapshot(dev_cycle_id);

-- ============================================================================
-- 2. RBAC HELPERS (SECURITY DEFINER — read role/scope without tripping RLS)
-- ============================================================================
create or replace function public.app_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.app_role() in ('super_admin','hr_admin');
$$;

create or replace function public.is_manager_of(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = target and p.manager_id = auth.uid());
$$;

create or replace function public.cycle_owner(cid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select user_id from public.dev_cycle where id = cid;
$$;

-- Auto-create a profile on signup (default role employee).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'employee')
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ============================================================================
-- 3. ROW-LEVEL SECURITY
-- ============================================================================
alter table public.job_role                   enable row level security;
alter table public.profiles                   enable row level security;
alter table public.audit_log                  enable row level security;
alter table public.proficiency_scale          enable row level security;
alter table public.proficiency_level          enable row level security;
alter table public.competency                 enable row level security;
alter table public.competency_level_descriptor enable row level security;
alter table public.role_competency_target     enable row level security;
alter table public.dev_cycle                  enable row level security;
alter table public.tna_assessment             enable row level security;
alter table public.assessment_item            enable row level security;
alter table public.tna_response               enable row level security;
alter table public.competency_result          enable row level security;
alter table public.ildp                       enable row level security;
alter table public.ildp_item                  enable row level security;
alter table public.training_resource          enable row level security;
alter table public.training_record            enable row level security;
alter table public.progress_snapshot          enable row level security;

-- Reference tables: readable by all authenticated; writes admin-only (MVP seeds via this file).
do $$
declare t text;
begin
  foreach t in array array['job_role','proficiency_scale','proficiency_level','competency',
                           'competency_level_descriptor','role_competency_target',
                           'assessment_item','training_resource']
  loop
    execute format('create policy %I on public.%I for select to authenticated using (true);', t||'_read', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin());', t||'_admin', t);
  end loop;
end $$;

-- profiles: self + team (manager) + org (admin) read; self-update can't change own role; admin manage.
create policy "profiles read scoped" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin() or manager_id = auth.uid());
create policy "profiles self update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = public.app_role());
create policy "profiles admin manage" on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- A scope predicate reused across cycle-owned tables.
-- (owner self) OR (admin org) OR (manager of the owner)
-- dev_cycle
create policy "cycle read scoped" on public.dev_cycle for select to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.is_manager_of(user_id));
create policy "cycle admin manage" on public.dev_cycle for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- tna_assessment: read scoped; employee may progress own draft; SoD on validate.
create policy "tna read scoped" on public.tna_assessment for select to authenticated
  using (public.cycle_owner(dev_cycle_id) = auth.uid() or public.is_admin()
         or public.is_manager_of(public.cycle_owner(dev_cycle_id)));
create policy "tna employee progress" on public.tna_assessment for update to authenticated
  using (public.cycle_owner(dev_cycle_id) = auth.uid() and status in ('not_started','in_progress'))
  with check (public.cycle_owner(dev_cycle_id) = auth.uid() and status in ('in_progress','submitted'));
-- Separation of duties: a validator can never be the assessed user.
create policy "tna validate (supervisor/hr)" on public.tna_assessment for update to authenticated
  using ((public.is_manager_of(public.cycle_owner(dev_cycle_id)) or public.is_admin()) and status = 'submitted')
  with check (status = 'validated' and validated_by = auth.uid()
              and public.cycle_owner(dev_cycle_id) <> auth.uid());

-- tna_response: owner read/write while their TNA is open; scoped read for managers/admin.
create policy "response read scoped" on public.tna_response for select to authenticated
  using (exists (select 1 from public.tna_assessment a
                 where a.id = tna_assessment_id
                   and (public.cycle_owner(a.dev_cycle_id) = auth.uid() or public.is_admin()
                        or public.is_manager_of(public.cycle_owner(a.dev_cycle_id)))));
create policy "response owner write" on public.tna_response for all to authenticated
  using (exists (select 1 from public.tna_assessment a
                 where a.id = tna_assessment_id
                   and public.cycle_owner(a.dev_cycle_id) = auth.uid()
                   and a.status in ('not_started','in_progress')))
  with check (exists (select 1 from public.tna_assessment a
                 where a.id = tna_assessment_id
                   and public.cycle_owner(a.dev_cycle_id) = auth.uid()
                   and a.status in ('not_started','in_progress')));

-- competency_result / progress_snapshot: scoped read; writes happen via the secret-key route.
create policy "result read scoped" on public.competency_result for select to authenticated
  using (exists (select 1 from public.tna_assessment a
                 where a.id = tna_assessment_id
                   and (public.cycle_owner(a.dev_cycle_id) = auth.uid() or public.is_admin()
                        or public.is_manager_of(public.cycle_owner(a.dev_cycle_id)))));
create policy "snapshot read scoped" on public.progress_snapshot for select to authenticated
  using (public.cycle_owner(dev_cycle_id) = auth.uid() or public.is_admin()
         or public.is_manager_of(public.cycle_owner(dev_cycle_id)));

-- ildp: read scoped; employee acknowledges own draft; SoD on endorse + approve.
create policy "ildp read scoped" on public.ildp for select to authenticated
  using (public.cycle_owner(dev_cycle_id) = auth.uid() or public.is_admin()
         or public.is_manager_of(public.cycle_owner(dev_cycle_id)));
create policy "ildp acknowledge" on public.ildp for update to authenticated
  using (public.cycle_owner(dev_cycle_id) = auth.uid() and status = 'draft')
  with check (status = 'pending_endorsement' and acknowledged_by = auth.uid());
create policy "ildp endorse" on public.ildp for update to authenticated
  using (public.is_manager_of(public.cycle_owner(dev_cycle_id)) and status = 'pending_endorsement')
  with check (status = 'pending_approval' and endorsed_by = auth.uid()
              and public.cycle_owner(dev_cycle_id) <> auth.uid());
create policy "ildp approve" on public.ildp for update to authenticated
  using (public.is_admin() and status = 'pending_approval')
  with check (status = 'active' and approved_by = auth.uid()
              and public.cycle_owner(dev_cycle_id) <> auth.uid());

-- ildp_item: scoped read; item writes via route (admin key). Read for owner/manager/admin.
create policy "ildp_item read scoped" on public.ildp_item for select to authenticated
  using (exists (select 1 from public.ildp i
                 where i.id = ildp_id
                   and (public.cycle_owner(i.dev_cycle_id) = auth.uid() or public.is_admin()
                        or public.is_manager_of(public.cycle_owner(i.dev_cycle_id)))));

-- training_record: owner manages own; supervisor verifies (SoD: verifier <> owner); scoped read.
create policy "training read scoped" on public.training_record for select to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.is_manager_of(user_id));
create policy "training owner write" on public.training_record for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "training verify (supervisor/hr)" on public.training_record for update to authenticated
  using ((public.is_manager_of(user_id) or public.is_admin()))
  with check (verified_by = auth.uid() and user_id <> auth.uid());

-- audit_log: admins read; any authenticated user appends their own action; never updated/deleted.
create policy "audit admin read" on public.audit_log for select to authenticated
  using (public.is_admin());
create policy "audit self insert" on public.audit_log for insert to authenticated
  with check (actor_id = auth.uid());

-- ============================================================================
-- 4. DOMAIN SEED (DICT NICS — freely reusable; TESDA "Can I…?" format is our own wording)
-- ============================================================================
insert into public.proficiency_scale (id, name)
values ('00000000-0000-0000-0000-0000000000aa', 'DICT NICS 3-Tier') on conflict do nothing;

insert into public.proficiency_level (scale_id, rank, label) values
  ('00000000-0000-0000-0000-0000000000aa', 1, 'Basic'),
  ('00000000-0000-0000-0000-0000000000aa', 2, 'Intermediate'),
  ('00000000-0000-0000-0000-0000000000aa', 3, 'Advanced')
on conflict (scale_id, rank) do nothing;

-- Competencies (subset of the DICT NICS Core ICT group).
insert into public.competency (code, name, description, category, comp_group, scale_id) values
  ('NICS-COMMCOLLAB','Communicating and Collaborating Using Technology','Uses digital communication tools to inform, engage, and align stakeholders toward shared goals.','Core ICT','common','00000000-0000-0000-0000-0000000000aa'),
  ('NICS-ICTLIT','ICT Literacy','Skillfully uses information and communication tools to perform daily work.','Core ICT','core','00000000-0000-0000-0000-0000000000aa'),
  ('NICS-DIGLIT','Digital Literacy','Accesses, evaluates, synthesizes, and creates digital content from reliable information.','Core ICT','core','00000000-0000-0000-0000-0000000000aa'),
  ('NICS-CYBERSEC','Cybersecurity','Protects ICT resources against security attacks to ensure availability, integrity, and confidentiality.','Core ICT','technical','00000000-0000-0000-0000-0000000000aa'),
  ('NICS-INFOSEC','Information Security','Safeguards information assets from unauthorized access, modification, and disclosure.','Core ICT','technical','00000000-0000-0000-0000-0000000000aa'),
  ('NICS-CONTENT','Content Processing and Generation','Processes and generates documents, data, and media using appropriate productivity tools.','Core ICT','common','00000000-0000-0000-0000-0000000000aa'),
  ('NICS-DATA','Data Analysis','Collects, cleans, transforms, and interprets data to support well-informed decisions.','Core ICT','technical','00000000-0000-0000-0000-0000000000aa'),
  ('NICS-ISM','Information Systems Management','Operates and improves the standard information systems used in business operations.','Core ICT','technical','00000000-0000-0000-0000-0000000000aa'),
  ('NICS-PM','Project Management','Ensures quality, promptness, and efficiency in delivering project outputs.','Core ICT','common','00000000-0000-0000-0000-0000000000aa'),
  ('NICS-CUSTFOCUS','Customer Focus','Provides quality service to internal and external customers and adapts to their needs.','Core ICT','common','00000000-0000-0000-0000-0000000000aa')
on conflict (code) do nothing;

-- Level descriptors per competency (paraphrased DICT NICS indicator language).
-- Basic = limited to own tasks (needs supervision); Intermediate = own task set (may guide others);
-- Advanced = integrates across functions (recommends policy / mentors).
do $$
declare c record; b uuid; i uuid; a uuid;
begin
  select id into b from public.proficiency_level where scale_id='00000000-0000-0000-0000-0000000000aa' and rank=1;
  select id into i from public.proficiency_level where scale_id='00000000-0000-0000-0000-0000000000aa' and rank=2;
  select id into a from public.proficiency_level where scale_id='00000000-0000-0000-0000-0000000000aa' and rank=3;
  for c in select id, name from public.competency loop
    insert into public.competency_level_descriptor (competency_id, level_id, indicator_text) values
      (c.id, b, 'Basic — performs '||c.name||' for own individual tasks with some supervision and further training.'),
      (c.id, i, 'Intermediate — handles '||c.name||' across own set of tasks with minimal guidance and may support others.'),
      (c.id, a, 'Advanced — integrates '||c.name||' across functions, recommends improvements, and mentors others.')
    on conflict (competency_id, level_id) do nothing;
  end loop;
end $$;

-- One self-rating assessment item per competency (our own wording; scale response).
insert into public.assessment_item (competency_id, prompt_text, response_type)
select id, 'Rate your current proficiency in "'||name||'".', 'scale' from public.competency
on conflict do nothing;

-- Job roles.
insert into public.job_role (id, name, description, department) values
  ('00000000-0000-0000-0000-0000000000b1','Junior IT Analyst','Entry-level analyst supporting IT operations and data.','IT'),
  ('00000000-0000-0000-0000-0000000000b2','Records / Admin Officer','Administrative officer handling records and correspondence.','Administration'),
  ('00000000-0000-0000-0000-0000000000b3','IT Officer / Supervisor','Leads the IT team and oversees systems.','IT')
on conflict (id) do nothing;

-- Role competency targets (target rank → level id by join; weight; is_critical).
-- Security competencies are CRITICAL for IT roles, so SoD + criticality surface in the demo.
insert into public.role_competency_target (job_role_id, competency_id, target_level_id, weight, is_critical)
select '00000000-0000-0000-0000-0000000000b1', c.id, pl.id, t.w, t.crit
from (values
  ('NICS-ICTLIT',2,1,false),('NICS-DIGLIT',2,1,false),('NICS-CYBERSEC',2,2,true),
  ('NICS-INFOSEC',2,2,true),('NICS-DATA',3,2,false),('NICS-ISM',2,1,false),
  ('NICS-COMMCOLLAB',2,1,false)
) as t(code,rank,w,crit)
join public.competency c on c.code = t.code
join public.proficiency_level pl on pl.scale_id = '00000000-0000-0000-0000-0000000000aa' and pl.rank = t.rank
on conflict (job_role_id, competency_id) do nothing;

insert into public.role_competency_target (job_role_id, competency_id, target_level_id, weight, is_critical)
select '00000000-0000-0000-0000-0000000000b2', c.id, pl.id, t.w, t.crit
from (values
  ('NICS-ICTLIT',2,1,false),('NICS-CONTENT',2,1,false),('NICS-INFOSEC',2,2,true),
  ('NICS-CUSTFOCUS',2,1,false),('NICS-COMMCOLLAB',2,1,false)
) as t(code,rank,w,crit)
join public.competency c on c.code = t.code
join public.proficiency_level pl on pl.scale_id = '00000000-0000-0000-0000-0000000000aa' and pl.rank = t.rank
on conflict (job_role_id, competency_id) do nothing;

insert into public.role_competency_target (job_role_id, competency_id, target_level_id, weight, is_critical)
select '00000000-0000-0000-0000-0000000000b3', c.id, pl.id, t.w, t.crit
from (values
  ('NICS-CYBERSEC',3,2,true),('NICS-INFOSEC',3,2,true),('NICS-ISM',3,1,false),
  ('NICS-PM',2,1,false),('NICS-DATA',3,1,false),('NICS-DIGLIT',3,1,false)
) as t(code,rank,w,crit)
join public.competency c on c.code = t.code
join public.proficiency_level pl on pl.scale_id = '00000000-0000-0000-0000-0000000000aa' and pl.rank = t.rank
on conflict (job_role_id, competency_id) do nothing;

-- Training catalog (free providers, mapped to a competency + a target level).
insert into public.training_resource (title, provider, url, competency_id, target_level_id, mode, cost)
select t.title, t.provider, t.url, c.id,
       (select id from public.proficiency_level where scale_id='00000000-0000-0000-0000-0000000000aa' and rank=t.rank),
       t.mode, 0
from (values
  ('Cybersecurity Fundamentals','e-tesda','https://e-tesda.gov.ph','NICS-CYBERSEC',2,'online'),
  ('Data Privacy & Information Security','coursebank','https://www.coursebank.ph','NICS-INFOSEC',2,'online'),
  ('Spreadsheets for Data Analysis','e-tesda','https://e-tesda.gov.ph','NICS-DATA',3,'online'),
  ('Digital Literacy Essentials','coursebank','https://www.coursebank.ph','NICS-DIGLIT',2,'online'),
  ('Productive Use of Office Tools','e-tesda','https://e-tesda.gov.ph','NICS-CONTENT',2,'online'),
  ('Effective Digital Collaboration','internal',null,'NICS-COMMCOLLAB',2,'on-the-job'),
  ('Intro to Information Systems','coursebank','https://www.coursebank.ph','NICS-ISM',2,'online'),
  ('Project Management Basics','e-tesda','https://e-tesda.gov.ph','NICS-PM',2,'online'),
  ('Customer Service Excellence','internal',null,'NICS-CUSTFOCUS',2,'classroom'),
  ('ICT Literacy for the Workplace','coursebank','https://www.coursebank.ph','NICS-ICTLIT',2,'online')
) as t(title,provider,url,code,rank,mode) join public.competency c on c.code=t.code
on conflict do nothing;

-- ============================================================================
-- 5. DEMO ACCOUNTS (created by `npm run seed`, not here — needs the admin API):
--   super@demo.test / hr@demo.test / supervisor@demo.test / employee@demo.test / employee2@demo.test
--   employee ships with a completed, validated baseline + active ILDP so dashboards have data.
-- ============================================================================
