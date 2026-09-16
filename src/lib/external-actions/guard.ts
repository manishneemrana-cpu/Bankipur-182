import "server-only";

import type { AppEnvironment } from "@/lib/types";

/**
 * Shared safety guard for every outbound, real-world-effect action
 * (social publish, WhatsApp/email send, outbound call). Per SOCIAL MEDIA
 * SAFETY / VOICE SAFETY in the master spec: AI Draft -> Human Review ->
 * Approval -> [only then] Publish/Send/Call. All three conditions below
 * are required, and this function is the single place that decision is
 * made - no caller may bypass it.
 */
export class ExternalActionBlockedError extends Error {}

export function assertLiveActionAllowed(params: {
  actionLabel: string;
  mode: AppEnvironment | null;
  approved: boolean;
  providerConfigured: boolean;
}): void {
  const reasons: string[] = [];

  if (params.mode !== "live") {
    reasons.push(`organization mode is "${params.mode ?? "unknown"}", not LIVE`);
  }
  if (!params.approved) {
    reasons.push("no explicit human approval recorded for this action");
  }
  if (!params.providerConfigured) {
    reasons.push("no real provider is configured for this channel");
  }

  if (reasons.length > 0) {
    throw new ExternalActionBlockedError(
      `Blocked "${params.actionLabel}": ${reasons.join("; ")}.`,
    );
  }
}
