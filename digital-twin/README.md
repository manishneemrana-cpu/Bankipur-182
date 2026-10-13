# Digital Twin Viewer

Browser-based real-estate digital twin: a broker/buyer opens `yourdomain.com/view/{project-slug}` and navigates
**site → tower → floor → unit interior** in 3D, with amenity hotspots, a distance tool, day/night, and explicit
camera presets for live demos on a sales-office TV.

> This is the **viewer + admin tooling**. It does not convert 2D plans into 3D. A 3D artist builds the GLBs
> (Blender / SketchUp / Revit); this app hosts, configures and presents them.

```
apps/viewer          React + react-three-fiber + drei (Vite). Public, read-only.
apps/admin           React admin (Vite): projects, uploads, units, 3D hotspot placement, analytics.
apps/api             Node + Express. Public read API + token-guarded admin API + uploads.
packages/shared-types  zod schemas + TS types shared by all three.
tools/               Sample generator and the Draco/LOD optimiser CLI for artists.
supabase/migrations  Postgres schema (projects, towers, floors, unit_types, units, hotspots, analytics_events …).
```

## Run it (no accounts needed)

```bash
cd digital-twin
npm install
npm run dev          # api :8787 · viewer :5173 · admin :5174
```

* Viewer: <http://localhost:5173/view/skyline-residences> – ships with a procedurally generated, Draco-compressed
  sample project (2 towers, 22 floors, 88 units, 3 amenities).
* Admin: <http://localhost:5174> – the API prints a dev admin token at startup (or set `ADMIN_API_TOKEN`).
* With no `SUPABASE_*` set the API uses a local JSON file (`apps/api/data/db.json`, seeded from the sample) and disk
  uploads – **dev/demo only**.

`npm test` (API integration tests + camera/measure unit tests) · `npm run typecheck` · `npm run build`.

### Viewer controls
`1` Exterior · `2` Floor plan (top-down) · `3` Interior · `↑/↓` floors · `Esc` back · `N` day/night · `M` measure ·
`F` furnished/unfurnished · `V` walk-through (WASD/arrows, drag to look, on-screen pad on touch) · `?` help.
All controls are real buttons with visible focus, so TV-remote / keyboard navigation works. UI scales with screen
size (≈14 px on phones → 26 px on a 4K TV).

## Production setup

1. **Supabase**: run `supabase/migrations/0001_init.sql`; create a **public** Storage bucket `project-assets`.
2. **API** (any Node host): copy `.env.example`, set `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, a long random
   `ADMIN_API_TOKEN`, `CORS_ORIGINS` (viewer + admin origins), `NODE_ENV=production`; `npm run build -w @dt/api`,
   `node apps/api/dist/index.js`. In production the API refuses to start without these.
3. **Viewer / admin**: `npm run build -w @dt/viewer` (set `VITE_API_URL`) and deploy `dist/` to any static host. SPA
   rewrites for `/view/*` are in `vercel.json` / `public/_redirects`. Admin also needs `VITE_VIEWER_URL` for share links.

RLS is on for every table with **no policies**: the browser never talks to Postgres; everything goes through the API.

## GLB conventions (hand this to the 3D artist)

* glTF 2.0 binary, **Y-up, metres** (or set *Model scale* on the project). Run every export through
  `npm run optimize -- model.glb --out ./out` → `model.glb` (Draco) + `model.lod.glb` (simplified + Draco).
  The admin warns when an uploaded GLB is not Draco-compressed.
* **Site GLB**: ground, roads, amenities. Optional LOD.
* **Tower GLB** (origin = centre of footprint at ground level):
  one child node per floor named **`Floor_01 … Floor_NN`** (prefix configurable). Optional children of each floor:
  `Shell*` (facade – hidden when that floor is cut away), `Slab`, `Partitions`; optional `Roof` node. Materials whose name
  contains `Window` glow at night. Towers are positioned in the site via *Position/Rotation* in the admin.
* **Unit-type GLB** (2BHK/3BHK interior; origin = centre of floor plate, y=0 floor): `Wall*` nodes collide in
  walk-through, `Furniture*` toggle the furnished view, `Ceiling*` hides in the dollhouse view. Room label anchors and the
  walk spawn point are set in the admin (*Unit types*).
* Floors can optionally have their own GLB (admin → *Towers & floors*); otherwise the tower GLB's `Floor_NN` node is used.
* Unit outlines (clickable polygons on the floor view) are defined in the admin (*Units*): repeat a typical-floor
  "slot" across a floor range, then re-tag individual units or bulk-assign a type.

## Performance design

* Draco decoder is served from our own origin (no CDN dependency on sales-office Wi-Fi).
* First paint needs only the project JSON + the **LOD** site/tower meshes (≈ KBs here). Full-detail meshes stream in
  when the camera gets close (distance-gated LOD with hysteresis); floor and unit-interior GLBs load only when navigated to.
* three.js / R3F are code-split and start downloading in parallel with the project JSON.
* DPR capped (1.0 on 4K screens), shadows auto-disable if `PerformanceMonitor` reports a decline.
* Measured on the sample build (headless Chromium, software GL, 4× CPU throttle, 10 Mbit/s): tower markers
  clickable in ≈ 3 s. Real projects with heavy GLBs must be checked on real hardware – budget the LOD meshes (< ~1 MB).

## Optional: floor-plan assist (adapter, **not wired to paid APIs**)

`apps/api/src/floorplan/` defines `FloorPlanAnalysisProvider` with `mock`, `cubicasa`, `archilogic` implementations.
The CubiCasa and Archilogic classes are **stubs with TODOs that return a clearly-flagged mock** – no paid call is made
until you confirm keys are ready and the real endpoints/response shapes are reviewed. Output is a normalised JSON
trace reference for the artist (admin → *Floor-plan assist*); it is never published to the viewer.

## Known limitations / next steps

* **Admin auth is a single shared bearer token.** Fine for a small internal team behind HTTPS; replace with Supabase Auth
  (JWT verification + roles) before wider use.
* Uploads pass through the API (300 MB cap, streamed to Storage). For very large GLBs move to signed direct-to-Storage uploads.
* Analytics are aggregated in the API from raw events (last N days, paged); at high volume add a SQL aggregate/rollup.
* Walk-through collision is axis-aligned boxes from `Wall*` meshes (no stairs, no sloped geometry).
* Marker pins are not occlusion-tested (they show through buildings).
* The sample geometry is deliberately primitive; the Supabase code path (`SupabaseDb`/`SupabaseStorage`) is written
  against the schema but has not been run against a live project in this repo's tests.
* Unit outlines are entered as rectangles in the admin (a polygon-drawing tool would be a natural addition).
