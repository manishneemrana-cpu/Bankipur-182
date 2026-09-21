import "server-only";
import { getEnv } from "@/server/env";

/**
 * Simulated WhatsApp/Meta data for building and demoing the UI before real
 * Meta credentials exist. Every export here returns `null`/`[]` unless
 * MOCK_META=true — per the project rule, no fake data may ever appear once
 * MOCK_META is turned off, and there is no real Meta integration built yet
 * (that's Phase 3+) for these functions to be confused with.
 *
 * Data is deterministic per organizationId (not random per call) so a demo
 * doesn't visibly change on every page refresh.
 */

export function isMockModeEnabled(): boolean {
  return getEnv().MOCK_META;
}

function seededPick<T>(seed: string, options: readonly T[]): T {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return options[hash % options.length]!;
}

export interface MockWhatsappConnection {
  wabaId: string;
  businessName: string;
  displayPhoneNumber: string;
  verifiedName: string;
  qualityRating: "GREEN" | "YELLOW" | "RED";
  messagingLimitTier: "TIER_250" | "TIER_1K" | "TIER_10K" | "TIER_100K" | "UNLIMITED";
  isCoexistence: boolean;
  connectionStatus: "CONNECTED";
}

export function getMockWhatsappConnection(organizationId: string): MockWhatsappConnection | null {
  if (!isMockModeEnabled()) return null;
  return {
    wabaId: `mock-waba-${organizationId.slice(0, 8)}`,
    businessName: "Demo Business (mock data)",
    displayPhoneNumber: "+91 90000 00000",
    verifiedName: "Demo Business",
    qualityRating: seededPick(organizationId + "quality", ["GREEN", "YELLOW", "RED"] as const),
    messagingLimitTier: seededPick(organizationId + "tier", [
      "TIER_250",
      "TIER_1K",
      "TIER_10K",
    ] as const),
    isCoexistence: seededPick(organizationId + "coex", [true, false] as const),
    connectionStatus: "CONNECTED",
  };
}

export interface MockMessage {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  body: string;
  status: "sent" | "delivered" | "read" | "failed";
  occurredAt: string;
}

export function getMockRecentMessages(organizationId: string): MockMessage[] {
  if (!isMockModeEnabled()) return [];
  const now = Date.now();
  return [
    {
      id: `mock-msg-${organizationId.slice(0, 8)}-1`,
      direction: "INBOUND",
      body: "Hi, is the 3BHK still available?",
      status: "read",
      occurredAt: new Date(now - 1000 * 60 * 42).toISOString(),
    },
    {
      id: `mock-msg-${organizationId.slice(0, 8)}-2`,
      direction: "OUTBOUND",
      body: "Yes! Would you like to schedule a site visit this weekend?",
      status: "delivered",
      occurredAt: new Date(now - 1000 * 60 * 40).toISOString(),
    },
    {
      id: `mock-msg-${organizationId.slice(0, 8)}-3`,
      direction: "OUTBOUND",
      body: "Reminder: your site visit is tomorrow at 11 AM.",
      status: "sent",
      occurredAt: new Date(now - 1000 * 60 * 5).toISOString(),
    },
  ];
}
