-- Phase 9: analytics ingestion + plan limits + usage metering. The tables
-- (analytics_events, plans, subscriptions, usage_counters) and their RLS
-- were already created in Phase 1 (§5) for exactly this phase to fill in.

-- ---------------------------------------------------------------------------
-- Seed the Free plan. `limits` keys are read by app.plan_limit(); a missing
-- key means unlimited for that metric, never a guessed cap. The seed data's
-- 'starter'/'growth' plans (supabase/seed.sql) already established the key
-- convention (projects/plots/ai_messages_per_month) — Free matches it.
-- ---------------------------------------------------------------------------
insert into public.plans (code, name, price_inr_monthly, limits, features)
values
  ('free', 'Free', 0,
   '{"projects": 1, "plots": 50, "ai_messages_per_month": 200}'::jsonb,
   '{"ai_assistant": true, "3d_view": true}'::jsonb)
on conflict (code) do nothing;

-- New orgs start on Free until an owner (platform staff, off-app for now —
-- no Razorpay keys exist in this environment, see the billing adapter) moves
-- them to a paid plan.
create or replace function public.create_organization(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_free_plan uuid;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  select id into v_free_plan from public.plans where code = 'free';

  insert into public.organizations (name, slug, plan_id, created_by)
  values (p_name, p_slug, v_free_plan, auth.uid())
  returning id into v_org;
  insert into public.org_members (org_id, user_id, role, created_by)
  values (v_org, auth.uid(), 'org_admin', auth.uid());
  insert into public.subscriptions (org_id, plan_id, status, created_by)
  values (v_org, v_free_plan, 'active', auth.uid());
  return v_org;
end;
$$;

-- ---------------------------------------------------------------------------
-- Plan limits (rule 9: small, verifiable — enforced where the row is
-- actually created, not just checked in the UI).
-- ---------------------------------------------------------------------------
create or replace function app.plan_limit(p_org uuid, p_key text)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select (p.limits ->> p_key)::numeric
  from public.organizations o
  join public.plans p on p.id = o.plan_id
  where o.id = p_org;
$$;

create or replace function app.enforce_project_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit numeric;
  v_count int;
begin
  v_limit := app.plan_limit(new.org_id, 'projects');
  if v_limit is not null then
    select count(*) into v_count from public.projects where org_id = new.org_id;
    if v_count >= v_limit then
      raise exception 'PLAN_LIMIT_PROJECTS' using detail = v_limit::text;
    end if;
  end if;
  return new;
end;
$$;
create trigger enforce_project_limit before insert on public.projects
  for each row execute function app.enforce_project_limit();

create or replace function app.enforce_plot_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_limit numeric;
  v_count int;
begin
  -- Resolve org via project_id rather than new.org_id: trigger execution
  -- order across tables isn't guaranteed relative to the org-inheriting
  -- trigger, so new.org_id may not be populated yet at this point.
  select org_id into v_org from public.projects where id = new.project_id;
  v_limit := app.plan_limit(v_org, 'plots');
  if v_limit is not null then
    select count(*) into v_count from public.plots where project_id = new.project_id;
    if v_count >= v_limit then
      raise exception 'PLAN_LIMIT_PLOTS' using detail = v_limit::text;
    end if;
  end if;
  return new;
end;
$$;
create trigger enforce_plot_limit before insert on public.plots
  for each row execute function app.enforce_plot_limit();

-- ---------------------------------------------------------------------------
-- Usage metering: one row per (org, YYYY-MM period, metric). Reserving an AI
-- turn increments and gates in one step (row-locked, so concurrent chats
-- can't both slip past the limit); logging afterwards never blocks.
-- ---------------------------------------------------------------------------
create or replace function app.current_period()
returns text
language sql
stable
as $$
  select to_char(now(), 'YYYY-MM');
$$;

create or replace function app.reserve_usage(p_org uuid, p_metric text, p_limit_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit numeric;
  v_row public.usage_counters;
begin
  v_limit := app.plan_limit(p_org, p_limit_key);

  insert into public.usage_counters (org_id, period, metric, value)
  values (p_org, app.current_period(), p_metric, 0)
  on conflict (org_id, period, metric) do nothing;

  select * into v_row from public.usage_counters
  where org_id = p_org and period = app.current_period() and metric = p_metric
  for update;

  if v_limit is not null and v_row.value >= v_limit then
    return false;
  end if;

  update public.usage_counters set value = value + 1 where id = v_row.id;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Anonymous-safe analytics beacon (§16). Same access check as every other
-- public RPC — an event can't be recorded for a project the caller
-- couldn't otherwise see.
-- ---------------------------------------------------------------------------
create or replace function public.track_event(
  p_slug text,
  p_password text,
  p_session_id text,
  p_event text,
  p_plot_number text default null,
  p_ref text default null,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
  v_plot_id uuid;
  v_share_id uuid;
begin
  select * into v_project from public.projects where slug = p_slug;
  perform app.check_public_project_access(v_project, p_password);

  if p_plot_number is not null then
    select id into v_plot_id from public.plots
      where project_id = v_project.id and plot_number = p_plot_number;
  end if;
  if p_ref is not null then
    select id into v_share_id from public.share_links
      where project_id = v_project.id and code = p_ref and active;
  end if;

  insert into public.analytics_events
    (org_id, project_id, session_id, event, plot_id, share_link_id, payload)
  values
    (v_project.org_id, v_project.id, p_session_id, p_event, v_plot_id, v_share_id, p_payload);
end;
$$;
revoke all on function public.track_event(text, text, text, text, text, text, jsonb) from public;
grant execute on function public.track_event(text, text, text, text, text, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- AI usage: reserve a turn before calling the model (never bill for a call
-- that wasn't made), then log the exchange after.
-- ---------------------------------------------------------------------------
create or replace function public.reserve_ai_turn(p_slug text, p_password text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
begin
  select * into v_project from public.projects where slug = p_slug;
  perform app.check_public_project_access(v_project, p_password);
  return app.reserve_usage(v_project.org_id, 'ai_messages', 'ai_messages_per_month');
end;
$$;
revoke all on function public.reserve_ai_turn(text, text) from public;
grant execute on function public.reserve_ai_turn(text, text) to anon, authenticated;

create or replace function public.log_ai_turn(
  p_slug text,
  p_password text,
  p_session_id text,
  p_lang text,
  p_user_message text,
  p_assistant_message text,
  p_tool_calls jsonb default '[]'::jsonb,
  p_unanswered boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
  v_conv public.ai_conversations;
begin
  select * into v_project from public.projects where slug = p_slug;
  perform app.check_public_project_access(v_project, p_password);

  select * into v_conv from public.ai_conversations
    where project_id = v_project.id and session_id = p_session_id;
  if v_conv.id is null then
    insert into public.ai_conversations (project_id, session_id, lang)
    values (v_project.id, p_session_id, p_lang)
    returning * into v_conv;
  end if;

  insert into public.ai_messages (project_id, conversation_id, role, content)
  values (v_project.id, v_conv.id, 'user', p_user_message);
  insert into public.ai_messages (project_id, conversation_id, role, content, tool_calls, unanswered)
  values (v_project.id, v_conv.id, 'assistant', p_assistant_message, p_tool_calls, p_unanswered);
end;
$$;
revoke all on function public.log_ai_turn(text, text, text, text, text, text, jsonb, boolean) from public;
grant execute on function public.log_ai_turn(text, text, text, text, text, text, jsonb, boolean) to anon, authenticated;
