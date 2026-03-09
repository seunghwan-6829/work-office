create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.provider_credentials (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  encrypted_secret text not null,
  last4 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  source_srt_path text,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists public.subtitle_segments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  sort_order integer not null,
  start_ms integer not null,
  end_ms integer not null,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.asset_recommendations (
  id uuid primary key default gen_random_uuid(),
  segment_id uuid not null references public.subtitle_segments(id) on delete cascade,
  recommendation_type text not null,
  reason text,
  prompt text not null,
  mogrt_template_id text,
  selected boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.asset_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  provider text not null,
  job_type text not null,
  status text not null default 'queued',
  input_payload jsonb not null,
  output_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generated_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  segment_id uuid references public.subtitle_segments(id) on delete set null,
  asset_type text not null,
  storage_path text not null,
  provider text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.export_packages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  export_type text not null,
  storage_path text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);