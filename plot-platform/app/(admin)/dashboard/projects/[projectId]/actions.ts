"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/supabase/server";

export interface ActionState {
  error?: string;
}

export async function changePlotStatus(
  projectId: string,
  plotId: string,
  status: string,
  reason: string | null,
): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("change_plot_status", {
    p_plot: plotId,
    p_status: status,
    p_reason: reason,
  });
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/projects/${projectId}`);
  return {};
}
