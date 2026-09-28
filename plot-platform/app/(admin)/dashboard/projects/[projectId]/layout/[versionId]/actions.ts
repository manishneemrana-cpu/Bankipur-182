"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/supabase/server";
import {
  deriveFacingAndCorner,
  scalePolygon,
} from "@/lib/geometry/calibration";
import { polygonArea, polygonCentroid } from "@/lib/geometry/polygon";
import type { Polygon } from "@/lib/geometry/types";
import {
  conversionTable,
  relativeDiff,
  toSqft,
  AREA_TOLERANCE,
} from "@/lib/units/area";

async function getCalibration(
  supabase: Awaited<ReturnType<typeof createClient>>,
  layoutVersionId: string,
): Promise<{
  scaleUnitsPerPx: number;
  unit: "ft" | "m";
  northAngleDeg: number;
} | null> {
  const { data, error } = await supabase
    .from("layout_versions")
    .select("calibration")
    .eq("id", layoutVersionId)
    .single();
  if (error) throw error;
  const c = data.calibration as {
    scale_units_per_px?: number;
    unit?: string;
    north_angle_deg?: number;
  };
  if (!c.scale_units_per_px || !c.unit) return null;
  return {
    scaleUnitsPerPx: c.scale_units_per_px,
    unit: c.unit as "ft" | "m",
    northAngleDeg: c.north_angle_deg ?? 0,
  };
}

function computedSqft(area: number, unit: "ft" | "m"): number | null {
  if (unit === "ft") return area;
  return toSqft(area, "sqm", conversionTable(null));
}

export interface SaveTracedPlotInput {
  plotNumber: string;
  rawGeometry: Polygon;
  roadFacingEdgeIndices: number[];
}

/** Saves one traced plot (§7.1 steps 4–10 condensed to manual tracing):
 * scales the raw-pixel polygon by calibration, derives facing/corner from
 * the admin-marked road-facing edges, upserts by plot_number, and — rule 4
 * — opens a data conflict instead of silently overwriting when the traced
 * area disagrees with the inventory value beyond tolerance. */
export async function saveTracedPlot(
  layoutVersionId: string,
  projectId: string,
  input: SaveTracedPlotInput,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const calibration = await getCalibration(supabase, layoutVersionId);
  if (!calibration) return { error: "Calibrate the layout before tracing." };

  const geometry = scalePolygon(input.rawGeometry, calibration.scaleUnitsPerPx);
  const centroid = polygonCentroid(geometry);
  const areaValue = polygonArea(geometry);
  const areaSqft = computedSqft(areaValue, calibration.unit);
  const { facing, corner } = deriveFacingAndCorner(
    geometry,
    input.roadFacingEdgeIndices,
    calibration.northAngleDeg,
  );

  const { data: existing } = await supabase
    .from("plots")
    .select("id, area_official_value, facing_source, corner_source")
    .eq("project_id", projectId)
    .eq("plot_number", input.plotNumber)
    .maybeSingle();

  const patch: Record<string, unknown> = {
    layout_version_id: layoutVersionId,
    geometry,
    centroid_x: centroid[0],
    centroid_y: centroid[1],
    area_calculated_sqft: areaSqft,
  };
  if (facing !== "UNKNOWN" && existing?.facing_source !== "admin") {
    patch.facing = facing;
    patch.facing_source = "geometry";
  }
  if (corner !== "UNKNOWN" && existing?.corner_source !== "admin") {
    patch.corner_status = corner;
    patch.corner_source = "geometry";
  }

  let plotId: string;
  if (existing) {
    const { error } = await supabase
      .from("plots")
      .update(patch)
      .eq("id", existing.id);
    if (error) return { error: error.message };
    plotId = existing.id;
  } else {
    const { data, error } = await supabase
      .from("plots")
      .insert({
        project_id: projectId,
        plot_number: input.plotNumber,
        ...patch,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    plotId = data.id;
  }

  if (
    areaSqft !== null &&
    existing?.area_official_value != null &&
    relativeDiff(areaSqft, existing.area_official_value) > AREA_TOLERANCE
  ) {
    await supabase.rpc("record_conflict", {
      p_plot: plotId,
      p_field: "area_official_value",
      p_values: [existing.area_official_value, Math.round(areaSqft)],
      p_note: "Traced layout area disagrees with inventory area.",
    });
  }

  revalidatePath(`/dashboard/projects/${projectId}/layout/${layoutVersionId}`);
  revalidatePath(`/dashboard/projects/${projectId}/conflicts`);
  return {};
}

export async function saveTracedRoad(
  layoutVersionId: string,
  projectId: string,
  input: {
    rawGeometry: Polygon;
    name?: string;
    widthValue?: number;
    widthUnit?: "ft" | "m";
  },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const calibration = await getCalibration(supabase, layoutVersionId);
  if (!calibration) return { error: "Calibrate the layout before tracing." };
  const geometry = scalePolygon(input.rawGeometry, calibration.scaleUnitsPerPx);

  const { error } = await supabase.from("roads").insert({
    project_id: projectId,
    layout_version_id: layoutVersionId,
    geometry,
    name: input.name ?? null,
    width_value: input.widthValue ?? null,
    width_unit: input.widthUnit ?? "ft",
  });
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/projects/${projectId}/layout/${layoutVersionId}`);
  return {};
}

export async function saveTracedZone(
  layoutVersionId: string,
  projectId: string,
  input: { rawGeometry: Polygon; kind: string; name?: string },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const calibration = await getCalibration(supabase, layoutVersionId);
  if (!calibration) return { error: "Calibrate the layout before tracing." };
  const geometry = scalePolygon(input.rawGeometry, calibration.scaleUnitsPerPx);

  const { error } = await supabase.from("zones").insert({
    project_id: projectId,
    layout_version_id: layoutVersionId,
    geometry,
    kind: input.kind,
    name: input.name ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/projects/${projectId}/layout/${layoutVersionId}`);
  return {};
}

export async function deleteTracedFeature(
  kind: "road" | "zone",
  id: string,
  projectId: string,
  layoutVersionId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const table = kind === "road" ? "roads" : "zones";
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/projects/${projectId}/layout/${layoutVersionId}`);
  return {};
}
