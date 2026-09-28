import "server-only";

import { createClient } from "@/lib/db/supabase/server";

export interface PlotRow {
  id: string;
  plot_number: string;
  status: string;
  plot_type: string;
  area_official_value: number | null;
  area_official_unit: string | null;
  area_conflict: boolean;
  facing: string;
  corner_status: string;
  price_total: number | null;
  block_id: string | null;
  phase_id: string | null;
  last_inventory_update: string;
  verified_fields: string[];
}

export async function listPlots(projectId: string): Promise<PlotRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plots")
    .select(
      "id, plot_number, status, plot_type, area_official_value, area_official_unit, area_conflict, facing, corner_status, price_total, block_id, phase_id, last_inventory_update, verified_fields",
    )
    .eq("project_id", projectId)
    .order("plot_number");
  if (error) throw error;
  return data;
}

export async function listOpenConflicts(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("data_conflicts")
    .select("id, field, values, note, created_at, plot_id, plots(plot_number)")
    .eq("project_id", projectId)
    .eq("status", "open")
    .order("created_at");
  if (error) throw error;
  return data;
}
