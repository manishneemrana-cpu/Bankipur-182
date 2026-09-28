-- Leads, visits, sharing, content, AI and analytics tables (§5).

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  plot_id uuid references public.plots (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Za-z0-9_-]{4,32}$'),
  owner_user_id uuid,
  kind text not null check (kind in ('broker', 'campaign', 'salesperson')),
  label text,
  clicks int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  plot_ids uuid[] not null default '{}',
  name text not null check (length(trim(name)) > 0),
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  email text,
  source text not null check (source in ('form', 'chat', 'whatsapp', 'call', 'site_visit', 'import')),
  share_link_id uuid references public.share_links (id) on delete set null,
  broker_user_id uuid,
  utm jsonb not null default '{}'::jsonb,
  requirement jsonb not null default '{}'::jsonb,
  stage text not null default 'new' check (stage in (
    'new', 'contacted', 'visit_scheduled', 'visited', 'negotiation', 'booked', 'lost'
  )),
  assigned_to uuid,
  consent_at timestamptz,
  message text,
  notes_internal text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index on public.leads (project_id, stage);
create index on public.leads (broker_user_id);

alter table public.holds
  add constraint holds_lead_fk foreign key (lead_id) references public.leads (id) on delete set null;

create table public.site_visits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  plot_ids uuid[] not null default '{}',
  preferred_date date not null,
  preferred_slot text check (preferred_slot is null or preferred_slot in ('morning', 'afternoon', 'evening')),
  visitors_count int not null default 1 check (visitors_count between 1 and 20),
  status text not null default 'requested'
    check (status in ('requested', 'confirmed', 'completed', 'cancelled', 'no_show')),
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table public.landmarks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  category text not null,
  lat double precision,
  lng double precision,
  distance_value numeric check (distance_value is null or distance_value >= 0),
  distance_unit text check (distance_unit is null or distance_unit in ('km', 'm')),
  travel_time_min int check (travel_time_min is null or travel_time_min >= 0),
  distance_source text check (distance_source is null or distance_source in ('manual', 'calculated')),
  source_note text,
  last_verified_at timestamptz,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  plot_id uuid references public.plots (id) on delete cascade,
  kind text not null check (kind in ('photo', 'drone_video', 'video', '360_photo', 'render')),
  url text not null,
  caption text,
  is_render boolean not null default false,
  taken_at date,
  is_progress boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  -- A render must always be flagged as one (it's shown as "Artist's impression").
  check (kind <> 'render' or is_render)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  kind text not null check (kind in (
    'layout', 'rera', 'brochure', 'approval', 'price_list', 'payment_plan', 'terms', 'map', 'land_record', 'other'
  )),
  file_id uuid references public.files (id) on delete set null,
  url text,
  visibility text not null default 'internal' check (visibility in ('public', 'internal', 'restricted')),
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  q text not null,
  a text not null,
  lang text not null default 'en' check (lang in ('en', 'hi')),
  approved boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  source_document_id uuid references public.documents (id) on delete cascade,
  source_faq_id uuid references public.faqs (id) on delete cascade,
  text text not null,
  embedding extensions.vector(1536),
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  session_id text not null,
  lead_id uuid references public.leads (id) on delete set null,
  lang text,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool')),
  content text not null default '',
  tool_calls jsonb,
  sources jsonb,
  unanswered boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  session_id text not null,
  event text not null,
  plot_id uuid references public.plots (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  share_link_id uuid references public.share_links (id) on delete set null,
  ts timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
create index on public.analytics_events (project_id, event, ts);

-- SaaS billing (Phase 9 fills these in).
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price_inr_monthly numeric not null default 0,
  limits jsonb not null default '{}'::jsonb,
  features jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
alter table public.organizations
  add constraint organizations_plan_fk foreign key (plan_id) references public.plans (id);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'cancelled')),
  provider text,
  provider_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table public.usage_counters (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  period text not null,
  metric text not null,
  value bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (org_id, period, metric)
);

do $$
declare
  t text;
begin
  foreach t in array array[
    'share_links', 'leads', 'site_visits', 'landmarks', 'media', 'documents', 'faqs',
    'knowledge_chunks', 'ai_conversations', 'ai_messages', 'analytics_events', 'plans',
    'subscriptions', 'usage_counters'
  ] loop
    execute format(
      'create trigger touch before update on public.%I for each row execute function app.touch_updated_at()', t
    );
  end loop;
  foreach t in array array[
    'share_links', 'leads', 'site_visits', 'landmarks', 'media', 'documents', 'faqs',
    'knowledge_chunks', 'ai_conversations', 'ai_messages', 'analytics_events'
  ] loop
    execute format(
      'create trigger inherit_org before insert on public.%I for each row execute function app.inherit_project_org()', t
    );
  end loop;
end;
$$;
