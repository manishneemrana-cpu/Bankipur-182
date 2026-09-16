import "server-only";

import type { AppEnvironment } from "@/lib/types";
import { assertWorkflowSafe } from "./safety";
import { getWorkflowTemplate } from "./workflow-templates";

export class N8nNotConfiguredError extends Error {
  constructor() {
    super(
      "n8n is not configured. Set N8N_BASE_URL and N8N_API_KEY to connect a real instance.",
    );
  }
}

function getConfig() {
  const baseUrl = process.env.N8N_BASE_URL;
  const apiKey = process.env.N8N_API_KEY;
  const webhookBaseUrl = process.env.N8N_WEBHOOK_BASE_URL;

  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey, webhookBaseUrl };
}

export function isN8nConfigured(): boolean {
  return getConfig() !== null;
}

/**
 * Triggers a named workflow template. Always runs the safety guard first -
 * a LIVE-environment external action without prior approval never reaches
 * the network call. Throws N8nNotConfiguredError if no real instance is
 * wired up (the default in this build - see .env.example).
 */
export async function triggerWorkflow(params: {
  templateKey: string;
  environment: AppEnvironment;
  approved: boolean;
  payload: Record<string, unknown>;
}): Promise<{ triggered: boolean }> {
  const template = getWorkflowTemplate(params.templateKey);
  if (!template) {
    throw new Error(`Unknown workflow template: ${params.templateKey}`);
  }

  assertWorkflowSafe({
    environment: params.environment,
    externalAction: template.externalAction,
    approved: params.approved,
  });

  const config = getConfig();
  if (!config) {
    throw new N8nNotConfiguredError();
  }

  const response = await fetch(`${config.baseUrl}/webhook/${params.templateKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(params.payload),
  });

  if (!response.ok) {
    throw new Error(`n8n workflow trigger failed: ${response.status} ${response.statusText}`);
  }

  return { triggered: true };
}
