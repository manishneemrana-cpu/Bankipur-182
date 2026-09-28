import "server-only";

import { createClient } from "@/lib/db/supabase/server";

export interface ProjectRow {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  status: string;
  is_demo: boolean;
  created_at: string;
}

export async function listProjects(): Promise<ProjectRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, org_id, name, slug, city, state, status, is_demo, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getProject(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();
  if (error) throw error;
  return data;
}

export interface ProjectCounts {
  total: number;
  byStatus: Record<string, number>;
  openConflicts: number;
  activeHolds: number;
  leads: number;
}

export async function getProjectCounts(
  projectId: string,
): Promise<ProjectCounts> {
  const supabase = await createClient();
  const [
    { data: plots, error: plotsErr },
    { count: conflicts },
    { count: holds },
    { count: leads },
  ] = await Promise.all([
    supabase.from("plots").select("status").eq("project_id", projectId),
    supabase
      .from("data_conflicts")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "open"),
    supabase
      .from("holds")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "active"),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
  ]);
  if (plotsErr) throw plotsErr;

  const byStatus: Record<string, number> = {};
  for (const p of plots ?? [])
    byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;

  return {
    total: plots?.length ?? 0,
    byStatus,
    openConflicts: conflicts ?? 0,
    activeHolds: holds ?? 0,
    leads: leads ?? 0,
  };
}
