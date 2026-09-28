import "server-only";

import { createClient } from "@/lib/db/supabase/server";

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
  planName: string;
  planCode: string;
  projectCount: number;
  aiMessagesThisMonth: number;
}

/** Platform ops console org list (§15) — relies on RLS (orgs_select +
 * app.is_platform_owner()) to actually restrict this to platform staff;
 * the page itself also gates on isPlatformOwner before rendering. */
export async function listOrgsForOps(): Promise<OrgSummary[]> {
  const supabase = await createClient();
  const period = new Date().toISOString().slice(0, 7);

  const { data: orgs, error } = await supabase
    .from("organizations")
    .select("id, name, slug, status, plans(name, code)")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const [{ data: projectCounts }, { data: usageRows }] = await Promise.all([
    supabase.from("projects").select("org_id"),
    supabase
      .from("usage_counters")
      .select("org_id, value")
      .eq("period", period)
      .eq("metric", "ai_messages"),
  ]);

  const projectsByOrg = new Map<string, number>();
  for (const p of projectCounts ?? []) {
    projectsByOrg.set(p.org_id, (projectsByOrg.get(p.org_id) ?? 0) + 1);
  }
  const usageByOrg = new Map<string, number>();
  for (const u of usageRows ?? []) {
    usageByOrg.set(u.org_id, u.value);
  }

  return (orgs ?? []).map((o) => {
    type PlanFields = { name: string; code: string };
    const plansField = o.plans as PlanFields | PlanFields[] | null;
    const plan = Array.isArray(plansField)
      ? (plansField[0] ?? null)
      : plansField;
    return {
      id: o.id,
      name: o.name,
      slug: o.slug,
      status: o.status,
      planName: plan?.name ?? "None",
      planCode: plan?.code ?? "none",
      projectCount: projectsByOrg.get(o.id) ?? 0,
      aiMessagesThisMonth: usageByOrg.get(o.id) ?? 0,
    };
  });
}
