-- Phase 7: layout upload storage + publishing a traced layout version.
-- Tracing itself (plots/roads/zones geometry, calibration) reuses the
-- existing plots/roads/zones/layout_versions tables and their RLS policies
-- from earlier phases — nothing new is needed there.

-- ---------------------------------------------------------------------------
-- Storage bucket for uploaded layout source files (PDF/image). Private:
-- every read goes through a signed URL issued to a project member.
-- Path convention: {project_id}/{file_id}.{ext} — the first path segment is
-- the project id, checked against project membership below.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict (id) do nothing;

create policy layout_files_select on storage.objects for select to authenticated
  using (
    bucket_id = 'project-files'
    and app.has_project_role(
      (storage.foldername(name))[1]::uuid,
      'org_admin', 'manager', 'sales', 'viewer', 'ops_mapper'
    )
  );
create policy layout_files_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-files'
    and app.has_project_role((storage.foldername(name))[1]::uuid, 'org_admin', 'manager', 'ops_mapper')
  );
create policy layout_files_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'project-files'
    and app.has_project_role((storage.foldername(name))[1]::uuid, 'org_admin', 'manager', 'ops_mapper')
  );

-- ---------------------------------------------------------------------------
-- Publish a traced layout version (§7.1 step 12): supersede whatever was
-- published before, mark this one published. Gated on the same honesty
-- rules as the rest of the app — rule 4: nothing with an open conflict, and
-- there must be at least something traced, or "publish" would silently
-- replace a working site with an empty one.
-- ---------------------------------------------------------------------------
create or replace function public.publish_layout_version(p_layout_version uuid)
returns public.layout_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lv public.layout_versions;
  v_open_conflicts int;
  v_plot_count int;
begin
  select * into v_lv from public.layout_versions where id = p_layout_version for update;
  if v_lv.id is null or not app.has_project_role(v_lv.project_id, 'org_admin', 'manager') then
    raise exception 'NOT_ALLOWED';
  end if;
  if v_lv.status = 'published' then
    return v_lv;
  end if;

  select count(*) into v_plot_count
  from public.plots where layout_version_id = p_layout_version;
  if v_plot_count = 0 then
    raise exception 'NOTHING_TRACED';
  end if;

  select count(*) into v_open_conflicts
  from public.data_conflicts c
  join public.plots p on p.id = c.plot_id
  where p.layout_version_id = p_layout_version and c.status = 'open';
  if v_open_conflicts > 0 then
    raise exception 'OPEN_CONFLICTS' using detail = v_open_conflicts::text;
  end if;

  update public.layout_versions
  set status = 'superseded'
  where project_id = v_lv.project_id and status = 'published' and id <> p_layout_version;

  update public.layout_versions
  set status = 'published', approved_by = auth.uid(), approved_at = now()
  where id = p_layout_version
  returning * into v_lv;

  return v_lv;
end;
$$;
revoke execute on function public.publish_layout_version(uuid) from public, anon;
grant execute on function public.publish_layout_version(uuid) to authenticated;
