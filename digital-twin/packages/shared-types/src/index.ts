import { z } from 'zod';

/**
 * Coordinate conventions (important for the 3D artist and for every app):
 *  - glTF is Y-up, right-handed. 1 model unit = `project.model_scale` metres (default 1 → export in metres).
 *  - Site space: the site GLB's own origin. Towers are placed in site space via `tower.position` / `tower.rotation_y`.
 *  - Tower-local space: origin at the centre of the tower footprint at ground level. Floor N sits at `floor.elevation`.
 *  - Unit outlines are [x, z] pairs in tower-local space. Hotspot positions are in site space.
 *  - Unit-type GLBs (interiors) use their own space, origin at the centre of the floor plate, y = 0 on the floor.
 */

export const Vec2 = z.tuple([z.number(), z.number()]);
export const Vec3 = z.tuple([z.number(), z.number(), z.number()]);
export type Vec2 = z.infer<typeof Vec2>;
export type Vec3 = z.infer<typeof Vec3>;

const id = z.string().uuid();
const isoDate = z.string();
const url = z.string().min(1).max(2048); // absolute URL or an API-relative path like /files/...

export const slugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase letters, digits and single dashes only');

/* ------------------------------------------------------------------ entities */

export const ProjectSchema = z.object({
  id,
  slug: slugSchema,
  name: z.string().min(1).max(200),
  location: z.string().max(300).default(''),
  description: z.string().max(5000).nullable().default(null),
  cover_image_url: url.nullable().default(null),
  /** Full-detail site GLB (ground, amenities, landscaping). Optional if towers alone are enough. */
  site_glb_url: url.nullable().default(null),
  /** Simplified site mesh used at far zoom. */
  site_lod_glb_url: url.nullable().default(null),
  /** Metres per model unit. Drives the measurement tool. */
  model_scale: z.number().positive().default(1),
  is_published: z.boolean().default(false),
  created_at: isoDate,
});
export type Project = z.infer<typeof ProjectSchema>;

export const TowerSchema = z.object({
  id,
  project_id: id,
  name: z.string().min(1).max(100),
  /** Full tower GLB. Floors are child nodes named `${floor_node_prefix}${NN}` (Floor_01, Floor_02 …). */
  glb_url: url.nullable().default(null),
  /** Simplified single-mesh tower for far zoom. */
  lod_glb_url: url.nullable().default(null),
  floor_count: z.number().int().min(1).max(250),
  floor_height: z.number().positive().default(3),
  floor_node_prefix: z.string().default('Floor_'),
  footprint_w: z.number().positive().default(24),
  footprint_d: z.number().positive().default(14),
  position: Vec3.default([0, 0, 0]),
  rotation_y: z.number().default(0),
  sort_order: z.number().int().default(0),
});
export type Tower = z.infer<typeof TowerSchema>;

export const FloorSchema = z.object({
  id,
  tower_id: id,
  floor_number: z.number().int().min(1),
  label: z.string().max(50).nullable().default(null),
  /** Metres above tower base. Default (n-1)*floor_height. */
  elevation: z.number(),
  /** Optional dedicated floor GLB; otherwise the tower GLB's Floor_NN node is used. */
  glb_url: url.nullable().default(null),
});
export type Floor = z.infer<typeof FloorSchema>;

export const RoomSchema = z.object({
  name: z.string().min(1).max(60),
  /** Label anchor in unit-type space. */
  position: Vec3,
  area_sqm: z.number().nonnegative().nullable().default(null),
});
export type Room = z.infer<typeof RoomSchema>;

export const UnitTypeSchema = z.object({
  id,
  project_id: id,
  code: z.string().min(1).max(20), // "2BHK", "3BHK"
  name: z.string().min(1).max(100),
  /** Interior GLB. Nodes named Wall* collide when walking; Furniture* toggle furnished view; Ceiling* hidden in orbit view. */
  glb_url: url.nullable().default(null),
  area_sqm: z.number().nonnegative().nullable().default(null),
  bedrooms: z.number().int().min(0).default(2),
  bathrooms: z.number().int().min(0).default(2),
  rooms: z.array(RoomSchema).default([]),
  spawn: Vec3.default([0, 1.6, 0]),
});
export type UnitType = z.infer<typeof UnitTypeSchema>;

export const UnitStatus = z.enum(['available', 'hold', 'sold']);
export type UnitStatus = z.infer<typeof UnitStatus>;

export const UnitSchema = z.object({
  id,
  tower_id: id,
  floor_number: z.number().int().min(1),
  unit_type_id: id,
  label: z.string().min(1).max(30), // "1204"
  outline: z.array(Vec2).min(3),
  area_sqm: z.number().nonnegative().nullable().default(null),
  status: UnitStatus.default('available'),
});
export type Unit = z.infer<typeof UnitSchema>;

export const HotspotCategory = z.enum(['pool', 'clubhouse', 'garden', 'gym', 'parking', 'play', 'other']);
export type HotspotCategory = z.infer<typeof HotspotCategory>;

export const HotspotSchema = z.object({
  id,
  project_id: id,
  tower_id: id.nullable().default(null),
  title: z.string().min(1).max(120),
  description: z.string().max(2000).default(''),
  photo_url: url.nullable().default(null),
  category: HotspotCategory.default('other'),
  position: Vec3,
});
export type Hotspot = z.infer<typeof HotspotSchema>;

/** Everything the public viewer needs in a single request. */
export interface ProjectBundle {
  project: Project;
  towers: Tower[];
  floors: Floor[];
  unit_types: UnitType[];
  units: Unit[];
  hotspots: Hotspot[];
}

/* ------------------------------------------------------------- write inputs */

const omitServer = { id: true, created_at: true } as const;

export const ProjectInput = ProjectSchema.omit(omitServer).partial({
  location: true, description: true, cover_image_url: true, site_glb_url: true,
  site_lod_glb_url: true, model_scale: true, is_published: true,
});
export type ProjectInput = z.infer<typeof ProjectInput>;
export const ProjectPatch = ProjectInput.partial();

export const TowerInput = TowerSchema.omit({ id: true, project_id: true }).partial({
  glb_url: true, lod_glb_url: true, floor_height: true, floor_node_prefix: true, footprint_w: true,
  footprint_d: true, position: true, rotation_y: true, sort_order: true,
});
export type TowerInput = z.infer<typeof TowerInput>;
export const TowerPatch = TowerInput.partial();

export const FloorPatch = z.object({
  label: z.string().max(50).nullable().optional(),
  elevation: z.number().optional(),
  glb_url: url.nullable().optional(),
});

export const UnitTypeInput = UnitTypeSchema.omit({ id: true, project_id: true }).partial({
  glb_url: true, area_sqm: true, bedrooms: true, bathrooms: true, rooms: true, spawn: true,
});
export type UnitTypeInput = z.infer<typeof UnitTypeInput>;
export const UnitTypePatch = UnitTypeInput.partial();

export const HotspotInput = HotspotSchema.omit({ id: true, project_id: true }).partial({
  tower_id: true, description: true, photo_url: true, category: true,
});
export type HotspotInput = z.infer<typeof HotspotInput>;
export const HotspotPatch = HotspotInput.partial();

export const UnitPatch = z.object({
  unit_type_id: id.optional(),
  label: z.string().min(1).max(30).optional(),
  outline: z.array(Vec2).min(3).optional(),
  area_sqm: z.number().nonnegative().nullable().optional(),
  status: UnitStatus.optional(),
});

/** A "slot" is a repeating apartment position on a typical floor plate. */
export const UnitSlot = z.object({
  /** Appended to the floor number: floor 12 + suffix "01" → "1201". */
  suffix: z.string().min(1).max(10),
  unit_type_id: id,
  outline: z.array(Vec2).min(3),
  area_sqm: z.number().nonnegative().nullable().optional(),
});
export type UnitSlot = z.infer<typeof UnitSlot>;

export const GenerateUnitsInput = z.object({
  floor_from: z.number().int().min(1),
  floor_to: z.number().int().min(1),
  slots: z.array(UnitSlot).min(1).max(40),
  /** Delete existing units on those floors first. */
  replace: z.boolean().default(false),
});
export type GenerateUnitsInput = z.infer<typeof GenerateUnitsInput>;

/* ---------------------------------------------------------------- analytics */

export const AnalyticsEventType = z.enum([
  'view_start', 'tower_view', 'floor_view', 'unit_view', 'hotspot_click', 'preset', 'measure',
]);
export type AnalyticsEventType = z.infer<typeof AnalyticsEventType>;

export const AnalyticsEventInput = z.object({
  type: AnalyticsEventType,
  session_id: z.string().min(8).max(64),
  tower_id: id.nullable().optional(),
  floor_number: z.number().int().min(1).max(250).nullable().optional(),
  unit_id: id.nullable().optional(),
  hotspot_id: id.nullable().optional(),
  meta: z.string().max(60).nullable().optional(), // e.g. preset name
});
export type AnalyticsEventInput = z.infer<typeof AnalyticsEventInput>;

export interface AnalyticsEvent extends Omit<AnalyticsEventInput, 'meta'> {
  id: string;
  project_id: string;
  meta: string | null;
  created_at: string;
}

export interface AnalyticsSummary {
  days: number;
  total_views: number;
  unique_sessions: number;
  views_by_day: { date: string; views: number }[];
  top_floors: { tower_id: string; tower_name: string; floor_number: number; views: number }[];
  top_units: { unit_id: string; label: string; unit_type: string; views: number }[];
  top_hotspots: { hotspot_id: string; title: string; clicks: number }[];
  preset_usage: { preset: string; count: number }[];
}

/* ------------------------------------------------- floor-plan analysis (optional) */

/**
 * Normalised output of a FloorPlanAnalysisProvider. This is a REFERENCE for the 3D artist
 * (import into Blender/SketchUp as a trace). It is never auto-published to the viewer.
 * All coordinates are in metres, origin at the top-left of the source image, +x right, +y down.
 */
export interface FloorPlanAnalysis {
  provider: string;
  /** true while the provider is stubbed – no paid API was called. */
  is_mock: boolean;
  source_file: string;
  scale_m_per_px: number | null;
  rooms: { name: string; type: string; polygon: Vec2[]; area_sqm: number }[];
  walls: { start: Vec2; end: Vec2; thickness_m: number; kind: 'exterior' | 'interior' }[];
  openings: { kind: 'door' | 'window'; position: Vec2; width_m: number; wall_index: number | null }[];
  warnings: string[];
}
