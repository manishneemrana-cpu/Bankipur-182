-- Public buyer site (§9, Phase 3): anonymous-safe reads and lead capture.
-- Anonymous buyers have zero direct table access (§7); everything goes
-- through these SECURITY DEFINER functions, each of which re-validates the
-- project's publish state, link security and password on every call.

create or replace function app.check_public_project_access(p_project public.projects, p_password text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_project.id is null or p_project.status <> 'published' then
    raise exception 'NOT_FOUND';
  end if;
  if p_project.link_disabled then
    raise exception 'LINK_DISABLED';
  end if;
  if p_project.link_expires_at is not null and p_project.link_expires_at < now() then
    raise exception 'LINK_EXPIRED';
  end if;
  if p_project.visibility = 'password' then
    if p_project.link_password_hash is null or p_password is null
       or extensions.crypt(p_password, p_project.link_password_hash) <> p_project.link_password_hash then
      raise exception 'PASSWORD_REQUIRED';
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- One call, one JSON payload: project + branding + published layout +
-- public-visibility plots/roads/zones + approved FAQs + public documents +
-- landmarks. Rule 5 (live or hidden): plot data here is always read fresh
-- from `plots`, never a cache, so "AVAILABLE" here is true right now.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_site_data(p_slug text, p_password text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
  v_org public.organizations;
  v_layout public.layout_versions;
  v_result jsonb;
begin
  select * into v_project from public.projects where slug = p_slug;
  perform app.check_public_project_access(v_project, p_password);

  select * into v_org from public.organizations where id = v_project.org_id;
  select * into v_layout from public.layout_versions
    where project_id = v_project.id and status = 'published';

  select jsonb_build_object(
    'project', jsonb_build_object(
      'id', v_project.id, 'name', v_project.name, 'slug', v_project.slug, 'type', v_project.type,
      'address', v_project.address, 'city', v_project.city, 'state', v_project.state,
      'lat', v_project.lat, 'lng', v_project.lng, 'location_verified', v_project.location_verified,
      'total_area_value', v_project.total_area_value, 'total_area_unit', v_project.total_area_unit,
      'rera_number', v_project.rera_number, 'rera_authority', v_project.rera_authority,
      'rera_url', v_project.rera_url, 'possession_info', v_project.possession_info,
      'description', v_project.description, 'visibility', v_project.visibility,
      'price_visibility', v_project.price_visibility, 'is_demo', v_project.is_demo,
      'settings', v_project.settings
    ),
    'org', jsonb_build_object(
      'name', v_org.name, 'branding', v_org.branding, 'contact', v_org.contact,
      'powered_by_visible', v_org.powered_by_visible
    ),
    'layout', jsonb_build_object(
      'north_angle_deg', coalesce((v_layout.calibration ->> 'north_angle_deg')::numeric, 0),
      'unit', coalesce(v_layout.calibration ->> 'unit', 'ft')
    ),
    'plots', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'plot_number', p.plot_number, 'plot_type', p.plot_type, 'status', p.status,
        'area_official_value', p.area_official_value, 'area_official_unit', p.area_official_unit,
        'dimensions', p.dimensions, 'frontage_ft', p.frontage_ft, 'depth_ft', p.depth_ft,
        'facing', p.facing, 'facing_source', p.facing_source, 'corner_status', p.corner_status,
        'road_width_primary_ft', p.road_width_primary_ft,
        'price_total', case when v_project.price_visibility = 'public' and p.price_visibility = 'public'
                             then p.price_total end,
        'rate_per_unit', case when v_project.price_visibility = 'public' and p.price_visibility = 'public'
                               then p.rate_per_unit end,
        'rate_unit', p.rate_unit,
        'booking_amount', case when v_project.price_visibility = 'public' and p.price_visibility = 'public'
                                then p.booking_amount end,
        'price_visibility', case when v_project.price_visibility = 'public' and p.price_visibility = 'public'
                                  then 'public' else 'on_request' end,
        'geometry', p.geometry, 'centroid_x', p.centroid_x, 'centroid_y', p.centroid_y, 'tags', p.tags,
        'public_notes', p.public_notes, 'last_inventory_update', p.last_inventory_update
      ))
      from public.plots p where p.project_id = v_project.id and p.public_visibility
    ), '[]'::jsonb),
    'roads', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'name', r.name, 'kind', r.kind,
        'width_value', r.width_value, 'width_unit', r.width_unit, 'geometry', r.geometry
      ))
      from public.roads r where r.project_id = v_project.id and r.public_visibility
    ), '[]'::jsonb),
    'zones', coalesce((
      select jsonb_agg(jsonb_build_object('id', z.id, 'kind', z.kind, 'name', z.name, 'geometry', z.geometry))
      from public.zones z where z.project_id = v_project.id
    ), '[]'::jsonb),
    'landmarks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'name', l.name, 'category', l.category, 'distance_value', l.distance_value,
        'distance_unit', l.distance_unit, 'travel_time_min', l.travel_time_min,
        'distance_source', l.distance_source
      ) order by l.sort)
      from public.landmarks l where l.project_id = v_project.id
    ), '[]'::jsonb),
    'faqs', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'q', f.q, 'a', f.a, 'lang', f.lang) order by f.sort)
      from public.faqs f where f.project_id = v_project.id and f.approved
    ), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'title', d.title, 'kind', d.kind, 'url', d.url, 'verified_at', d.verified_at
      ))
      from public.documents d where d.project_id = v_project.id and d.visibility = 'public'
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_public_site_data(text, text) from public;
grant execute on function public.get_public_site_data(text, text) to anon, authenticated;

-- Cheap existence/password check used by the password-gate form (avoids
-- shipping the whole payload just to test a guess).
create or replace function public.verify_project_password(p_slug text, p_password text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
begin
  select * into v_project from public.projects where slug = p_slug;
  begin
    perform app.check_public_project_access(v_project, p_password);
    return true;
  exception when others then
    return false;
  end;
end;
$$;
revoke all on function public.verify_project_password(text, text) from public;
grant execute on function public.verify_project_password(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public lead capture (enquiry / site-visit forms, §13). DPDP-friendly:
-- consent is mandatory and timestamped.
-- ---------------------------------------------------------------------------
create or replace function public.submit_public_lead(
  p_slug text,
  p_password text,
  p_name text,
  p_phone text,
  p_email text,
  p_message text,
  p_plot_numbers text[],
  p_source text,
  p_ref text,
  p_consent boolean,
  p_visit_date date default null,
  p_visit_slot text default null,
  p_visitors int default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
  v_share public.share_links;
  v_plot_ids uuid[];
  v_lead_id uuid;
begin
  select * into v_project from public.projects where slug = p_slug;
  perform app.check_public_project_access(v_project, p_password);

  if not p_consent then
    raise exception 'CONSENT_REQUIRED';
  end if;
  if p_source not in ('form', 'chat', 'whatsapp', 'call', 'site_visit') then
    raise exception 'INVALID_SOURCE';
  end if;

  if p_ref is not null then
    select * into v_share from public.share_links
      where project_id = v_project.id and code = p_ref and active;
    if v_share.id is not null then
      update public.share_links set clicks = clicks + 1 where id = v_share.id;
    end if;
  end if;

  select coalesce(array_agg(id), '{}') into v_plot_ids
    from public.plots where project_id = v_project.id and plot_number = any (p_plot_numbers);

  insert into public.leads (
    project_id, plot_ids, name, phone, email, source, share_link_id, broker_user_id,
    requirement, message, consent_at
  ) values (
    v_project.id, v_plot_ids, p_name, p_phone, nullif(p_email, ''), p_source, v_share.id,
    v_share.owner_user_id, '{}'::jsonb, p_message, now()
  ) returning id into v_lead_id;

  if p_source = 'site_visit' and p_visit_date is not null then
    insert into public.site_visits (project_id, lead_id, plot_ids, preferred_date, preferred_slot, visitors_count)
    values (v_project.id, v_lead_id, v_plot_ids, p_visit_date, p_visit_slot, coalesce(p_visitors, 1));
  end if;

  return v_lead_id;
end;
$$;
revoke all on function public.submit_public_lead(
  text, text, text, text, text, text, text[], text, text, boolean, date, text, int
) from public;
grant execute on function public.submit_public_lead(
  text, text, text, text, text, text, text[], text, text, boolean, date, text, int
) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin: link security + password (org_admin/manager only).
-- ---------------------------------------------------------------------------
create or replace function public.set_project_link_security(
  p_project uuid, p_visibility text, p_expires_at timestamptz, p_disabled boolean
)
returns public.projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
begin
  select * into v_project from public.projects where id = p_project;
  if v_project.id is null or not app.has_project_role(p_project, 'org_admin', 'manager') then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_visibility not in ('public', 'password', 'unlisted') then
    raise exception 'INVALID_VISIBILITY';
  end if;
  update public.projects
  set visibility = p_visibility, link_expires_at = p_expires_at, link_disabled = p_disabled
  where id = p_project
  returning * into v_project;
  return v_project;
end;
$$;

create or replace function public.set_project_password(p_project uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.has_project_role(p_project, 'org_admin', 'manager') then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'PASSWORD_TOO_SHORT';
  end if;
  update public.projects
  set link_password_hash = extensions.crypt(p_password, extensions.gen_salt('bf'))
  where id = p_project;
end;
$$;

create or replace function public.clear_project_password(p_project uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.has_project_role(p_project, 'org_admin', 'manager') then
    raise exception 'NOT_ALLOWED';
  end if;
  update public.projects set link_password_hash = null where id = p_project;
end;
$$;

revoke all on function public.set_project_link_security(uuid, text, timestamptz, boolean) from public, anon;
revoke all on function public.set_project_password(uuid, text) from public, anon;
revoke all on function public.clear_project_password(uuid) from public, anon;
grant execute on function public.set_project_link_security(uuid, text, timestamptz, boolean) to authenticated;
grant execute on function public.set_project_password(uuid, text) to authenticated;
grant execute on function public.clear_project_password(uuid) to authenticated;
