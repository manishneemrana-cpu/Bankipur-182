import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import {
  startOnboardingSession,
  transitionOnboardingSession,
  getOnboardingSession,
  completeMockOnboarding,
} from "@/server/onboarding";
import { decryptToken } from "@/server/crypto";

const adminPool = new Pool({ connectionString: process.env.MIGRATE_DATABASE_URL });

let organizationId: string;
let userId: string;
let otherOrgId: string;

beforeAll(async () => {
  const client = await adminPool.connect();
  try {
    const org = await client.query<{ id: string }>("INSERT INTO organizations (name) VALUES ('Onboarding Test Org') RETURNING id");
    organizationId = org.rows[0]!.id;

    const other = await client.query<{ id: string }>("INSERT INTO organizations (name) VALUES ('Other Onboarding Org') RETURNING id");
    otherOrgId = other.rows[0]!.id;

    const user = await client.query<{ id: string }>(
      "INSERT INTO users (email, password_hash, full_name) VALUES ('onboarding-test@example.com', 'x', 'Tester') RETURNING id"
    );
    userId = user.rows[0]!.id;
    await client.query(
      "INSERT INTO organization_members (organization_id, user_id, role, joined_at) VALUES ($1, $2, 'OWNER', now())",
      [organizationId, userId]
    );
  } finally {
    client.release();
  }
});

afterAll(async () => {
  const client = await adminPool.connect();
  try {
    await client.query("DELETE FROM organizations WHERE id IN ($1, $2)", [organizationId, otherOrgId]);
    await client.query("DELETE FROM users WHERE id = $1", [userId]);
  } finally {
    client.release();
  }
  await adminPool.end();
});

describe("onboarding state machine", () => {
  it("starts a session in STARTED with a csrf state and can be re-read", async () => {
    const session = await startOnboardingSession(organizationId, userId, "NEW_NUMBER");
    expect(session.state).toBe("STARTED");
    expect(session.csrfState).toHaveLength(64);

    const reread = await getOnboardingSession(organizationId, userId, session.id);
    expect(reread?.state).toBe("STARTED");
  });

  it("allows only the next legal step, not a skip", async () => {
    const session = await startOnboardingSession(organizationId, userId, "NEW_NUMBER");

    await expect(
      transitionOnboardingSession(organizationId, userId, session.id, "CONNECTED")
    ).rejects.toThrow(/Illegal onboarding transition/);

    await transitionOnboardingSession(organizationId, userId, session.id, "META_AUTHENTICATING");
    const after = await getOnboardingSession(organizationId, userId, session.id);
    expect(after?.state).toBe("META_AUTHENTICATING");
  });

  it("can always transition to FAILED from a non-terminal state", async () => {
    const session = await startOnboardingSession(organizationId, userId, "NEW_NUMBER");
    await transitionOnboardingSession(organizationId, userId, session.id, "FAILED", "Simulated failure");
    const after = await getOnboardingSession(organizationId, userId, session.id);
    expect(after?.state).toBe("FAILED");
    expect(after?.failureReason).toBe("Simulated failure");
  });

  it("refuses to transition out of a terminal FAILED state", async () => {
    const session = await startOnboardingSession(organizationId, userId, "NEW_NUMBER");
    await transitionOnboardingSession(organizationId, userId, session.id, "FAILED");
    await expect(
      transitionOnboardingSession(organizationId, userId, session.id, "META_AUTHENTICATING")
    ).rejects.toThrow(/terminal state/);
  });

  it("cannot see or transition a session belonging to another organization", async () => {
    const session = await startOnboardingSession(organizationId, userId, "NEW_NUMBER");
    const readFromOtherOrg = await getOnboardingSession(otherOrgId, userId, session.id);
    expect(readFromOtherOrg).toBeNull();

    await expect(
      transitionOnboardingSession(otherOrgId, userId, session.id, "META_AUTHENTICATING")
    ).rejects.toThrow(/not found/);
  });
});

describe("completeMockOnboarding", () => {
  it("walks a session to CONNECTED and creates real, encrypted, tenant-scoped rows", async () => {
    const session = await startOnboardingSession(organizationId, userId, "EXISTING_APP_NUMBER");
    const result = await completeMockOnboarding(organizationId, userId, session.id, "EXISTING_APP_NUMBER");

    const finalSession = await getOnboardingSession(organizationId, userId, session.id);
    expect(finalSession?.state).toBe("CONNECTED");

    const client = await adminPool.connect();
    try {
      const phone = await client.query(
        "SELECT is_coexistence, status FROM whatsapp_phone_numbers WHERE id = $1 AND organization_id = $2",
        [result.whatsappPhoneNumberId, organizationId]
      );
      expect(phone.rows[0]).toMatchObject({ is_coexistence: true, status: "CONNECTED" });

      const account = await client.query("SELECT onboarding_type FROM whatsapp_accounts WHERE id = $1", [
        result.whatsappAccountId,
      ]);
      expect(account.rows[0].onboarding_type).toBe("COEXISTENCE");

      const credentials = await client.query<{ encrypted_token: string; key_version: number }>(
        "SELECT encrypted_token, key_version FROM whatsapp_credentials WHERE whatsapp_account_id = $1",
        [result.whatsappAccountId]
      );
      expect(credentials.rows).toHaveLength(1);
      // The stored token is genuinely encrypted (round-trips through decryptToken), not stored in plaintext.
      const decrypted = decryptToken({
        ciphertext: credentials.rows[0]!.encrypted_token,
        keyVersion: credentials.rows[0]!.key_version,
      });
      expect(decrypted).toBe("mock-access-token");
    } finally {
      client.release();
    }
  });

  it("throws if called while MOCK_META is not enabled", async () => {
    const originalEnv = { ...process.env };
    // MOCK_META=false also makes env.ts require real Meta vars just to boot
    // (see src/server/env.ts's superRefine) — supply dummy values so that
    // broader validation passes and this test isolates completeMockOnboarding's
    // own explicit isMockModeEnabled() guard instead.
    Object.assign(process.env, {
      MOCK_META: "false",
      META_APP_ID: "dummy",
      META_APP_SECRET: "dummy",
      META_WEBHOOK_VERIFY_TOKEN: "dummy",
      META_WEBHOOK_APP_SECRET: "dummy",
      META_GRAPH_API_VERSION: "v99.0",
    });
    // env.ts caches its parsed result at module scope; reset the module
    // registry so re-importing actually re-reads process.env instead of
    // returning the already-cached (MOCK_META=true) instance.
    vi.resetModules();
    const { completeMockOnboarding: freshCompleteMockOnboarding, startOnboardingSession: freshStart } = await import(
      "@/server/onboarding"
    );
    try {
      const session = await freshStart(organizationId, userId, "NEW_NUMBER");
      await expect(freshCompleteMockOnboarding(organizationId, userId, session.id, "NEW_NUMBER")).rejects.toThrow(
        /outside mock mode/
      );
    } finally {
      process.env = originalEnv;
      vi.resetModules();
    }
  });
});
