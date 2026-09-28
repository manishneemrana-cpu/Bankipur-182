import "server-only";

import { createClient } from "@/lib/db/supabase/server";
import { isPolygon } from "@/lib/geometry/polygon";
import type { Polygon } from "@/lib/geometry/types";

export interface MapPlot {
  id: string;
  plot_number: string;
  status: string;
  area_official_value: number | null;
  area_official_unit: string | null;
  facing: string;
  corner_status: string;
  dimensions: Array<{ side: string; value: number; unit: string }>;
  geometry: Polygon;
  centroid_x: number | null;
  centroid_y: number | null;
}

export interface MapRoad {
  id: string;
  name: string | null;
  kind: string;
  width_value: number | null;
  width_unit: string;
  geometry: Polygon;
}

export interface MapZone {
  id: string;
  kind: string;
  name: string | null;
  geometry: Polygon;
}

export interface MapLayoutData {
  layoutVersionId: string | null;
  northAngleDeg: number;
  unit: string;
  plots: MapPlot[];
  roads: MapRoad[];
  zones: MapZone[];
}

/** Loads the published layout's geometry for a project's map view (Phase 2). */
export async function getMapData(projectId: string): Promise<MapLayoutData> {
  const supabase = await createClient();

  const { data: layoutVersion } = await supabase
    .from("layout_versions")
    .select("id, calibration")
    .eq("project_id", projectId)
    .eq("status", "published")
    .maybeSingle();

  const calibration = (layoutVersion?.calibration ?? {}) as {
    north_angle_deg?: number;
    unit?: string;
  };

  const [{ data: plots }, { data: roads }, { data: zones }] = await Promise.all(
    [
      supabase
        .from("plots")
        .select(
          "id, plot_number, status, area_official_value, area_official_unit, facing, corner_status, dimensions, geometry, centroid_x, centroid_y",
        )
        .eq("project_id", projectId)
        .not("geometry", "is", null),
      supabase
        .from("roads")
        .select("id, name, kind, width_value, width_unit, geometry")
        .eq("project_id", projectId)
        .eq("public_visibility", true),
      supabase
        .from("zones")
        .select("id, kind, name, geometry")
        .eq("project_id", projectId),
    ],
  );

  return {
    layoutVersionId: layoutVersion?.id ?? null,
    northAngleDeg: calibration.north_angle_deg ?? 0,
    unit: calibration.unit ?? "ft",
    plots: (plots ?? []).flatMap((p) =>
      isPolygon(p.geometry)
        ? [
            {
              ...p,
              dimensions: (p.dimensions ?? []) as MapPlot["dimensions"],
              geometry: p.geometry,
            },
          ]
        : [],
    ),
    roads: (roads ?? []).flatMap((r) =>
      isPolygon(r.geometry) ? [{ ...r, geometry: r.geometry }] : [],
    ),
    zones: (zones ?? []).flatMap((z) =>
      isPolygon(z.geometry) ? [{ ...z, geometry: z.geometry }] : [],
    ),
  };
}
