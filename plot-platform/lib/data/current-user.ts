import "server-only";

import { createClient } from "@/lib/db/supabase/server";

export interface OrgMembership {
  orgId: string;
  orgName: string;
  orgSlug: string;
  role: "org_admin" | "manager" | "sales" | "broker" | "viewer";
}

export interface CurrentUser {
  id: string;
  email: string | null;
  memberships: OrgMembership[];
  isPlatformOwner: boolean;
}

/** Loads the signed-in user plus every org they belong to. Null if signed out. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: members }, { data: staff }] = await Promise.all([
    supabase
      .from("org_members")
      .select("role, organizations(id, name, slug)")
      .eq("user_id", user.id),
    supabase
      .from("platform_staff")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "platform_owner"),
  ]);

  const memberships: OrgMembership[] = (members ?? []).flatMap((m) => {
    const org = m.organizations as unknown as {
      id: string;
      name: string;
      slug: string;
    } | null;
    if (!org) return [];
    return [
      {
        orgId: org.id,
        orgName: org.name,
        orgSlug: org.slug,
        role: m.role as OrgMembership["role"],
      },
    ];
  });

  return {
    id: user.id,
    email: user.email ?? null,
    memberships,
    isPlatformOwner: (staff?.length ?? 0) > 0,
  };
}
