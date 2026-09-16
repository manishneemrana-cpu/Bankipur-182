import type { AppEnvironment } from "@/lib/types";

/**
 * Every n8n workflow trigger must pass this guard first. Mirrors the
 * master spec's safety check verbatim:
 *
 *   if (environment == production AND external_action == true AND approval != true) -> STOP
 *
 * Here "production" maps to environment="live", since this app's own
 * environment model is demo/test/live rather than dev/preview/production.
 */
export class WorkflowSafetyError extends Error {}

export function assertWorkflowSafe(params: {
  environment: AppEnvironment;
  externalAction: boolean;
  approved: boolean;
}): void {
  if (params.environment === "live" && params.externalAction && !params.approved) {
    throw new WorkflowSafetyError(
      "Blocked: LIVE environment + external action requires explicit prior approval.",
    );
  }
}
