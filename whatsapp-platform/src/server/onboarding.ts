import "server-only";
import { randomBytes } from "node:crypto";
import { withOrgTransaction } from "@/server/db";
import { isMockModeEnabled } from "@/server/mock/meta";
import { encryptToken } from "@/server/crypto";

export type OnboardingState =
  | "STARTED"
  | "META_AUTHENTICATING"
  | "BUSINESS_SELECTED"
  | "WABA_SELECTED"
  | "PHONE_SELECTED"
  | "CONNECTING"
  | "VERIFYING"
  | "CONNECTED"
  | "FAILED"
  | "DISCONNECTED";

export type ConnectionPath = "EXISTING_APP_NUMBER" | "NEW_NUMBER" | "MIGRATED";

/**
 * Legal forward transitions. FAILED is reachable from any non-terminal state
 * (an error can happen at any step) and is handled separately from this map
 * rather than listed under every key.
 */
const HAPPY_PATH: Record<OnboardingState, OnboardingState[]> = {
  STARTED: ["META_AUTHENTICATING"],
  META_AUTHENTICATING: ["BUSINESS_SELECTED"],
  BUSINESS_SELECTED: ["WABA_SELECTED"],
  WABA_SELECTED: ["PHONE_SELECTED"],
  PHONE_SELECTED: ["CONNECTING"],
  CONNECTING: ["VERIFYING"],
  VERIFYING: ["CONNECTED"],
  CONNECTED: ["DISCONNECTED"],
  FAILED: [],
  DISCONNECTED: ["META_AUTHENTICATING"], // reconnect starts the flow over
};

const TERMINAL_STATES: readonly OnboardingState[] = ["CONNECTED", "FAILED", "DISCONNECTED"];

export interface OnboardingSession {
  id: string;
  state: OnboardingState;
  connectionPath: ConnectionPath | null;
  csrfState: string;
  failureReason: string | null;
}

export async function startOnboardingSession(
  organizationId: string,
  userId: string,
  connectionPath: ConnectionPath
): Promise<OnboardingSession> {
  const csrfState = randomBytes(32).toString("hex");
  const idempotencyKey = randomBytes(16).toString("hex");

  return withOrgTransaction(organizationId, userId, async (client) => {
    const result = await client.query<{ id: string; state: OnboardingState; csrf_state: string }>(
      `INSERT INTO onboarding_sessions (organization_id, connection_path, csrf_state, idempotency_key)
       VALUES ($1, $2, $3, $4)
       RETURNING id, state, csrf_state`,
      [organizationId, connectionPath, csrfState, idempotencyKey]
    );
    const row = result.rows[0]!;
    return { id: row.id, state: row.state, connectionPath, csrfState: row.csrf_state, failureReason: null };
  });
}

/**
 * Advances a session by exactly one legal step. Throws on an illegal jump
 * (e.g. STARTED -> CONNECTED) rather than allowing it — per the project
 * rule that onboarding is never marked successful just because a frontend
 * callback fired, the backend independently walks and verifies each step.
 */
export async function transitionOnboardingSession(
  organizationId: string,
  userId: string,
  sessionId: string,
  toState: OnboardingState,
  failureReason?: string
): Promise<void> {
  await withOrgTransaction(organizationId, userId, async (client) => {
    const current = await client.query<{ state: OnboardingState }>(
      "SELECT state FROM onboarding_sessions WHERE organization_id = $1 AND id = $2 FOR UPDATE",
      [organizationId, sessionId]
    );
    const fromState = current.rows[0]?.state;
    if (!fromState) throw new Error("Onboarding session not found");
    if (TERMINAL_STATES.includes(fromState) && fromState !== "CONNECTED") {
      throw new Error(`Cannot transition out of terminal state ${fromState}`);
    }

    const allowed = toState === "FAILED" || HAPPY_PATH[fromState].includes(toState);
    if (!allowed) {
      throw new Error(`Illegal onboarding transition: ${fromState} -> ${toState}`);
    }

    await client.query(
      "UPDATE onboarding_sessions SET state = $1, failure_reason = $2 WHERE organization_id = $3 AND id = $4",
      [toState, failureReason ?? null, organizationId, sessionId]
    );
  });
}

export async function getOnboardingSession(organizationId: string, userId: string, sessionId: string): Promise<OnboardingSession | null> {
  return withOrgTransaction(organizationId, userId, async (client) => {
    const result = await client.query<{
      id: string;
      state: OnboardingState;
      connection_path: ConnectionPath | null;
      csrf_state: string;
      failure_reason: string | null;
    }>("SELECT id, state, connection_path, csrf_state, failure_reason FROM onboarding_sessions WHERE organization_id = $1 AND id = $2", [
      organizationId,
      sessionId,
    ]);
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      state: row.state,
      connectionPath: row.connection_path,
      csrfState: row.csrf_state,
      failureReason: row.failure_reason,
    };
  });
}

export interface MockConnectResult {
  whatsappAccountId: string;
  whatsappPhoneNumberId: string;
}

/**
 * Mock-mode-only: walks a session through every state to CONNECTED and
 * creates the whatsapp_accounts / whatsapp_phone_numbers / whatsapp_credentials
 * rows a real Embedded Signup completion would produce, so the rest of the
 * app (WhatsApp status page, messaging) has real per-organization data to
 * work against instead of the render-time-only mock in src/server/mock/meta.ts.
 *
 * The real path — loading Meta's JS SDK, handling the popup callback, and
 * exchanging the returned code for a Business Integration System User token
 * via a server-to-server call — is intentionally NOT implemented here. See
 * docs/embedded-signup.md for why: this environment could not verify the
 * exact current request shape for that exchange against Meta's primary
 * docs, and the project rule is to not invent Meta endpoints from secondary
 * sources. Hard-gated so it can never run once MOCK_META=false.
 */
export async function completeMockOnboarding(
  organizationId: string,
  userId: string,
  sessionId: string,
  connectionPath: ConnectionPath
): Promise<MockConnectResult> {
  if (!isMockModeEnabled()) {
    throw new Error("completeMockOnboarding() called outside mock mode");
  }

  for (const state of [
    "META_AUTHENTICATING",
    "BUSINESS_SELECTED",
    "WABA_SELECTED",
    "PHONE_SELECTED",
    "CONNECTING",
    "VERIFYING",
    "CONNECTED",
  ] as const) {
    await transitionOnboardingSession(organizationId, userId, sessionId, state);
  }

  return withOrgTransaction(organizationId, userId, async (client) => {
    const account = await client.query<{ id: string }>(
      `INSERT INTO whatsapp_accounts (organization_id, waba_id, name, onboarding_type, connection_status, business_verification_status)
       VALUES ($1, $2, 'Demo Business (mock)', $3, 'CONNECTED', 'not_started')
       RETURNING id`,
      [organizationId, `mock-waba-${organizationId.slice(0, 8)}`, connectionPath === "EXISTING_APP_NUMBER" ? "COEXISTENCE" : connectionPath === "MIGRATED" ? "MIGRATED" : "NEW"]
    );
    const whatsappAccountId = account.rows[0]!.id;

    const phone = await client.query<{ id: string }>(
      `INSERT INTO whatsapp_phone_numbers (organization_id, whatsapp_account_id, phone_number_id, display_phone_number, verified_name, quality_rating, messaging_limit_tier, status, is_coexistence, last_synced_at)
       VALUES ($1, $2, $3, '+91 90000 00000', 'Demo Business', 'GREEN', 'TIER_1K', 'CONNECTED', $4, now())
       RETURNING id`,
      [organizationId, whatsappAccountId, `mock-phone-${organizationId.slice(0, 8)}`, connectionPath === "EXISTING_APP_NUMBER"]
    );
    const whatsappPhoneNumberId = phone.rows[0]!.id;

    const encrypted = encryptToken("mock-access-token");
    await client.query(
      `INSERT INTO whatsapp_credentials (organization_id, whatsapp_account_id, encrypted_token, key_version, scopes)
       VALUES ($1, $2, $3, $4, ARRAY['whatsapp_business_management', 'whatsapp_business_messaging'])`,
      [organizationId, whatsappAccountId, encrypted.ciphertext, encrypted.keyVersion]
    );

    return { whatsappAccountId, whatsappPhoneNumberId };
  });
}
