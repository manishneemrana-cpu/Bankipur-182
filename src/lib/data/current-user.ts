import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/types";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: AppRole;
  organizationId: string | null;
  organizationName: string | null;
  organizationMode: "demo" | "test" | "live" | null;
};

export async function getCurrentUser(): Promise<CurrentUser> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, organization_id, organizations(name, mode)")
    .eq("id", user.id)
    .single();

  const org = profile?.organizations as unknown as
    | { name: string; mode: "demo" | "test" | "live" }
    | null
    | undefined;

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? null,
    role: (profile?.role as AppRole) ?? "VIEWER",
    organizationId: profile?.organization_id ?? null,
    organizationName: org?.name ?? null,
    organizationMode: org?.mode ?? null,
  };
}
