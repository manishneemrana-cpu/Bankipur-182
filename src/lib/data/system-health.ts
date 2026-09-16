import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getSystemHealth(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("system_health")
    .select("id, service, status, detail, last_checked_at, activated_at, profiles(full_name)")
    .eq("organization_id", organizationId)
    .order("service");
  return data ?? [];
}
