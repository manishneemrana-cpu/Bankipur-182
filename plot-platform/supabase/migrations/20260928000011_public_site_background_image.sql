-- Carries the layout version's reference-drawing underlay (see
-- 20260928000010) into the public site RPC payload, so the buyer-facing 2D
-- map can render it the same way the admin tracing editor does.
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
      'unit', coalesce(v_layout.calibration ->> 'unit', 'ft'),
      'background_image_path', v_layout.background_image_path,
      'background_width_ft', v_layout.background_width_ft,
      'background_height_ft', v_layout.background_height_ft,
      'background_opacity', v_layout.background_opacity
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
