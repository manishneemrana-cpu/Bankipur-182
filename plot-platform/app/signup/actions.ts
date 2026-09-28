"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/db/supabase/server";

export interface ActionState {
  error?: string;
}

/** Sign up, then create the org and become its org_admin (§20 Phase 1). */
export async function signup(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const orgName = String(formData.get("orgName") ?? "").trim();
  const orgSlug = orgName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!orgName || !orgSlug) return { error: "Enter a company name." };

  const supabase = await createClient();
  const { error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });
  if (signUpError) return { error: signUpError.message };

  // Email confirmation may be required before a session exists; if so the org
  // is created on first login instead (see /dashboard's org-setup redirect).
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session) {
    const { error: orgError } = await supabase.rpc("create_organization", {
      p_name: orgName,
      p_slug: orgSlug,
    });
    if (orgError) return { error: orgError.message };
  }

  redirect("/dashboard");
}
