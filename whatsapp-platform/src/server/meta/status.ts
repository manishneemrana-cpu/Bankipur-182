import "server-only";
import { getEnv } from "@/server/env";

export interface MetaConnectionStatus {
  mockMode: boolean;
  configured: boolean;
  missingVars: string[];
  graphApiVersion: string | null;
}

const REQUIRED_WHEN_LIVE = [
  "META_APP_ID",
  "META_APP_SECRET",
  "META_WEBHOOK_VERIFY_TOKEN",
  "META_WEBHOOK_APP_SECRET",
  "META_GRAPH_API_VERSION",
] as const;

/**
 * Platform-level Meta app configuration status — whether the env vars needed
 * to eventually talk to Meta are present, not whether any organization has
 * connected a WhatsApp number yet (that's per-organization, via
 * whatsapp_accounts, and doesn't exist until Phase 5's Embedded Signup).
 * Never makes a live network call — this only inspects configuration.
 */
export function getMetaConnectionStatus(): MetaConnectionStatus {
  const env = getEnv();
  if (env.MOCK_META) {
    return { mockMode: true, configured: false, missingVars: [], graphApiVersion: null };
  }

  const missingVars = REQUIRED_WHEN_LIVE.filter((key) => !env[key]);
  return {
    mockMode: false,
    configured: missingVars.length === 0,
    missingVars,
    graphApiVersion: env.META_GRAPH_API_VERSION ?? null,
  };
}
