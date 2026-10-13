-- Auto Real-Estate Video Engine schema. Apply with `supabase db push` or the SQL editor.
create extension if not exists "pgcrypto";

-- One row per builder/broker account (owner_id = auth.users.id when using Supabase Auth).
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid unique,
  name text not null,
  settings jsonb not null default '{}'::jsonb,   -- AccountSettings: providers, notify webhook/email
  created_at timestamptz not null default now()
);

-- Brand kit saved once per account and reused across projects.
create table if not exists brand_kits (
  account_id uuid primary key references accounts(id) on delete cascade,
  builder_name text not null,
  logo_url text,
  primary_color text not null default '#0B1F3A',
  accent_color text not null default '#C9A24B',
  contact_number text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  input jsonb not null,                           -- ProjectInput
  status text not null default 'draft'
    check (status in ('draft','queued','processing','done','failed')),
  assets jsonb not null default '{}'::jsonb,      -- ProjectAssets (stage outputs)
  settings_snapshot jsonb,                        -- resolved brand kit + providers at submit time
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_account_idx on projects(account_id, created_at desc);

-- One row per pipeline stage per run; mirrors the BullMQ job for UI-visible progress.
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  stage text not null check (stage in ('voiceover','map','cinematic','render')),
  status text not null default 'queued'
    check (status in ('queued','processing','done','failed','skipped')),
  progress int not null default 0 check (progress between 0 and 100),
  provider text,
  error text,
  attempts int not null default 0,
  bull_job_id text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists jobs_project_idx on jobs(project_id, created_at);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  kind text not null check (kind in ('project_done','project_failed')),
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- RLS: the worker/API uses the service key (bypasses RLS). Enable RLS so the anon key can never read data.
alter table accounts enable row level security;
alter table brand_kits enable row level security;
alter table projects enable row level security;
alter table jobs enable row level security;
alter table notifications enable row level security;

create policy "own account" on accounts for select using (owner_id = auth.uid());
create policy "own brand kit" on brand_kits for all
  using (account_id in (select id from accounts where owner_id = auth.uid()));
create policy "own projects" on projects for select
  using (account_id in (select id from accounts where owner_id = auth.uid()));
create policy "own jobs" on jobs for select
  using (project_id in (select p.id from projects p join accounts a on a.id = p.account_id where a.owner_id = auth.uid()));
create policy "own notifications" on notifications for all
  using (account_id in (select id from accounts where owner_id = auth.uid()));

-- Storage bucket (public-read so Remotion and browsers can fetch rendered assets by URL; writes need the service key):
insert into storage.buckets (id, name, public) values ('video-engine', 'video-engine', true)
  on conflict (id) do nothing;
