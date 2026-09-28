-- Inventory rules enforced in the database (§8): status state machine,
-- anti-double-booking holds, audit trails and the conflict guard (rule 4).

-- ---------------------------------------------------------------------------
-- Default state machine (org_id null). An org that defines any rules of its
-- own replaces the defaults entirely.
-- NOT_RELEASED -> AVAILABLE -> HOLD -> RESERVED -> BOOKED -> SOLD
-- BLOCKED / UNAVAILABLE from any state by manager+. Backward moves need a reason.
-- ---------------------------------------------------------------------------
insert into public.status_transition_rules (org_id, from_status, to_status, min_role, requires_reason)
values
  (null, 'NOT_RELEASED', 'AVAILABLE', 'manager', false),
  (null, 'AVAILABLE', 'NOT_RELEASED', 'manager', true),
  (null, 'AVAILABLE', 'HOLD', 'sales', false),
  (null, 'AVAILABLE', 'RESERVED', 'sales', false),
  (null, 'HOLD', 'AVAILABLE', 'sales', true),
  (null, 'HOLD', 'RESERVED', 'sales', false),
  (null, 'RESERVED', 'BOOKED', 'sales', false),
  (null, 'RESERVED', 'AVAILABLE', 'manager', true),
  (null, 'BOOKED', 'SOLD', 'manager', false),
  (null, 'BOOKED', 'AVAILABLE', 'manager', true),
  (null, 'SOLD', 'AVAILABLE', 'org_admin', true),
  (null, 'BLOCKED', 'AVAILABLE', 'manager', true),
  (null, 'BLOCKED', 'NOT_RELEASED', 'manager', true),
  (null, 'UNAVAILABLE', 'AVAILABLE', 'manager', true),
  (null, 'UNAVAILABLE', 'NOT_RELEASED', 'manager', true);

insert into public.status_transition_rules (org_id, from_status, to_status, min_role, requires_reason)
select null, s, t, 'manager', false
from unnest(array['AVAILABLE', 'HOLD', 'RESERVED', 'BOOKED', 'SOLD', 'NOT_RELEASED', 'UNAVAILABLE', 'BLOCKED']) s
cross join unnest(array['BLOCKED', 'UNAVAILABLE']) t
where s <> t;

create or replace function app.find_transition_rule(p_org uuid, p_from text, p_to text)
returns public.status_transition_rules
language sql
stable
security definer
set search_path = ''
as $$
  select r.*
  from public.status_transition_rules r
  where r.from_status = p_from
    and r.to_status = p_to
    and (
      r.org_id = p_org
      or (r.org_id is null and not exists (
        select 1 from public.status_transition_rules o where o.org_id = p_org
      ))
    )
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Status guard: validates every status change, logs history, settles holds.
-- Context comes from transaction-local settings set by the RPCs below:
--   app.status_reason, app.status_source, app.system_action
-- ---------------------------------------------------------------------------
create or replace function app.plots_status_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_system boolean := coalesce(current_setting('app.system_action', true), '') = 'on';
  v_reason text := nullif(current_setting('app.status_reason', true), '');
  v_source text := coalesce(nullif(current_setting('app.status_source', true), ''), 'admin');
  v_role text;
  v_rule public.status_transition_rules;
  v_holder uuid;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status = 'HOLD' and not exists (
      select 1 from public.holds where plot_id = new.id and status = 'active'
    ) then
      raise exception 'USE_PLACE_HOLD' using hint = 'Put plots on hold with place_hold()';
    end if;

    if v_uid is not null and not v_system
       and not (coalesce(current_setting('app.import_action', true), '') = 'on'
                and app.role_rank(app.project_role(new.project_id)) >= app.role_rank('manager')) then
      v_role := app.project_role(new.project_id);
      v_rule := app.find_transition_rule(new.org_id, old.status, new.status);
      if v_rule.id is null then
        raise exception 'TRANSITION_NOT_ALLOWED' using detail = old.status || ' -> ' || new.status;
      end if;
      if app.role_rank(v_role) < app.role_rank(v_rule.min_role) then
        raise exception 'ROLE_NOT_ALLOWED' using detail = coalesce(v_role, 'none') || ' < ' || v_rule.min_role;
      end if;
      if v_rule.requires_reason and v_reason is null then
        raise exception 'REASON_REQUIRED' using detail = old.status || ' -> ' || new.status;
      end if;
      if old.status = 'HOLD' then
        select held_by_user into v_holder from public.holds where plot_id = new.id and status = 'active';
        if v_holder is not null and v_holder <> v_uid and app.role_rank(v_role) < app.role_rank('manager') then
          raise exception 'HELD_BY_ANOTHER_USER';
        end if;
      end if;
    end if;

    if old.status = 'HOLD' then
      update public.holds
      set status = case when new.status in ('RESERVED', 'BOOKED', 'SOLD') then 'converted' else 'released' end,
          released_reason = coalesce(v_reason, released_reason)
      where plot_id = new.id and status = 'active';
    end if;
  end if;

  new.last_inventory_update := now();
  new.inventory_updated_by := v_uid;

  insert into public.plot_status_history
    (org_id, project_id, plot_id, from_status, to_status, changed_by, reason, source, created_by)
  values
    (new.org_id, new.project_id, new.id, case when tg_op = 'UPDATE' then old.status end,
     new.status, v_uid, v_reason, case when v_system then 'system' else v_source end, v_uid);

  return new;
end;
$$;

create trigger status_guard before update of status on public.plots
  for each row execute function app.plots_status_guard();

-- History for newly created plots is written after insert (FK needs the row).
create or replace function app.plots_initial_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.plot_status_history
    (org_id, project_id, plot_id, from_status, to_status, changed_by, reason, source, created_by)
  values
    (new.org_id, new.project_id, new.id, null, new.status, auth.uid(),
     nullif(current_setting('app.status_reason', true), ''),
     coalesce(nullif(current_setting('app.status_source', true), ''), 'admin'), auth.uid());
  return new;
end;
$$;

create trigger initial_history after insert on public.plots
  for each row execute function app.plots_initial_history();

-- ---------------------------------------------------------------------------
-- Field audit: price, area and other buyer-facing facts.
-- ---------------------------------------------------------------------------
create or replace function app.plots_field_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  f text;
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
begin
  foreach f in array array[
    'plot_number', 'plot_type', 'area_official_value', 'area_official_unit', 'dimensions',
    'frontage_ft', 'depth_ft', 'facing', 'corner_status', 'road_width_primary_ft',
    'price_total', 'rate_per_unit', 'rate_unit', 'price_visibility', 'internal_price',
    'plc_charges', 'booking_amount', 'public_visibility', 'tags', 'geometry', 'verified_fields'
  ] loop
    if v_old -> f is distinct from v_new -> f then
      insert into public.field_change_log
        (org_id, project_id, entity, entity_id, field, old_value, new_value, changed_by, reason, created_by)
      values
        (new.org_id, new.project_id, 'plot', new.id, f, v_old -> f, v_new -> f, auth.uid(),
         nullif(current_setting('app.change_reason', true), ''), auth.uid());
    end if;
  end loop;
  return new;
end;
$$;

create trigger field_audit after update on public.plots
  for each row execute function app.plots_field_audit();

-- ---------------------------------------------------------------------------
-- Conflict guard (rule 4): a field with an open conflict can't be verified,
-- and opening a conflict un-verifies the field.
-- ---------------------------------------------------------------------------
create or replace function app.plots_verified_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  f text;
begin
  foreach f in array new.verified_fields loop
    if (tg_op = 'INSERT' or not (f = any (old.verified_fields))) and exists (
      select 1 from public.data_conflicts
      where plot_id = new.id and field = f and status = 'open'
    ) then
      raise exception 'FIELD_HAS_OPEN_CONFLICT' using detail = f;
    end if;
  end loop;
  return new;
end;
$$;

create trigger verified_guard before insert or update of verified_fields on public.plots
  for each row execute function app.plots_verified_guard();

create or replace function app.conflicts_sync_plot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.plot_id is null then
    return new;
  end if;
  update public.plots p
  set verified_fields = case
        when new.status = 'open' then array_remove(p.verified_fields, new.field)
        else p.verified_fields
      end,
      area_conflict = exists (
        select 1 from public.data_conflicts c
        where c.plot_id = p.id and c.status = 'open' and c.field like 'area%'
      )
  where p.id = new.plot_id;
  return new;
end;
$$;

create trigger sync_plot after insert or update of status on public.data_conflicts
  for each row execute function app.conflicts_sync_plot();

-- Records a conflict, merging new evidence into the open one for plot+field.
create or replace function public.record_conflict(
  p_plot uuid, p_field text, p_values jsonb, p_note text default null
)
returns public.data_conflicts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plot public.plots;
  v_row public.data_conflicts;
begin
  select * into v_plot from public.plots where id = p_plot;
  if v_plot.id is null or not app.has_project_role(v_plot.project_id, 'org_admin', 'manager', 'ops_mapper') then
    raise exception 'NOT_ALLOWED';
  end if;
  insert into public.data_conflicts (project_id, plot_id, field, "values", note)
  values (v_plot.project_id, p_plot, p_field, p_values, p_note)
  on conflict (plot_id, field) where status = 'open'
  do update set "values" = (
      select jsonb_agg(distinct e) from jsonb_array_elements(public.data_conflicts."values" || excluded."values") e
    ),
    note = coalesce(excluded.note, public.data_conflicts.note)
  returning * into v_row;
  return v_row;
end;
$$;

-- Fields a conflict resolution may write back to the plot.
create or replace function public.resolve_conflict(p_conflict uuid, p_value jsonb, p_note text default null)
returns public.data_conflicts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.data_conflicts;
begin
  select * into v_c from public.data_conflicts where id = p_conflict for update;
  if v_c.id is null or not app.has_project_role(v_c.project_id, 'org_admin', 'manager', 'ops_mapper') then
    raise exception 'NOT_ALLOWED';
  end if;
  if v_c.status <> 'open' then
    raise exception 'ALREADY_RESOLVED';
  end if;

  update public.data_conflicts
  set status = 'resolved', resolved_value = p_value, resolved_by = auth.uid(),
      resolved_at = now(), note = coalesce(p_note, note)
  where id = p_conflict
  returning * into v_c;

  if v_c.plot_id is not null and p_value is not null and jsonb_typeof(p_value) <> 'null' then
    perform set_config('app.change_reason', 'Conflict resolved: ' || coalesce(p_note, v_c.field), true);
    case v_c.field
      when 'area_official_value' then
        update public.plots set area_official_value = (p_value #>> '{}')::numeric where id = v_c.plot_id;
      when 'frontage_ft' then
        update public.plots set frontage_ft = (p_value #>> '{}')::numeric where id = v_c.plot_id;
      when 'depth_ft' then
        update public.plots set depth_ft = (p_value #>> '{}')::numeric where id = v_c.plot_id;
      when 'road_width_primary_ft' then
        update public.plots set road_width_primary_ft = (p_value #>> '{}')::numeric where id = v_c.plot_id;
      when 'facing' then
        update public.plots set facing = p_value #>> '{}', facing_source = 'admin' where id = v_c.plot_id;
      when 'corner_status' then
        update public.plots set corner_status = p_value #>> '{}', corner_source = 'admin' where id = v_c.plot_id;
      when 'dimensions' then
        update public.plots set dimensions = p_value where id = v_c.plot_id;
      else
        null; -- e.g. duplicate plot numbers: resolution is recorded, nothing to write back
    end case;
    if v_c.field in ('area_official_value', 'frontage_ft', 'depth_ft', 'road_width_primary_ft',
                     'facing', 'corner_status', 'dimensions') then
      update public.plots
      set verified_fields = array_append(array_remove(verified_fields, v_c.field), v_c.field)
      where id = v_c.plot_id;
    end if;
  end if;
  return v_c;
end;
$$;

-- ---------------------------------------------------------------------------
-- Status changes (single + bulk)
-- ---------------------------------------------------------------------------
create or replace function public.change_plot_status(p_plot uuid, p_status text, p_reason text default null)
returns public.plots
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plot public.plots;
begin
  select * into v_plot from public.plots where id = p_plot for update;
  if v_plot.id is null or app.project_role(v_plot.project_id) is null then
    raise exception 'PLOT_NOT_FOUND';
  end if;
  if app.role_rank(app.project_role(v_plot.project_id)) < app.role_rank('sales') then
    raise exception 'ROLE_NOT_ALLOWED';
  end if;
  perform set_config('app.status_reason', coalesce(p_reason, ''), true);
  perform set_config('app.status_source', 'admin', true);
  update public.plots set status = p_status where id = p_plot returning * into v_plot;
  return v_plot;
end;
$$;

create or replace function public.change_plots_status(p_plots uuid[], p_status text, p_reason text default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_n int := 0;
begin
  foreach v_id in array p_plots loop
    perform public.change_plot_status(v_id, p_status, p_reason);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Holds (anti-double-booking)
-- ---------------------------------------------------------------------------
create or replace function app.expire_hold(p_hold public.holds)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.holds set status = 'released', released_reason = 'Hold expired'
  where id = p_hold.id and status = 'active';
  perform set_config('app.system_action', 'on', true);
  perform set_config('app.status_reason', 'Hold expired', true);
  update public.plots set status = 'AVAILABLE' where id = p_hold.plot_id and status = 'HOLD';
  perform set_config('app.system_action', '', true);
  insert into public.notifications (org_id, user_id, kind, payload)
  values (p_hold.org_id, p_hold.held_by_user, 'hold_expired',
          jsonb_build_object('plot_id', p_hold.plot_id, 'hold_id', p_hold.id));
end;
$$;

create or replace function public.release_expired_holds()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold public.holds;
  v_n int := 0;
begin
  for v_hold in
    select * from public.holds where status = 'active' and expires_at <= now() for update skip locked
  loop
    perform app.expire_hold(v_hold);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

create or replace function public.place_hold(p_plot uuid, p_lead uuid default null, p_hours numeric default null)
returns public.holds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plot public.plots;
  v_role text;
  v_expired public.holds;
  v_hours numeric;
  v_hold public.holds;
begin
  -- Row lock: concurrent callers queue here and re-read the committed status.
  select * into v_plot from public.plots where id = p_plot for update;
  v_role := app.project_role(v_plot.project_id);
  if v_plot.id is null or v_role is null then
    raise exception 'PLOT_NOT_FOUND';
  end if;
  if app.role_rank(v_role) < app.role_rank('sales') then
    raise exception 'ROLE_NOT_ALLOWED';
  end if;

  select * into v_expired from public.holds
  where plot_id = p_plot and status = 'active' and expires_at <= now();
  if v_expired.id is not null then
    perform app.expire_hold(v_expired);
    select * into v_plot from public.plots where id = p_plot;
  end if;

  if v_plot.status <> 'AVAILABLE' then
    raise exception 'PLOT_NOT_AVAILABLE' using detail = v_plot.status;
  end if;

  v_hours := coalesce(
    p_hours,
    (select (value #>> '{}')::numeric from public.settings where org_id = v_plot.org_id and key = 'hold_hours'),
    24
  );
  if v_hours < 1 or v_hours > 168 then
    raise exception 'INVALID_HOLD_HOURS';
  end if;

  insert into public.holds (project_id, plot_id, held_by_user, lead_id, expires_at, created_by)
  values (v_plot.project_id, p_plot, auth.uid(), p_lead, now() + make_interval(secs => v_hours * 3600), auth.uid())
  returning * into v_hold;

  perform set_config('app.status_source', 'booking', true);
  perform set_config('app.status_reason', 'Hold placed', true);
  update public.plots set status = 'HOLD' where id = p_plot;
  return v_hold;
end;
$$;

create or replace function public.release_hold(p_hold uuid, p_reason text)
returns public.plots
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold public.holds;
begin
  select * into v_hold from public.holds where id = p_hold and status = 'active';
  if v_hold.id is null or app.project_role(v_hold.project_id) is null then
    raise exception 'HOLD_NOT_FOUND';
  end if;
  return public.change_plot_status(v_hold.plot_id, 'AVAILABLE', p_reason);
end;
$$;

-- ---------------------------------------------------------------------------
-- Import apply: one atomic upsert by plot_number. Only keys present in a row
-- are written. Status changes are logged with source = 'import'; the import is
-- treated as the manager's authoritative sheet, so the step-by-step state
-- machine is not applied, but HOLD can never be imported (holds need a holder).
-- ---------------------------------------------------------------------------
create or replace function public.apply_inventory_import(p_import uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_imp public.inventory_imports;
  r jsonb;
  v_plot public.plots;
  v_block uuid;
  v_phase uuid;
  v_inserted int := 0;
  v_updated int := 0;
begin
  select * into v_imp from public.inventory_imports where id = p_import for update;
  if v_imp.id is null or not app.has_project_role(v_imp.project_id, 'org_admin', 'manager') then
    raise exception 'NOT_ALLOWED';
  end if;
  if v_imp.status not in ('ready', 'has_errors') then
    raise exception 'IMPORT_NOT_READY' using detail = v_imp.status;
  end if;

  perform set_config('app.change_reason', 'Imported from ' || coalesce(v_imp.file_name, 'file'), true);
  perform set_config('app.status_reason', 'Imported from ' || coalesce(v_imp.file_name, 'file'), true);
  perform set_config('app.status_source', 'import', true);
  perform set_config('app.import_action', 'on', true);

  for r in select * from jsonb_array_elements(p_rows) loop
    if r ->> 'status' = 'HOLD' then
      raise exception 'HOLD_NOT_IMPORTABLE' using detail = r ->> 'plot_number';
    end if;

    v_block := null;
    if nullif(r ->> 'block', '') is not null then
      insert into public.blocks (project_id, name) values (v_imp.project_id, r ->> 'block')
      on conflict (project_id, name) do update set name = excluded.name
      returning id into v_block;
    end if;
    v_phase := null;
    if nullif(r ->> 'phase', '') is not null then
      insert into public.phases (project_id, name) values (v_imp.project_id, r ->> 'phase')
      on conflict (project_id, name) do update set name = excluded.name
      returning id into v_phase;
    end if;

    select * into v_plot from public.plots
    where project_id = v_imp.project_id and plot_number = r ->> 'plot_number' for update;

    if v_plot.id is null then
      insert into public.plots (
        project_id, plot_number, plot_type, status, area_official_value, area_official_unit,
        frontage_ft, depth_ft, dimensions, facing, facing_source, corner_status, corner_source,
        road_width_primary_ft, price_total, rate_per_unit, rate_unit, price_visibility,
        booking_amount, block_id, phase_id, tags, public_notes, internal_notes
      ) values (
        v_imp.project_id, r ->> 'plot_number',
        coalesce(r ->> 'plot_type', 'residential'),
        coalesce(r ->> 'status', 'NOT_RELEASED'),
        (r ->> 'area_official_value')::numeric, r ->> 'area_official_unit',
        (r ->> 'frontage_ft')::numeric, (r ->> 'depth_ft')::numeric,
        coalesce(r -> 'dimensions', '[]'::jsonb),
        coalesce(r ->> 'facing', 'UNKNOWN'), case when r ? 'facing' then 'admin' end,
        coalesce(r ->> 'corner_status', 'UNKNOWN'), case when r ? 'corner_status' then 'admin' end,
        (r ->> 'road_width_primary_ft')::numeric, (r ->> 'price_total')::numeric,
        (r ->> 'rate_per_unit')::numeric, r ->> 'rate_unit',
        coalesce(r ->> 'price_visibility', 'public'), (r ->> 'booking_amount')::numeric,
        v_block, v_phase,
        coalesce(array(select jsonb_array_elements_text(r -> 'tags')), '{}'),
        r ->> 'public_notes', r ->> 'internal_notes'
      );
      v_inserted := v_inserted + 1;
    else
      update public.plots set
        plot_type = case when r ? 'plot_type' then r ->> 'plot_type' else plot_type end,
        status = case when r ? 'status' then r ->> 'status' else status end,
        area_official_value = case when r ? 'area_official_value' then (r ->> 'area_official_value')::numeric else area_official_value end,
        area_official_unit = case when r ? 'area_official_unit' then r ->> 'area_official_unit' else area_official_unit end,
        frontage_ft = case when r ? 'frontage_ft' then (r ->> 'frontage_ft')::numeric else frontage_ft end,
        depth_ft = case when r ? 'depth_ft' then (r ->> 'depth_ft')::numeric else depth_ft end,
        dimensions = case when r ? 'dimensions' then r -> 'dimensions' else dimensions end,
        facing = case when r ? 'facing' then r ->> 'facing' else facing end,
        facing_source = case when r ? 'facing' then 'admin' else facing_source end,
        corner_status = case when r ? 'corner_status' then r ->> 'corner_status' else corner_status end,
        corner_source = case when r ? 'corner_status' then 'admin' else corner_source end,
        road_width_primary_ft = case when r ? 'road_width_primary_ft' then (r ->> 'road_width_primary_ft')::numeric else road_width_primary_ft end,
        price_total = case when r ? 'price_total' then (r ->> 'price_total')::numeric else price_total end,
        rate_per_unit = case when r ? 'rate_per_unit' then (r ->> 'rate_per_unit')::numeric else rate_per_unit end,
        rate_unit = case when r ? 'rate_unit' then r ->> 'rate_unit' else rate_unit end,
        price_visibility = case when r ? 'price_visibility' then r ->> 'price_visibility' else price_visibility end,
        booking_amount = case when r ? 'booking_amount' then (r ->> 'booking_amount')::numeric else booking_amount end,
        block_id = case when r ? 'block' then v_block else block_id end,
        phase_id = case when r ? 'phase' then v_phase else phase_id end,
        tags = case when r ? 'tags' then coalesce(array(select jsonb_array_elements_text(r -> 'tags')), '{}') else tags end,
        public_notes = case when r ? 'public_notes' then r ->> 'public_notes' else public_notes end,
        internal_notes = case when r ? 'internal_notes' then r ->> 'internal_notes' else internal_notes end
      where id = v_plot.id;
      v_updated := v_updated + 1;
    end if;
  end loop;

  perform set_config('app.import_action', '', true);

  update public.inventory_imports
  set status = 'applied', applied_by = auth.uid(), applied_at = now(),
      summary = summary || jsonb_build_object('inserted', v_inserted, 'updated', v_updated)
  where id = p_import;

  insert into public.audit_log (org_id, action, entity, entity_id, payload)
  values (v_imp.org_id, 'inventory_import.applied', 'inventory_import', p_import,
          jsonb_build_object('inserted', v_inserted, 'updated', v_updated));

  return jsonb_build_object('inserted', v_inserted, 'updated', v_updated);
end;
$$;

-- Execute rights: authenticated users only; each function checks roles itself.
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.change_plot_status(uuid, text, text)',
    'public.change_plots_status(uuid[], text, text)',
    'public.place_hold(uuid, uuid, numeric)',
    'public.release_hold(uuid, text)',
    'public.record_conflict(uuid, text, jsonb, text)',
    'public.resolve_conflict(uuid, jsonb, text)',
    'public.apply_inventory_import(uuid, jsonb)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
revoke execute on function public.release_expired_holds() from public, anon, authenticated;
grant execute on function public.release_expired_holds() to service_role;

-- Expire holds every 5 minutes where pg_cron exists (Supabase); elsewhere the
-- app calls release_expired_holds() on read.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('release-expired-holds', '*/5 * * * *', 'select public.release_expired_holds()');
  end if;
end;
$$;
