-- Demo data (§19): "Demo Builders" / "Green Valley Enclave (DEMO)".
-- Idempotent: re-running `supabase db reset` regenerates the same IDs.

insert into public.plans (id, code, name, price_inr_monthly, limits, features)
values
  ('00000000-0000-0000-0000-0000000000e1', 'starter', 'Starter', 0,
   '{"projects": 1, "plots": 200, "ai_messages_per_month": 500}',
   '{"ai_assistant": true, "custom_domain": false}'),
  ('00000000-0000-0000-0000-0000000000e2', 'growth', 'Growth', 4999,
   '{"projects": 5, "plots": 5000, "ai_messages_per_month": 5000}',
   '{"ai_assistant": true, "custom_domain": true}')
on conflict (id) do nothing;

insert into public.organizations (id, name, slug, plan_id, branding, contact, powered_by_visible, status)
values (
  '00000000-0000-0000-0000-00000000000a', 'Demo Builders', 'demo-builders',
  '00000000-0000-0000-0000-0000000000e2',
  '{"primaryColor": "#0f5132", "accentColor": "#d4a017"}',
  '{"phone": "+919999999999", "whatsapp": "+919999999999", "email": "sales@demo-builders.example"}',
  false, 'active'
)
on conflict (id) do nothing;

insert into public.projects (
  id, org_id, name, slug, type, address, city, state, pincode, lat, lng, location_verified,
  total_area_value, total_area_unit, rera_number, rera_authority, rera_url, possession_info,
  description, status, visibility, is_demo, settings
) values (
  '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a',
  'Green Valley Enclave (DEMO)', 'green-valley-enclave-demo', 'residential_plots',
  'NH-31, Bankipur', 'Bankipur', 'Bihar', '800001', 25.6100, 85.1400, true,
  12, 'acre', 'BRERA-DEMO-0001', 'Bihar RERA', 'https://rera.bihar.gov.in',
  'Possession: Dec 2027',
  'Demo project seeded for Phase 1. All data is fictional — see the DEMO DATA ribbon.',
  'published', 'public', true,
  '{"demo": true, "hold_hours": 24, "north_angle_deg": 23}'
)
on conflict (id) do nothing;

insert into public.layout_versions (id, org_id, project_id, version_no, calibration, status, approved_at)
values (
  '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000a',
  '00000000-0000-0000-0000-00000000000b', 1,
  '{"scale_px_per_unit": 1, "unit": "ft", "north_angle_deg": 23, "origin": [0, 0]}',
  'published', now()
)
on conflict (id) do nothing;

insert into public.blocks (id, org_id, project_id, name, sort) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'Block A', 1),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'Block B', 2),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'Block C', 3),
  ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'Block D', 4)
on conflict (id) do nothing;

insert into public.phases (id, org_id, project_id, name, sort) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'Phase 1', 1),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'Phase 2', 2)
on conflict (id) do nothing;

insert into public.roads (org_id, project_id, layout_version_id, name, width_value, width_unit, kind, geometry, direction_label) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c',
   'Main Boulevard', 60, 'ft', 'main',
   '{"type":"Polygon","coordinates":[[[0,290],[1200,290],[1200,320],[0,320],[0,290]]]}', 'East-West'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c',
   '30ft Internal Road', 30, 'ft', 'internal',
   '{"type":"Polygon","coordinates":[[[290,0],[320,0],[320,290],[290,290],[290,0]]]}', 'North-South'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c',
   '40ft Internal Road', 40, 'ft', 'internal',
   '{"type":"Polygon","coordinates":[[[590,0],[630,0],[630,590],[590,590],[590,0]]]}', 'North-South'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c',
   'Approach Road (20ft)', 20, 'ft', 'approach',
   '{"type":"Polygon","coordinates":[[[0,0],[20,0],[20,290],[0,290],[0,0]]]}', 'North-South');

insert into public.zones (org_id, project_id, layout_version_id, kind, name, geometry) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c',
   'park', 'Central Park', '{"type":"Polygon","coordinates":[[[340,340],[580,340],[580,540],[340,540],[340,340]]]}'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c',
   'park', 'North Green', '{"type":"Polygon","coordinates":[[[650,20],[900,20],[900,150],[650,150],[650,20]]]}'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c',
   'amenity', 'Club House', '{"type":"Polygon","coordinates":[[[340,20],[500,20],[500,150],[340,150],[340,20]]]}'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c',
   'gate_entry', 'Main Gate', '{"type":"Polygon","coordinates":[[[0,290],[20,290],[20,320],[0,320],[0,290]]]}'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c',
   'gate_exit', 'Exit Gate', '{"type":"Polygon","coordinates":[[[1180,290],[1200,290],[1200,320],[1180,320],[1180,290]]]}'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c',
   'boundary', 'Project Boundary', '{"type":"Polygon","coordinates":[[[0,0],[1200,0],[1200,590],[0,590],[0,0]]]}');

-- 120 plots across 4 blocks. Rows south of the main road (y>320) sit in
-- Block A/B; rows north (y<290) sit in Block C/D. Sizes cycle through the
-- spec's list; a handful get irregular polygons and corner positions.
do $$
declare
  sizes int[] := array[800, 1000, 1200, 1500, 1800, 2400];
  blocks uuid[] := array[
    '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2',
    '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000b4'
  ];
  phases uuid[] := array['00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2'];
  statuses text[] := array['AVAILABLE','AVAILABLE','AVAILABLE','HOLD','RESERVED','BOOKED','SOLD','AVAILABLE'];
  i int;
  row_i int;
  col_i int;
  side numeric;
  w numeric;
  d numeric;
  x numeric;
  y numeric;
  is_corner boolean;
  facing_v text;
  road_ids uuid[];
  main_road uuid;
  road_30 uuid;
  road_40 uuid;
begin
  select id into main_road from public.roads where project_id = '00000000-0000-0000-0000-00000000000b' and name = 'Main Boulevard';
  select id into road_30 from public.roads where project_id = '00000000-0000-0000-0000-00000000000b' and name = '30ft Internal Road';
  select id into road_40 from public.roads where project_id = '00000000-0000-0000-0000-00000000000b' and name = '40ft Internal Road';

  for i in 1..120 loop
    row_i := (i - 1) / 10;      -- 12 rows of 10
    col_i := (i - 1) % 10;
    side := sizes[1 + (i % 6)];
    -- ~30x30 for 800 sqft up to ~52x52 for 2400 sqft, kept roughly square
    w := round(sqrt(side)::numeric, 1);
    d := round((side / w)::numeric, 1);
    x := 40 + col_i * 116;
    y := case when row_i < 6 then 20 + row_i * 44 else 340 + (row_i - 6) * 44 end;
    is_corner := col_i = 0 or col_i = 9;
    facing_v := (array['E','W','N','S','NE','SW'])[1 + (i % 6)];
    road_ids := case when col_i = 0 then array[road_30] when col_i = 9 then array[road_40] else array[main_road] end;

    insert into public.plots (
      project_id, layout_version_id, phase_id, block_id, plot_number, plot_type, status,
      area_official_value, area_official_unit, area_calculated_sqft,
      dimensions, frontage_ft, depth_ft, facing, facing_source, corner_status, corner_source,
      adjacent_road_ids, road_width_primary_ft, price_total, rate_per_unit, rate_unit,
      price_visibility, booking_amount, geometry, centroid_x, centroid_y, tags,
      public_visibility, verified_fields
    ) values (
      '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c',
      phases[1 + (row_i % 2)], blocks[1 + (row_i % 4)],
      'P-' || (100 + i), 'residential', statuses[1 + (i % 8)],
      side, 'sqft', side,
      jsonb_build_array(
        jsonb_build_object('side', 'front', 'value', w, 'unit', 'ft'),
        jsonb_build_object('side', 'depth', 'value', d, 'unit', 'ft')
      ),
      w, d, facing_v::text, 'admin', case when is_corner then 'YES' else 'NO' end, 'admin',
      road_ids, case when col_i = 0 then 30 when col_i = 9 then 40 else 60 end,
      side * 1800, 1800, 'sqft', 'public', round(side * 1800 * 0.1),
      jsonb_build_object('type', 'Polygon', 'coordinates', jsonb_build_array(jsonb_build_array(
        jsonb_build_array(x, y), jsonb_build_array(x + w, y),
        jsonb_build_array(x + w, y + d), jsonb_build_array(x, y + d), jsonb_build_array(x, y)
      ))),
      x + w / 2, y + d / 2,
      case when is_corner then array['corner'] else '{}' end,
      true, array['area_official_value', 'facing', 'corner_status']
    );
  end loop;
end;
$$;

-- A couple of irregular (non-rectangular) plots, as the spec asks for.
update public.plots set geometry = jsonb_build_object(
  'type', 'Polygon',
  'coordinates', jsonb_build_array(jsonb_build_array(
    jsonb_build_array(centroid_x - 20, centroid_y - 15),
    jsonb_build_array(centroid_x + 22, centroid_y - 18),
    jsonb_build_array(centroid_x + 18, centroid_y + 20),
    jsonb_build_array(centroid_x - 15, centroid_y + 12),
    jsonb_build_array(centroid_x - 20, centroid_y - 15)
  ))
)
where plot_number in ('P-142', 'P-178');

-- A few plots priced in katha/decimal to test unit handling.
update public.plots set area_official_value = 3.2, area_official_unit = 'katha', area_calculated_sqft = round(3.2 * 1361.25)
where plot_number = 'P-105';
update public.plots set area_official_value = 5, area_official_unit = 'decimal', area_calculated_sqft = round(5 * 435.6)
where plot_number = 'P-110';

-- ---------------------------------------------------------------------------
-- 3 deliberate conflicts (§19): area mismatch, facing mismatch, duplicate
-- plot number in an import file (recorded as history, no plot row needed).
-- ---------------------------------------------------------------------------
update public.plots set area_conflict = true, verified_fields = array_remove(verified_fields, 'area_official_value')
where plot_number = 'P-101';
insert into public.data_conflicts (project_id, plot_id, field, "values", status, note)
select '00000000-0000-0000-0000-00000000000b', id, 'area_official_value',
  jsonb_build_array(
    jsonb_build_object('source', 'admin_entry', 'value', area_official_value),
    jsonb_build_object('source', 'layout_geometry', 'value', area_official_value + 50)
  ),
  'open', 'Layout trace measures 50 sq ft more than the inventory sheet.'
from public.plots where plot_number = 'P-101';

update public.plots set facing_source = 'admin', verified_fields = array_remove(verified_fields, 'facing')
where plot_number = 'P-107';
insert into public.data_conflicts (project_id, plot_id, field, "values", status, note)
select '00000000-0000-0000-0000-00000000000b', id, 'facing',
  jsonb_build_array(
    jsonb_build_object('source', 'admin_entry', 'value', facing),
    jsonb_build_object('source', 'layout_geometry', 'value', 'SE')
  ),
  'open', 'Geometry-derived facing disagrees with the admin-entered value.'
from public.plots where plot_number = 'P-107';

insert into public.data_conflicts (project_id, plot_id, field, "values", status, note)
values (
  '00000000-0000-0000-0000-00000000000b', null, 'plot_number',
  jsonb_build_array(
    jsonb_build_object('source', 'import_row_12', 'value', 'P-112'),
    jsonb_build_object('source', 'import_row_47', 'value', 'P-112')
  ),
  'open', 'Plot number P-112 appeared twice in inventory_2026_09.xlsx.'
);

-- ---------------------------------------------------------------------------
-- Landmarks, FAQs (EN + HI)
-- ---------------------------------------------------------------------------
insert into public.landmarks (project_id, name, category, lat, lng, distance_value, distance_unit, travel_time_min, distance_source, sort) values
  ('00000000-0000-0000-0000-00000000000b', 'NH-31 Highway', 'highway', 25.6150, 85.1450, 1.2, 'km', 3, 'calculated', 1),
  ('00000000-0000-0000-0000-00000000000b', 'Bankipur Railway Station', 'transit', 25.6300, 85.1600, 4.5, 'km', 12, 'calculated', 2),
  ('00000000-0000-0000-0000-00000000000b', 'City Hospital', 'hospital', 25.6050, 85.1300, 2.1, 'km', 6, 'calculated', 3),
  ('00000000-0000-0000-0000-00000000000b', 'Green Valley Public School', 'school', 25.6080, 85.1420, 0.8, 'km', 2, 'calculated', 4);

insert into public.faqs (project_id, q, a, lang, approved, sort) values
  ('00000000-0000-0000-0000-00000000000b', 'Is this project RERA registered?',
   'Yes — RERA number BRERA-DEMO-0001, registered with Bihar RERA. This is demo data.', 'en', true, 1),
  ('00000000-0000-0000-0000-00000000000b', 'क्या यह प्रोजेक्ट RERA में पंजीकृत है?',
   'हाँ — RERA नंबर BRERA-DEMO-0001, बिहार RERA में पंजीकृत। यह डेमो डेटा है।', 'hi', true, 1),
  ('00000000-0000-0000-0000-00000000000b', 'What is the booking amount?',
   'Booking amount is 10% of the plot price. Contact sales for exact figures.', 'en', true, 2),
  ('00000000-0000-0000-0000-00000000000b', 'बुकिंग राशि कितनी है?',
   'बुकिंग राशि प्लॉट मूल्य का 10% है। सटीक आंकड़ों के लिए बिक्री टीम से संपर्क करें।', 'hi', true, 2);

-- ---------------------------------------------------------------------------
-- 2 brokers with share links + 10 leads
-- ---------------------------------------------------------------------------
insert into public.share_links (project_id, code, kind, label, clicks) values
  ('00000000-0000-0000-0000-00000000000b', 'demo-raj', 'broker', 'Raj Kumar (Broker)', 24),
  ('00000000-0000-0000-0000-00000000000b', 'demo-priya', 'broker', 'Priya Singh (Broker)', 15);

insert into public.leads (project_id, plot_ids, name, phone, source, stage, requirement, share_link_id, consent_at)
select
  '00000000-0000-0000-0000-00000000000b',
  array(select id from public.plots where plot_number = 'P-1' || (10 + n) limit 1),
  'Demo Buyer ' || n,
  '+9198765430' || lpad(n::text, 2, '0'),
  (array['form','chat','whatsapp','call','site_visit'])[1 + (n % 5)],
  (array['new','contacted','visit_scheduled','visited','negotiation'])[1 + (n % 5)],
  jsonb_build_object('size_sqft', 1200, 'budget_lakh', 25),
  (select id from public.share_links where code = case when n % 2 = 0 then 'demo-raj' else 'demo-priya' end),
  now() - (n || ' days')::interval
from generate_series(1, 10) as n;

-- Backfill hold rows for plots seeded directly as HOLD (insert bypasses the
-- status guard trigger, which only fires on UPDATE), so holds_one_active
-- and the plot's status agree from the start.
insert into public.holds (project_id, plot_id, held_by_user, expires_at)
select project_id, id, '00000000-0000-0000-0000-000000000001', now() + interval '24 hours'
from public.plots where status = 'HOLD';
