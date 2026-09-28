"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/db/supabase/server";

export interface ActionState {
  error?: string;
}

export async function createOrg(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get("orgName") ?? "").trim();
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!name || !slug) return { error: "Enter a company name." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization", {
    p_name: name,
    p_slug: slug,
  });
  if (error) return { error: error.message };

  redirect("/dashboard");
}
