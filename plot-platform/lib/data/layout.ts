import "server-only";

import { createClient } from "@/lib/db/supabase/server";
import { signedLayoutFileUrl } from "@/lib/storage/layout-files";
import type { Polygon } from "@/lib/geometry/types";

export interface LayoutVersionRow {
  id: string;
  version_no: number;
  status: string;
  calibration: {
    scale_units_per_px?: number;
    unit?: string;
    north_angle_deg?: number;
    origin?: [number, number];
  };
  source_file_id: string | null;
  page_no: number | null;
  created_at: string;
}

export async function listLayoutVersions(
  projectId: string,
): Promise<LayoutVersionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("layout_versions")
    .select(
      "id, version_no, status, calibration, source_file_id, page_no, created_at",
    )
    .eq("project_id", projectId)
    .order("version_no", { ascending: false });
  if (error) throw error;
  return data;
}

export interface LayoutVersionDetail extends LayoutVersionRow {
  sourceImageUrl: string | null;
  sourceMime: string | null;
}

export async function getLayoutVersion(
  layoutVersionId: string,
): Promise<LayoutVersionDetail> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("layout_versions")
    .select(
      "id, version_no, status, calibration, source_file_id, page_no, created_at, files(storage_path, mime)",
    )
    .eq("id", layoutVersionId)
    .single();
  if (error) throw error;

  const filesField = data.files as
    | { storage_path: string; mime: string }
    | { storage_path: string; mime: string }[]
    | null;
  const file = Array.isArray(filesField) ? (filesField[0] ?? null) : filesField;
  let sourceImageUrl: string | null = null;
  if (file && file.mime !== "application/pdf") {
    sourceImageUrl = await signedLayoutFileUrl(supabase, file.storage_path);
  }

  return {
    id: data.id,
    version_no: data.version_no,
    status: data.status,
    calibration: data.calibration ?? {},
    source_file_id: data.source_file_id,
    page_no: data.page_no,
    created_at: data.created_at,
    sourceImageUrl,
    sourceMime: file?.mime ?? null,
  };
}

export interface TracedPlot {
  id: string;
  plot_number: string;
  geometry: Polygon | null;
  facing: string;
  corner_status: string;
  area_official_value: number | null;
  area_calculated_sqft: number | null;
  area_conflict: boolean;
}

export async function listTracedPlots(
  layoutVersionId: string,
): Promise<TracedPlot[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plots")
    .select(
      "id, plot_number, geometry, facing, corner_status, area_official_value, area_calculated_sqft, area_conflict",
    )
    .eq("layout_version_id", layoutVersionId)
    .order("plot_number");
  if (error) throw error;
  return data;
}

export interface TracedRoad {
  id: string;
  name: string | null;
  width_value: number | null;
  width_unit: string;
  geometry: Polygon;
}

export async function listTracedRoads(
  layoutVersionId: string,
): Promise<TracedRoad[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roads")
    .select("id, name, width_value, width_unit, geometry")
    .eq("layout_version_id", layoutVersionId);
  if (error) throw error;
  return data;
}

export interface TracedZone {
  id: string;
  kind: string;
  name: string | null;
  geometry: Polygon;
}

export async function listTracedZones(
  layoutVersionId: string,
): Promise<TracedZone[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("zones")
    .select("id, kind, name, geometry")
    .eq("layout_version_id", layoutVersionId);
  if (error) throw error;
  return data;
}
