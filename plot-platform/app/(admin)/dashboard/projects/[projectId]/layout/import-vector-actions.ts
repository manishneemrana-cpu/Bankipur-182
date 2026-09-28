"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { polygonArea, polygonCentroid } from "@/lib/geometry/polygon";
import { createClient } from "@/lib/db/supabase/server";
import { getProject } from "@/lib/data/projects";
import {
  parseGeoJsonFeatures,
  type ImportedFeature,
} from "@/lib/import/geojson";
import { parseKmlFeatures } from "@/lib/import/kml";
import { AREA_TOLERANCE, relativeDiff } from "@/lib/units/area";

export interface ImportVectorState {
  error?: string;
}

/**
 * KML/GeoJSON import (§7.1, Phase 10): skips tracing entirely when the
 * builder already has vector data. Coordinates are projected into local
 * feet around the project's own lat/lng (set in Settings) — since that
 * projection is already north-aligned, the resulting layout version is
 * calibrated by construction (scale 1, north 0), unlike a raster upload
 * which still needs the manual calibration step.
 */
export async function importVectorFile(
  projectId: string,
  _prev: ImportVectorState,
  formData: FormData,
): Promise<ImportVectorState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a GeoJSON (.geojson/.json) or KML (.kml) file." };
  }

  const project = await getProject(projectId);
  if (project.lat == null || project.lng == null) {
    return {
      error:
        "Set the project's location (lat/lng) in Settings first — it's used as the projection origin for the import.",
    };
  }

  const text = await file.text();
  const origin = { lat: project.lat, lng: project.lng };
  const isKml = file.name.toLowerCase().endsWith(".kml");
  const { features, errors } = isKml
    ? parseKmlFeatures(text, origin)
    : parseGeoJsonFeatures(text, origin);
  if (features.length === 0) {
    return { error: errors[0] ?? "No importable Polygon features found." };
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("layout_versions")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  const versionNo = (count ?? 0) + 1;

  const { data: layoutVersion, error: lvError } = await supabase
    .from("layout_versions")
    .insert({
      project_id: projectId,
      version_no: versionNo,
      calibration: { scale_units_per_px: 1, unit: "ft", north_angle_deg: 0 },
    })
    .select("id")
    .single();
  if (lvError) return { error: lvError.message };

  for (const feature of features) {
    await importOneFeature(supabase, projectId, layoutVersion.id, feature);
  }

  revalidatePath(`/dashboard/projects/${projectId}/layout`);
  redirect(`/dashboard/projects/${projectId}/layout/${layoutVersion.id}`);
}

async function importOneFeature(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  layoutVersionId: string,
  feature: ImportedFeature,
): Promise<void> {
  if (feature.kind === "road") {
    await supabase.from("roads").insert({
      project_id: projectId,
      layout_version_id: layoutVersionId,
      geometry: feature.geometry,
      name: feature.name ?? null,
    });
    return;
  }
  if (feature.kind === "zone") {
    await supabase.from("zones").insert({
      project_id: projectId,
      layout_version_id: layoutVersionId,
      geometry: feature.geometry,
      kind: feature.zoneKind ?? "other",
      name: feature.name ?? null,
    });
    return;
  }
  if (!feature.plotNumber) return;

  const centroid = polygonCentroid(feature.geometry);
  const areaSqft = polygonArea(feature.geometry);
  const { data: existing } = await supabase
    .from("plots")
    .select("id, area_official_value")
    .eq("project_id", projectId)
    .eq("plot_number", feature.plotNumber)
    .maybeSingle();

  const patch = {
    layout_version_id: layoutVersionId,
    geometry: feature.geometry,
    centroid_x: centroid[0],
    centroid_y: centroid[1],
    area_calculated_sqft: areaSqft,
  };

  let plotId: string;
  if (existing) {
    await supabase.from("plots").update(patch).eq("id", existing.id);
    plotId = existing.id;
  } else {
    const { data, error } = await supabase
      .from("plots")
      .insert({
        project_id: projectId,
        plot_number: feature.plotNumber,
        ...patch,
      })
      .select("id")
      .single();
    if (error || !data) return;
    plotId = data.id;
  }

  if (
    existing?.area_official_value != null &&
    relativeDiff(areaSqft, existing.area_official_value) > AREA_TOLERANCE
  ) {
    await supabase.rpc("record_conflict", {
      p_plot: plotId,
      p_field: "area_official_value",
      p_values: [existing.area_official_value, Math.round(areaSqft)],
      p_note: "Imported vector area disagrees with inventory area.",
    });
  }
}
