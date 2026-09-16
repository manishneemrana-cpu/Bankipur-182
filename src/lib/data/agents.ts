import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getAgents(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agents")
    .select(
      "id, agent_key, name, tier, department, reports_to, description, tools, status, model, max_cost_usd, max_runtime_seconds",
    )
    .eq("organization_id", organizationId)
    .order("tier")
    .order("name");
  return data ?? [];
}

export async function getAgentOutputs(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agent_outputs")
    .select(
      "id, agent_id, department, task, fact, observation, inference, recommendation, confidence, requires_approval, estimated_cost_usd, environment, status, created_at, agents(name)",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  return data ?? [];
}
