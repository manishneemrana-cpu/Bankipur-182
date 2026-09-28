-- Row Level Security on every table (Product Contract rule 7).
-- Anonymous buyers get no table access at all; public pages read through
-- server code (Phase 3). Role helpers live in the `app` schema.

do $$
declare
  t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end;
$$;

-- Internal readers of a project (everyone assigned except brokers).
-- Brokers read public inventory via the plots_public view instead.

-- ----------------------------------------------------------------- tenancy
create policy org_select on public.organizations for select to authenticated
  using (app.is_member(id));
create policy org_update on public.organizations for update to authenticated
  using (app.has_org_role(id, 'org_admin')) with check (app.has_org_role(id, 'org_admin'));

create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or app.is_platform_owner()
    or exists (
      select 1 from public.org_members a
      join public.org_members b on a.org_id = b.org_id
      where a.user_id = (select auth.uid()) and b.user_id = profiles.id
    )
  );
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy members_select on public.org_members for select to authenticated
  using (app.is_member(org_id));
create policy members_insert on public.org_members for insert to authenticated
  with check (app.has_org_role(org_id, 'org_admin'));
create policy members_update on public.org_members for update to authenticated
  using (app.has_org_role(org_id, 'org_admin')) with check (app.has_org_role(org_id, 'org_admin'));
create policy members_delete on public.org_members for delete to authenticated
  using (app.has_org_role(org_id, 'org_admin') and user_id <> (select auth.uid()));

create policy staff_select on public.platform_staff for select to authenticated
  using (user_id = (select auth.uid()) or app.is_platform_owner());

create policy settings_select on public.settings for select to authenticated
  using (app.is_member(org_id));
create policy settings_write on public.settings for all to authenticated
  using (app.has_org_role(org_id, 'org_admin', 'manager'))
  with check (app.has_org_role(org_id, 'org_admin', 'manager'));

create policy units_select on public.area_unit_conversions for select to authenticated
  using (org_id is null or app.is_member(org_id));
create policy units_write on public.area_unit_conversions for all to authenticated
  using (org_id is not null and app.has_org_role(org_id, 'org_admin'))
  with check (org_id is not null and app.has_org_role(org_id, 'org_admin'));

create policy rules_select on public.status_transition_rules for select to authenticated
  using (org_id is null or app.is_member(org_id));
create policy rules_write on public.status_transition_rules for all to authenticated
  using (org_id is not null and app.has_org_role(org_id, 'org_admin'))
  with check (org_id is not null and app.has_org_role(org_id, 'org_admin'));

create policy notifications_select on public.notifications for select to authenticated
  using (
    user_id = (select auth.uid())
    or (user_id is null and app.has_org_role(org_id, 'org_admin', 'manager'))
  );
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy audit_select on public.audit_log for select to authenticated
  using (org_id is not null and app.has_org_role(org_id, 'org_admin', 'manager'));

create policy plans_select on public.plans for select to authenticated using (active);
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (app.has_org_role(org_id, 'org_admin'));
create policy usage_select on public.usage_counters for select to authenticated
  using (app.has_org_role(org_id, 'org_admin', 'manager'));

-- ---------------------------------------------------------------- projects
create policy projects_select on public.projects for select to authenticated
  using (app.project_role(id) is not null);
create policy projects_insert on public.projects for insert to authenticated
  with check (app.has_org_role(org_id, 'org_admin', 'manager'));
create policy projects_update on public.projects for update to authenticated
  using (app.has_project_role(id, 'org_admin', 'manager'))
  with check (app.has_org_role(org_id, 'org_admin', 'manager'));
create policy projects_delete on public.projects for delete to authenticated
  using (app.has_project_role(id, 'org_admin'));

create policy pm_select on public.project_members for select to authenticated
  using (app.has_project_role(project_id, 'org_admin', 'manager') or user_id = (select auth.uid()));
create policy pm_write on public.project_members for all to authenticated
  using (app.has_project_role(project_id, 'org_admin', 'manager'))
  with check (app.has_project_role(project_id, 'org_admin', 'manager'));

-- Generic project-scoped policies.
do $$
declare
  t text;
begin
  -- Internal-only tables: read by internal roles, written by the listed editors.
  foreach t in array array['plots', 'holds', 'plot_status_history', 'data_conflicts',
                           'inventory_imports', 'extraction_jobs', 'layout_versions',
                           'knowledge_chunks', 'ai_conversations', 'ai_messages', 'analytics_events']
  loop
    execute format($f$
      create policy %1$s_select on public.%1$I for select to authenticated
      using (app.has_project_role(project_id, 'org_admin', 'manager', 'sales', 'viewer', 'ops_mapper'))
    $f$, t);
  end loop;

  -- Buyer-visible layout content: brokers may read it too.
  foreach t in array array['phases', 'blocks', 'roads', 'zones', 'landmarks', 'media']
  loop
    execute format($f$
      create policy %1$s_select on public.%1$I for select to authenticated
      using (app.project_role(project_id) is not null)
    $f$, t);
  end loop;

  -- Geometry / layout editors (includes ops mappers for done-for-you tracing).
  foreach t in array array['plots', 'layout_versions', 'phases', 'blocks', 'roads', 'zones',
                           'extraction_jobs', 'data_conflicts']
  loop
    execute format($f$
      create policy %1$s_insert on public.%1$I for insert to authenticated
      with check (app.has_project_role(project_id, 'org_admin', 'manager', 'ops_mapper'))
    $f$, t);
    execute format($f$
      create policy %1$s_update on public.%1$I for update to authenticated
      using (app.has_project_role(project_id, 'org_admin', 'manager', 'ops_mapper'))
      with check (app.has_project_role(project_id, 'org_admin', 'manager', 'ops_mapper'))
    $f$, t);
    execute format($f$
      create policy %1$s_delete on public.%1$I for delete to authenticated
      using (app.has_project_role(project_id, 'org_admin', 'manager'))
    $f$, t);
  end loop;

  -- Content editors.
  foreach t in array array['landmarks', 'media', 'documents', 'faqs', 'knowledge_chunks', 'inventory_imports']
  loop
    execute format($f$
      create policy %1$s_write on public.%1$I for all to authenticated
      using (app.has_project_role(project_id, 'org_admin', 'manager'))
      with check (app.has_project_role(project_id, 'org_admin', 'manager'))
    $f$, t);
  end loop;
end;
$$;

create policy field_log_select on public.field_change_log for select to authenticated
  using (
    case when project_id is not null
      then app.has_project_role(project_id, 'org_admin', 'manager', 'sales', 'viewer', 'ops_mapper')
      else app.has_org_role(org_id, 'org_admin', 'manager')
    end
  );

create policy files_select on public.files for select to authenticated
  using (
    case when project_id is not null
      then app.has_project_role(project_id, 'org_admin', 'manager', 'sales', 'viewer', 'ops_mapper')
      else app.is_member(org_id)
    end
  );
create policy files_insert on public.files for insert to authenticated
  with check (
    case when project_id is not null
      then app.has_project_role(project_id, 'org_admin', 'manager', 'ops_mapper')
      else app.has_org_role(org_id, 'org_admin', 'manager')
    end
  );

create policy documents_select on public.documents for select to authenticated
  using (
    app.has_project_role(project_id, 'org_admin', 'manager', 'sales', 'viewer', 'ops_mapper')
    or (visibility = 'public' and app.project_role(project_id) is not null)
  );

create policy faqs_select on public.faqs for select to authenticated
  using (
    app.has_project_role(project_id, 'org_admin', 'manager', 'sales', 'viewer', 'ops_mapper')
    or (approved and app.project_role(project_id) is not null)
  );

-- ---------------------------------------------------------- leads & links
create policy share_links_select on public.share_links for select to authenticated
  using (
    app.has_project_role(project_id, 'org_admin', 'manager', 'viewer')
    or (owner_user_id = (select auth.uid()) and app.project_role(project_id) is not null)
  );
create policy share_links_insert on public.share_links for insert to authenticated
  with check (
    app.has_project_role(project_id, 'org_admin', 'manager')
    or (owner_user_id = (select auth.uid()) and app.has_project_role(project_id, 'sales', 'broker'))
  );
create policy share_links_update on public.share_links for update to authenticated
  using (app.has_project_role(project_id, 'org_admin', 'manager'))
  with check (app.has_project_role(project_id, 'org_admin', 'manager'));

create policy leads_select on public.leads for select to authenticated
  using (
    app.has_project_role(project_id, 'org_admin', 'manager', 'viewer')
    or (app.has_project_role(project_id, 'sales')
        and (assigned_to = (select auth.uid()) or created_by = (select auth.uid())))
    or (app.has_project_role(project_id, 'broker') and broker_user_id = (select auth.uid()))
  );
create policy leads_insert on public.leads for insert to authenticated
  with check (
    app.has_project_role(project_id, 'org_admin', 'manager', 'sales')
    or (app.has_project_role(project_id, 'broker') and broker_user_id = (select auth.uid()))
  );
create policy leads_update on public.leads for update to authenticated
  using (
    app.has_project_role(project_id, 'org_admin', 'manager')
    or (app.has_project_role(project_id, 'sales') and assigned_to = (select auth.uid()))
  )
  with check (
    app.has_project_role(project_id, 'org_admin', 'manager')
    or (app.has_project_role(project_id, 'sales') and assigned_to = (select auth.uid()))
  );
create policy leads_delete on public.leads for delete to authenticated
  using (app.has_project_role(project_id, 'org_admin'));

-- Visits follow lead visibility (the leads policy applies inside the subquery).
create policy visits_select on public.site_visits for select to authenticated
  using (exists (select 1 from public.leads l where l.id = site_visits.lead_id));
create policy visits_write on public.site_visits for all to authenticated
  using (app.has_project_role(project_id, 'org_admin', 'manager', 'sales'))
  with check (app.has_project_role(project_id, 'org_admin', 'manager', 'sales'));

-- ---------------------------------------------------------------------------
-- Public inventory view: buyer-safe columns only. Prices are nulled unless
-- both the project and the plot make them public. Used by brokers now and by
-- the buyer site (through server code) in Phase 3.
-- ---------------------------------------------------------------------------
create or replace view public.plots_public
with (security_barrier = true)
as
select
  p.id,
  p.org_id,
  p.project_id,
  p.plot_number,
  p.plot_type,
  p.status,
  p.area_official_value,
  p.area_official_unit,
  p.dimensions,
  p.frontage_ft,
  p.depth_ft,
  p.facing,
  p.facing_source,
  p.corner_status,
  p.corner_source,
  p.adjacent_road_ids,
  p.road_width_primary_ft,
  case when pub.prices then p.price_total end as price_total,
  case when pub.prices then p.rate_per_unit end as rate_per_unit,
  case when pub.prices then p.rate_unit end as rate_unit,
  case when pub.prices then p.plc_charges end as plc_charges,
  case when pub.prices then p.booking_amount end as booking_amount,
  case when pub.prices then 'public' else 'on_request' end as price_visibility,
  p.geometry,
  p.centroid_x,
  p.centroid_y,
  p.tags,
  p.public_notes,
  p.block_id,
  b.name as block_name,
  p.phase_id,
  ph.name as phase_name,
  p.last_inventory_update
from public.plots p
join public.projects pr on pr.id = p.project_id
left join public.blocks b on b.id = p.block_id
left join public.phases ph on ph.id = p.phase_id
cross join lateral (
  select (p.price_visibility = 'public' and pr.price_visibility = 'public') as prices
) pub
where p.public_visibility
  and app.project_role(p.project_id) is not null;

revoke all on public.plots_public from anon;
grant select on public.plots_public to authenticated;
