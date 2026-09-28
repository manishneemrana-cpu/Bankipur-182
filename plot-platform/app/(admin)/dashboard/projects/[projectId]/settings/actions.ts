"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function updateLinkSecurity(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const visibility = String(formData.get("visibility") ?? "public");
  const disabled = formData.get("link_disabled") === "on";
  const expiresRaw = String(formData.get("link_expires_at") ?? "");
  const expiresAt = expiresRaw ? new Date(expiresRaw).toISOString() : null;
  const password = String(formData.get("password") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_project_link_security", {
    p_project: projectId,
    p_visibility: visibility,
    p_expires_at: expiresAt,
    p_disabled: disabled,
  });
  if (error) return { error: error.message };

  if (visibility === "password" && password) {
    const { error: pwError } = await supabase.rpc("set_project_password", {
      p_project: projectId,
      p_password: password,
    });
    if (pwError) return { error: pwError.message };
  } else if (visibility !== "password") {
    await supabase.rpc("clear_project_password", { p_project: projectId });
  }

  revalidatePath(`/dashboard/projects/${projectId}/settings`);
  return { success: true };
}

export async function updateLocation(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const address = String(formData.get("address") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const latRaw = String(formData.get("lat") ?? "").trim();
  const lngRaw = String(formData.get("lng") ?? "").trim();
  const lat = latRaw ? Number(latRaw) : null;
  const lng = lngRaw ? Number(lngRaw) : null;
  if ((latRaw && Number.isNaN(lat)) || (lngRaw && Number.isNaN(lng))) {
    return { error: "Latitude/longitude must be numbers." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      address: address || null,
      city: city || null,
      state: state || null,
      lat,
      lng,
    })
    .eq("id", projectId);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/projects/${projectId}/settings`);
  return { success: true };
}

export async function publishProject(projectId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ status: "published" })
    .eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/projects/${projectId}/settings`);
  return { success: true };
}
