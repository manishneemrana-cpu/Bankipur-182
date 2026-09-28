"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/supabase/server";
import { getCurrentUser } from "@/lib/data/current-user";

export interface ActionState {
  error?: string;
}

export async function createProject(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim() || null;
  const state = String(formData.get("state") ?? "").trim() || null;
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!name || !slug) return { error: "Enter a project name." };

  const user = await getCurrentUser();
  const org = user?.memberships.find(
    (m) => m.role === "org_admin" || m.role === "manager",
  );
  if (!org)
    return {
      error: "You need to be an org admin or manager to create a project.",
    };

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .insert({ org_id: org.orgId, name, slug, city, state });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/projects");
  return {};
}
