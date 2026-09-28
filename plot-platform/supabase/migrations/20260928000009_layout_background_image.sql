-- Reference raster of the original source drawing (survey PDF/scan), shown as
-- a faint underlay behind the traced plots/roads/zones on both the admin
-- tracing editor and the public buyer map, so viewers can visually cross-check
-- the interactive layout against the real document. Stored inline (not in the
-- `project-files` storage bucket) because that bucket's RLS restricts reads to
-- authenticated project members, but this image must be readable by anonymous
-- buyers on the public site.
alter table public.layout_versions
  add column background_image bytea,
  add column background_image_mime text,
  add column background_width_ft numeric,
  add column background_height_ft numeric,
  add column background_opacity numeric not null default 0.45;
