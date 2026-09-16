import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getAgentOutputsForReview(organizationId: string) {
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

export async function getApprovalHistory(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("approvals")
    .select(
      "id, action, from_status, to_status, notes, environment, result, created_at, agent_outputs(task), profiles(full_name)",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

export async function getAuditLogs(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_logs")
    .select(
      "id, action, tool, department, environment, status, error_message, request, result, created_at, agents(name), profiles(full_name)",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}
