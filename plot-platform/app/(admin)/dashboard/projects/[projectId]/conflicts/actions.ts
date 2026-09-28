"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/supabase/server";

export interface ActionState {
  error?: string;
}

export async function resolveConflict(
  projectId: string,
  conflictId: string,
  value: string,
  note: string | null,
): Promise<ActionState> {
  const supabase = await createClient();
  let parsed: unknown = value;
  try {
    parsed = JSON.parse(value);
  } catch {
    parsed = value; // plain string value (e.g. a facing code) is fine as-is
  }
  const { error } = await supabase.rpc("resolve_conflict", {
    p_conflict: conflictId,
    p_value: parsed,
    p_note: note,
  });
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/projects/${projectId}/conflicts`);
  revalidatePath(`/dashboard/projects/${projectId}`);
  return {};
}
