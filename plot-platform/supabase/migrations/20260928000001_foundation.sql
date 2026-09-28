-- Foundation: extensions, shared helpers, tenancy (organizations, members,
-- platform staff) and the role functions every RLS policy is built on.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;

create schema if not exists app;
grant usage on schema app to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create or replace function app.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  plan_id uuid,
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  branding jsonb not null default '{}'::jsonb,
  contact jsonb not null default '{}'::jsonb,
  powered_by_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('org_admin', 'manager', 'sales', 'broker', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (org_id, user_id)
);
create index on public.org_members (user_id);

-- Platform-level staff (the SaaS owner's side): platform_owner, ops_mapper.
create table public.platform_staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  role text not null check (role in ('platform_owner', 'ops_mapper')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

-- ---------------------------------------------------------------------------
-- Role helpers. SECURITY DEFINER so policies can consult membership tables
-- without recursing into their own RLS. All pinned to an empty search_path.
-- ---------------------------------------------------------------------------
create or replace function app.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_staff
    where user_id = auth.uid() and role = 'platform_owner'
  );
$$;

create or replace function app.org_role(p_org uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when app.is_platform_owner() then 'platform_owner'
    else (select role from public.org_members where org_id = p_org and user_id = auth.uid())
  end;
$$;

create or replace function app.is_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.org_role(p_org) is not null;
$$;

-- Numeric rank used for "role X or above" checks.
create or replace function app.role_rank(p_role text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'platform_owner' then 100
    when 'org_admin' then 40
    when 'manager' then 30
    when 'ops_mapper' then 25
    when 'sales' then 20
    when 'broker' then 10
    when 'viewer' then 5
    else 0
  end;
$$;

create or replace function app.has_org_role(p_org uuid, variadic p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.org_role(p_org) = any (p_roles || array['platform_owner']), false);
$$;

grant execute on all functions in schema app to anon, authenticated, service_role;

create trigger touch before update on public.organizations
  for each row execute function app.touch_updated_at();
create trigger touch before update on public.profiles
  for each row execute function app.touch_updated_at();
create trigger touch before update on public.org_members
  for each row execute function app.touch_updated_at();
create trigger touch before update on public.platform_staff
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Profiles are created automatically for every new auth user.
-- ---------------------------------------------------------------------------
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- A signed-in user with no org creates one and becomes its org_admin.
create or replace function public.create_organization(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  insert into public.organizations (name, slug, created_by)
  values (p_name, p_slug, auth.uid())
  returning id into v_org;
  insert into public.org_members (org_id, user_id, role, created_by)
  values (v_org, auth.uid(), 'org_admin', auth.uid());
  return v_org;
end;
$$;
revoke execute on function public.create_organization(text, text) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;
