"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  APPROVAL_ACTIONS,
  DECISION_MAKER_ROLES,
  TRANSITIONS,
  type ApprovalAction,
} from "@/lib/agents/state-machine";

function isApprovalAction(value: FormDataEntryValue | null): value is ApprovalAction {
  return typeof value === "string" && (APPROVAL_ACTIONS as readonly string[]).includes(value);
}

export async function transitionAgentOutput(formData: FormData) {
  const outputId = formData.get("outputId");
  const action = formData.get("action");
  const notes = formData.get("notes");

  if (typeof outputId !== "string" || !isApprovalAction(action)) {
    redirect("/approvals?error=Invalid+request");
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !DECISION_MAKER_ROLES.includes(profile.role as (typeof DECISION_MAKER_ROLES)[number])) {
    redirect("/approvals?error=Not+authorized+to+record+approval+decisions");
  }

  const { data: output } = await supabase
    .from("agent_outputs")
    .select("id, status, environment, agent_id, department, organization_id")
    .eq("id", outputId)
    .single();

  if (!output) {
    redirect("/approvals?error=Output+not+found");
  }

  const transition = TRANSITIONS[action];

  if (!transition.from.includes(output.status)) {
    redirect(
      `/approvals?error=${encodeURIComponent(`Cannot ${transition.label} from status "${output.status}"`)}`,
    );
  }

  const { error: updateError } = await supabase
    .from("agent_outputs")
    .update({ status: transition.to })
    .eq("id", outputId);

  if (updateError) {
    redirect(`/approvals?error=${encodeURIComponent(updateError.message)}`);
  }

  const notesText = typeof notes === "string" && notes.trim() ? notes.trim() : null;

  await supabase.from("approvals").insert({
    organization_id: output.organization_id,
    agent_output_id: outputId,
    user_id: user.id,
    action,
    from_status: output.status,
    to_status: transition.to,
    notes: notesText,
    environment: output.environment,
  });

  await supabase.from("audit_logs").insert({
    organization_id: output.organization_id,
    agent_id: output.agent_id,
    user_id: user.id,
    department: output.department,
    action: `agent_output.${action}`,
    environment: output.environment,
    request: { outputId, action, notes: notesText },
    result: { from: output.status, to: transition.to },
    status: "success",
  });

  revalidatePath("/approvals");
  revalidatePath("/audit-logs");
  revalidatePath("/agents");
}
