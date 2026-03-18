create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  ceo_name text not null default '대표',
  manager_name text not null default '민지',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  title text not null,
  description text,
  zone text not null check (zone in ('ops', 'exec')),
  sort_order integer not null default 0,
  unique (company_id, code)
);

create table if not exists public.api_connections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider_key text not null,
  label text not null,
  encrypted_secret text,
  base_url text,
  model_default text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, provider_key)
);

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  code text not null,
  name text not null,
  role text not null,
  tone text,
  specialty text,
  avatar_style jsonb not null default '{}'::jsonb,
  provider_key text,
  model_name text,
  status text not null default 'idle' check (status in ('idle', 'working', 'waiting_ceo', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  title text not null,
  brief text not null,
  run_mode text not null default 'manual' check (run_mode in ('manual', 'scheduled', 'event')),
  status text not null default 'queued' check (status in ('queued', 'working', 'waiting_report', 'reported', 'failed')),
  result_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_messages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  speaker text not null check (speaker in ('ceo', 'agent', 'manager', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'reviewed')),
  summary text not null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.manager_memory (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  category text not null check (category in ('bottleneck', 'risk', 'improvement', 'history')),
  note text not null,
  source_job_id uuid references public.jobs(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.companies enable row level security;
alter table public.rooms enable row level security;
alter table public.api_connections enable row level security;
alter table public.agents enable row level security;
alter table public.jobs enable row level security;
alter table public.job_messages enable row level security;
alter table public.reports enable row level security;
alter table public.manager_memory enable row level security;

drop policy if exists "companies owner access" on public.companies;
create policy "companies owner access"
on public.companies
for all
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

drop policy if exists "rooms owner access" on public.rooms;
create policy "rooms owner access"
on public.rooms
for all
using (
  exists (
    select 1 from public.companies
    where companies.id = rooms.company_id and companies.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.companies
    where companies.id = rooms.company_id and companies.owner_user_id = auth.uid()
  )
);

drop policy if exists "api connections owner access" on public.api_connections;
create policy "api connections owner access"
on public.api_connections
for all
using (
  exists (
    select 1 from public.companies
    where companies.id = api_connections.company_id and companies.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.companies
    where companies.id = api_connections.company_id and companies.owner_user_id = auth.uid()
  )
);

drop policy if exists "agents owner access" on public.agents;
create policy "agents owner access"
on public.agents
for all
using (
  exists (
    select 1 from public.companies
    where companies.id = agents.company_id and companies.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.companies
    where companies.id = agents.company_id and companies.owner_user_id = auth.uid()
  )
);

drop policy if exists "jobs owner access" on public.jobs;
create policy "jobs owner access"
on public.jobs
for all
using (
  exists (
    select 1 from public.companies
    where companies.id = jobs.company_id and companies.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.companies
    where companies.id = jobs.company_id and companies.owner_user_id = auth.uid()
  )
);

drop policy if exists "job messages owner access" on public.job_messages;
create policy "job messages owner access"
on public.job_messages
for all
using (
  exists (
    select 1
    from public.jobs
    join public.companies on companies.id = jobs.company_id
    where jobs.id = job_messages.job_id and companies.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.jobs
    join public.companies on companies.id = jobs.company_id
    where jobs.id = job_messages.job_id and companies.owner_user_id = auth.uid()
  )
);

drop policy if exists "reports owner access" on public.reports;
create policy "reports owner access"
on public.reports
for all
using (
  exists (
    select 1 from public.companies
    where companies.id = reports.company_id and companies.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.companies
    where companies.id = reports.company_id and companies.owner_user_id = auth.uid()
  )
);

drop policy if exists "manager memory owner access" on public.manager_memory;
create policy "manager memory owner access"
on public.manager_memory
for all
using (
  exists (
    select 1 from public.companies
    where companies.id = manager_memory.company_id and companies.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.companies
    where companies.id = manager_memory.company_id and companies.owner_user_id = auth.uid()
  )
);
