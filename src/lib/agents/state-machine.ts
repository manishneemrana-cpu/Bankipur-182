import type { AgentOutputStatus } from "@/lib/agents/contract";

export const APPROVAL_ACTIONS = [
  "send_for_head_review",
  "head_approve",
  "head_reject",
  "escalate_to_ceo",
  "ceo_approve",
  "ceo_reject",
  "mark_executing",
  "mark_completed",
  "mark_failed",
] as const;

export type ApprovalAction = (typeof APPROVAL_ACTIONS)[number];

export const TRANSITIONS: Record<
  ApprovalAction,
  { from: AgentOutputStatus[]; to: AgentOutputStatus; label: string }
> = {
  send_for_head_review: {
    from: ["draft"],
    to: "waiting_head_review",
    label: "Send for Head review",
  },
  head_approve: {
    from: ["waiting_head_review"],
    to: "head_approved",
    label: "Head approve",
  },
  head_reject: {
    from: ["waiting_head_review"],
    to: "head_rejected",
    label: "Head reject",
  },
  escalate_to_ceo: {
    from: ["waiting_head_review", "head_approved"],
    to: "escalated_to_ceo",
    label: "Escalate to CEO",
  },
  ceo_approve: {
    from: ["escalated_to_ceo", "head_approved"],
    to: "approved",
    label: "CEO approve",
  },
  ceo_reject: {
    from: ["escalated_to_ceo", "head_approved"],
    to: "rejected",
    label: "CEO reject",
  },
  mark_executing: {
    from: ["approved"],
    to: "executing",
    label: "Mark executing",
  },
  mark_completed: {
    from: ["executing"],
    to: "completed",
    label: "Mark completed",
  },
  mark_failed: {
    from: ["executing"],
    to: "failed",
    label: "Mark failed",
  },
};

/** Actions that could legally fire next given the output's current status. */
export function availableActions(status: AgentOutputStatus): ApprovalAction[] {
  return APPROVAL_ACTIONS.filter((action) => TRANSITIONS[action].from.includes(status));
}

export const DECISION_MAKER_ROLES = ["OWNER", "ADMIN", "EXECUTIVE"] as const;
