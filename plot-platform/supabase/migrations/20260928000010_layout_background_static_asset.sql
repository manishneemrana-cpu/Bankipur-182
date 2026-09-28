-- Superseding 20260928000009: storing the reference raster inline as bytea
-- made every read/write of it prohibitively expensive to shuttle through
-- tooling. Source drawings are static per layout version and don't change
-- often, so they're checked into the app as a public static asset instead
-- (public/layout-backgrounds/{path}) and referenced here by path.
alter table public.layout_versions
  drop column background_image,
  drop column background_image_mime,
  add column background_image_path text;
