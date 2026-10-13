-- Digital Twin Viewer schema. Apply with `supabase db push` or the SQL editor.
-- Access model: the public viewer and the admin both talk ONLY to apps/api, which uses the service key.
-- RLS is enabled on every table with no policies, so the anon/authenticated keys can read nothing directly.

create extension if not exists "pgcrypto";

create table if not exists projects (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name             text not null,
  location         text not null default '',
  description      text,
  cover_image_url  text,
  site_glb_url     text,
  site_lod_glb_url text,
  model_scale      double precision not null default 1 check (model_scale > 0),
  is_published     boolean not null default false,
  created_at       timestamptz not null default now()
);

create table if not exists towers (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects(id) on delete cascade,
  name              text not null,
  glb_url           text,
  lod_glb_url       text,
  floor_count       int  not null check (floor_count between 1 and 250),
  floor_height      double precision not null default 3 check (floor_height > 0),
  floor_node_prefix text not null default 'Floor_',
  footprint_w       double precision not null default 24,
  footprint_d       double precision not null default 14,
  position          double precision[] not null default '{0,0,0}' check (array_length(position,1) = 3),
  rotation_y        double precision not null default 0,
  sort_order        int not null default 0
);
create index if not exists towers_project_idx on towers(project_id);

create table if not exists floors (
  id           uuid primary key default gen_random_uuid(),
  tower_id     uuid not null references towers(id) on delete cascade,
  floor_number int  not null check (floor_number >= 1),
  label        text,
  elevation    double precision not null,
  glb_url      text,
  unique (tower_id, floor_number)
);

create table if not exists unit_types (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  code       text not null,
  name       text not null,
  glb_url    text,
  area_sqm   double precision,
  bedrooms   int not null default 2,
  bathrooms  int not null default 2,
  rooms      jsonb not null default '[]',
  spawn      double precision[] not null default '{0,1.6,0}' check (array_length(spawn,1) = 3),
  unique (project_id, code)
);

create table if not exists units (
  id           uuid primary key default gen_random_uuid(),
  tower_id     uuid not null references towers(id) on delete cascade,
  floor_number int  not null check (floor_number >= 1),
  unit_type_id uuid not null references unit_types(id) on delete restrict,
  label        text not null,
  outline      jsonb not null,            -- [[x,z],...] tower-local metres
  area_sqm     double precision,
  status       text not null default 'available' check (status in ('available','hold','sold')),
  unique (tower_id, label)
);
create index if not exists units_tower_floor_idx on units(tower_id, floor_number);

create table if not exists hotspots (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  tower_id    uuid references towers(id) on delete set null,
  title       text not null,
  description text not null default '',
  photo_url   text,
  category    text not null default 'other',
  position    double precision[] not null check (array_length(position,1) = 3)
);
create index if not exists hotspots_project_idx on hotspots(project_id);

create table if not exists analytics_events (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  type         text not null,
  session_id   text not null,
  tower_id     uuid,
  floor_number int,
  unit_id      uuid,
  hotspot_id   uuid,
  meta         text,
  created_at   timestamptz not null default now()
);
create index if not exists analytics_project_time_idx on analytics_events(project_id, created_at desc);

create table if not exists floorplan_analyses (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  provider   text not null,
  is_mock    boolean not null default true,
  result     jsonb not null,
  created_at timestamptz not null default now()
);

alter table projects            enable row level security;
alter table towers              enable row level security;
alter table floors              enable row level security;
alter table unit_types          enable row level security;
alter table units               enable row level security;
alter table hotspots            enable row level security;
alter table analytics_events    enable row level security;
alter table floorplan_analyses  enable row level security;

-- Storage: create a PUBLIC bucket named `project-assets` (GLBs, textures, photos) in the Supabase dashboard,
-- or uncomment:
-- insert into storage.buckets (id, name, public) values ('project-assets', 'project-assets', true) on conflict do nothing;
