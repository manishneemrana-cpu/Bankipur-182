import { z } from "zod";

/**
 * Standard Agent Output Contract. Every agent - Worker or Head - must
 * return output in this shape. fact/observation/inference/recommendation
 * are kept as separate arrays so an inference can never be silently
 * presented as a fact.
 */
export const AGENT_OUTPUT_STATUSES = [
  "draft",
  "waiting_head_review",
  "head_approved",
  "head_rejected",
  "escalated_to_ceo",
  "approved",
  "executing",
  "completed",
  "rejected",
  "failed",
] as const;

export type AgentOutputStatus = (typeof AGENT_OUTPUT_STATUSES)[number];

export const DEPARTMENTS = [
  "real_estate",
  "marketing",
  "automation",
  "finance_legal",
  "executive",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export const agentOutputContractSchema = z.object({
  agentId: z.string().uuid(),
  department: z.enum(DEPARTMENTS),
  task: z.string().min(1),
  fact: z.array(z.string()),
  observation: z.array(z.string()),
  inference: z.array(z.string()),
  recommendation: z.array(z.string()),
  confidence: z.number().int().min(0).max(100),
  requiresApproval: z.boolean(),
  estimatedCostUsd: z.number().min(0),
  environment: z.enum(["demo", "test", "live"]),
  status: z.enum(AGENT_OUTPUT_STATUSES),
});

export type AgentOutputContract = z.infer<typeof agentOutputContractSchema>;

/**
 * Validates a candidate agent output against the Standard Agent Output
 * Contract. Throws with a readable message on violation - callers in
 * later phases (the review chain) must never swallow this and forward an
 * unvalidated output up the chain.
 */
export function assertValidAgentOutput(candidate: unknown): AgentOutputContract {
  return agentOutputContractSchema.parse(candidate);
}

export type AgentOutputRow = {
  id: string;
  agent_id: string;
  department: Department;
  task: string;
  fact: string[];
  observation: string[];
  inference: string[];
  recommendation: string[];
  confidence: number;
  requires_approval: boolean;
  estimated_cost_usd: number;
  environment: "demo" | "test" | "live";
  status: AgentOutputStatus;
  created_at: string;
};
