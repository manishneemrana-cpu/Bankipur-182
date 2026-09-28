-- Projects, layout, plots and everything inventory-related (§5, §5.1, §8).

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  type text not null default 'residential_plots'
    check (type in ('residential_plots', 'farm_plots', 'commercial', 'mixed', 'township')),
  address text,
  city text,
  state text,
  pincode text check (pincode is null or pincode ~ '^[1-9][0-9]{5}$'),
  lat double precision check (lat is null or lat between -90 and 90),
  lng double precision check (lng is null or lng between -180 and 180),
  location_verified boolean not null default false,
  total_area_value numeric check (total_area_value is null or total_area_value > 0),
  total_area_unit text,
  rera_number text,
  rera_authority text,
  rera_url text,
  possession_info text,
  description text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  visibility text not null default 'public' check (visibility in ('public', 'password', 'unlisted')),
  link_password_hash text,
  link_expires_at timestamptz,
  link_disabled boolean not null default false,
  price_visibility text not null default 'public'
    check (price_visibility in ('public', 'on_request', 'internal')),
  is_demo boolean not null default false,
  seo jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index on public.projects (org_id);

-- Sales / brokers / ops mappers see only projects they are assigned to.
create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (project_id, user_id)
);
create index on public.project_members (user_id);

create or replace function app.project_role(p_project uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when app.is_platform_owner() then 'platform_owner'
    else coalesce(
      (
        select case
          when m.role in ('org_admin', 'manager', 'viewer') then m.role
          when m.role in ('sales', 'broker') and exists (
            select 1 from public.project_members pm
            where pm.project_id = p.id and pm.user_id = auth.uid()
          ) then m.role
        end
        from public.projects p
        join public.org_members m on m.org_id = p.org_id and m.user_id = auth.uid()
        where p.id = p_project
      ),
      (
        select 'ops_mapper'
        from public.platform_staff s
        join public.project_members pm on pm.user_id = s.user_id and pm.project_id = p_project
        where s.user_id = auth.uid() and s.role = 'ops_mapper'
      )
    )
  end;
$$;

create or replace function app.has_project_role(p_project uuid, variadic p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.project_role(p_project) = any (p_roles || array['platform_owner']), false);
$$;

-- Child rows copy org_id from their project so tenancy can never drift.
create or replace function app.inherit_project_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select org_id into v_org from public.projects where id = new.project_id;
  if v_org is null then
    raise exception 'PROJECT_NOT_FOUND';
  end if;
  if new.org_id is not null and new.org_id <> v_org then
    raise exception 'ORG_MISMATCH';
  end if;
  new.org_id := v_org;
  return new;
end;
$$;

create table public.files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  storage_path text not null,
  original_name text,
  mime text not null,
  size bigint not null check (size >= 0),
  sha256 text not null,
  uploaded_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table public.layout_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  version_no int not null check (version_no > 0),
  source_file_id uuid references public.files (id) on delete set null,
  page_no int,
  calibration jsonb not null default '{}'::jsonb,
  bounds jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'approved', 'published', 'superseded')),
  survey_verified_3d boolean not null default false,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (project_id, version_no)
);
-- Only one published layout version per project.
create unique index layout_versions_one_published
  on public.layout_versions (project_id) where status = 'published';

create table public.phases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (project_id, name)
);

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (project_id, name)
);

create table public.roads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  layout_version_id uuid references public.layout_versions (id) on delete cascade,
  name text,
  width_value numeric check (width_value is null or width_value > 0),
  width_unit text not null default 'ft' check (width_unit in ('ft', 'm')),
  kind text not null default 'internal' check (kind in ('main', 'internal', 'approach', 'service')),
  surface text,
  geometry jsonb not null,
  direction_label text,
  notes text,
  public_visibility boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table public.zones (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  layout_version_id uuid references public.layout_versions (id) on delete cascade,
  kind text not null check (kind in (
    'park', 'amenity', 'commercial', 'residential', 'utility',
    'gate_entry', 'gate_exit', 'boundary', 'water', 'other'
  )),
  name text,
  geometry jsonb not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table public.plots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  layout_version_id uuid references public.layout_versions (id) on delete set null,
  phase_id uuid references public.phases (id) on delete set null,
  block_id uuid references public.blocks (id) on delete set null,
  plot_number text not null check (length(trim(plot_number)) > 0),
  plot_type text not null default 'residential'
    check (plot_type in ('residential', 'commercial', 'farm', 'villa', 'other')),
  status text not null default 'NOT_RELEASED' check (status in (
    'AVAILABLE', 'HOLD', 'RESERVED', 'BOOKED', 'SOLD', 'BLOCKED', 'UNAVAILABLE', 'NOT_RELEASED'
  )),
  area_official_value numeric check (area_official_value is null or area_official_value > 0),
  area_official_unit text check (area_official_unit is null or area_official_unit in (
    'sqft', 'sqm', 'sqyd', 'decimal', 'katha', 'dhur', 'kattha', 'bigha', 'acre', 'gunta', 'cent'
  )),
  area_calculated_sqft numeric check (area_calculated_sqft is null or area_calculated_sqft > 0),
  area_conflict boolean not null default false,
  dimensions jsonb not null default '[]'::jsonb check (jsonb_typeof(dimensions) = 'array'),
  frontage_ft numeric check (frontage_ft is null or frontage_ft > 0),
  depth_ft numeric check (depth_ft is null or depth_ft > 0),
  facing text not null default 'UNKNOWN'
    check (facing in ('N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'UNKNOWN')),
  facing_source text check (facing_source is null or facing_source in ('admin', 'geometry')),
  corner_status text not null default 'UNKNOWN' check (corner_status in ('YES', 'NO', 'UNKNOWN')),
  corner_source text check (corner_source is null or corner_source in ('admin', 'geometry')),
  adjacent_road_ids uuid[] not null default '{}',
  road_width_primary_ft numeric check (road_width_primary_ft is null or road_width_primary_ft > 0),
  price_total numeric check (price_total is null or price_total > 0),
  rate_per_unit numeric check (rate_per_unit is null or rate_per_unit > 0),
  rate_unit text,
  price_visibility text not null default 'public'
    check (price_visibility in ('public', 'on_request', 'internal')),
  internal_price numeric check (internal_price is null or internal_price > 0),
  plc_charges jsonb not null default '[]'::jsonb,
  booking_amount numeric check (booking_amount is null or booking_amount > 0),
  geometry jsonb,
  centroid_x double precision,
  centroid_y double precision,
  tags text[] not null default '{}',
  public_notes text,
  internal_notes text,
  public_visibility boolean not null default true,
  -- Fields a human has verified. A field with an open data_conflict can't be added.
  verified_fields text[] not null default '{}',
  last_inventory_update timestamptz not null default now(),
  inventory_updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (project_id, plot_number)
);
create index on public.plots (project_id, status);
create index on public.plots (org_id);

create table public.plot_status_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  plot_id uuid not null references public.plots (id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid,
  reason text,
  source text not null default 'admin' check (source in ('admin', 'import', 'booking', 'api', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index on public.plot_status_history (plot_id, created_at desc);

create table public.field_change_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  entity text not null,
  entity_id uuid not null,
  field text not null,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index on public.field_change_log (entity, entity_id, created_at desc);

create table public.data_conflicts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  plot_id uuid references public.plots (id) on delete cascade,
  field text not null,
  "values" jsonb not null check (jsonb_typeof("values") = 'array'),
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolved_value jsonb,
  resolved_by uuid,
  resolved_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index on public.data_conflicts (project_id, status);
-- One open conflict per plot+field; new evidence is merged into it.
create unique index data_conflicts_one_open
  on public.data_conflicts (plot_id, field) where status = 'open';

create table public.extraction_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  file_id uuid references public.files (id) on delete set null,
  kind text not null check (kind in ('pdf_text', 'pdf_vector', 'raster_trace_assist', 'ai_vision', 'dxf')),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table public.inventory_imports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  file_id uuid references public.files (id) on delete set null,
  file_name text,
  status text not null default 'validating'
    check (status in ('validating', 'has_errors', 'ready', 'applied', 'rejected')),
  column_mapping jsonb not null default '{}'::jsonb,
  row_results jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  applied_by uuid,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table public.holds (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  plot_id uuid not null references public.plots (id) on delete cascade,
  held_by_user uuid not null,
  lead_id uuid,
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'released', 'converted')),
  released_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
-- The anti-double-booking guarantee: at most one active hold per plot.
create unique index holds_one_active on public.holds (plot_id) where status = 'active';
create index on public.holds (status, expires_at);

-- Org settings (status colours, units, languages, hold hours...).
create table public.settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  key text not null,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (org_id, key)
);

-- Area unit conversions. org_id null = platform template; state null = all India.
-- Units whose size varies by region (katha, dhur, bigha...) only get rows per
-- state, so an unknown state yields "no conversion" instead of a guess.
create table public.area_unit_conversions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations (id) on delete cascade,
  state text,
  unit text not null,
  sqft_per_unit numeric not null check (sqft_per_unit > 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create unique index area_unit_conversions_key
  on public.area_unit_conversions (coalesce(org_id, '00000000-0000-0000-0000-000000000000'), coalesce(state, ''), unit);

-- Configurable status state machine. org_id null = platform default.
create table public.status_transition_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations (id) on delete cascade,
  from_status text not null,
  to_status text not null,
  min_role text not null check (min_role in ('sales', 'manager', 'org_admin')),
  requires_reason boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create unique index status_transition_rules_key
  on public.status_transition_rules (coalesce(org_id, '00000000-0000-0000-0000-000000000000'), from_status, to_status);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index on public.notifications (org_id, user_id, read_at);

-- Generic audit trail: publish, impersonation, role changes, imports...
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations (id) on delete cascade,
  actor uuid default auth.uid(),
  action text not null,
  entity text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index on public.audit_log (org_id, created_at desc);

-- updated_at + org inheritance triggers
do $$
declare
  t text;
begin
  foreach t in array array[
    'projects', 'project_members', 'files', 'layout_versions', 'phases', 'blocks', 'roads',
    'zones', 'plots', 'plot_status_history', 'field_change_log', 'data_conflicts',
    'extraction_jobs', 'inventory_imports', 'holds', 'settings', 'area_unit_conversions',
    'status_transition_rules', 'notifications', 'audit_log'
  ] loop
    execute format(
      'create trigger touch before update on public.%I for each row execute function app.touch_updated_at()', t
    );
  end loop;
  foreach t in array array[
    'project_members', 'layout_versions', 'phases', 'blocks', 'roads', 'zones', 'plots',
    'plot_status_history', 'data_conflicts', 'extraction_jobs', 'inventory_imports', 'holds'
  ] loop
    execute format(
      'create trigger inherit_org before insert on public.%I for each row execute function app.inherit_project_org()', t
    );
  end loop;
end;
$$;
