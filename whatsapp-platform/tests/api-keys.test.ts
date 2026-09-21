import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { createApiKey, authenticateApiKey, hasScope } from "@/server/api-keys";

const adminPool = new Pool({ connectionString: process.env.MIGRATE_DATABASE_URL });

let organizationId: string;
let userId: string;
let otherOrgId: string;

beforeAll(async () => {
  const org = await adminPool.query<{ id: string }>("INSERT INTO organizations (name) VALUES ('API Key Test Org') RETURNING id");
  organizationId = org.rows[0]!.id;
  const other = await adminPool.query<{ id: string }>("INSERT INTO organizations (name) VALUES ('Other API Key Org') RETURNING id");
  otherOrgId = other.rows[0]!.id;

  const user = await adminPool.query<{ id: string }>(
    "INSERT INTO users (email, password_hash, full_name) VALUES ('api-key-test@example.com', 'x', 'Tester') RETURNING id"
  );
  userId = user.rows[0]!.id;
  await adminPool.query(
    "INSERT INTO organization_members (organization_id, user_id, role, joined_at) VALUES ($1, $2, 'OWNER', now())",
    [organizationId, userId]
  );
});

afterAll(async () => {
  await adminPool.query("DELETE FROM organizations WHERE id IN ($1, $2)", [organizationId, otherOrgId]);
  await adminPool.query("DELETE FROM users WHERE id = $1", [userId]);
  await adminPool.end();
});

describe("API key auth", () => {
  it("creates a key and can authenticate with the raw value afterwards", async () => {
    const created = await createApiKey(organizationId, userId, "Test Key", ["contacts.read"]);
    expect(created.rawKey).toMatch(/^wap_/);

    const authenticated = await authenticateApiKey(created.rawKey);
    expect(authenticated).not.toBeNull();
    expect(authenticated!.organizationId).toBe(organizationId);
    expect(hasScope(authenticated!, "contacts.read")).toBe(true);
    expect(hasScope(authenticated!, "leads.write")).toBe(false);
  });

  it("rejects a made-up key", async () => {
    const authenticated = await authenticateApiKey("wap_not_a_real_key_at_all");
    expect(authenticated).toBeNull();
  });

  it("rejects a revoked key", async () => {
    const created = await createApiKey(organizationId, userId, "Revoked Key", ["contacts.read"]);
    await adminPool.query("UPDATE api_keys SET revoked_at = now() WHERE key_prefix = $1", [created.prefix]);

    const authenticated = await authenticateApiKey(created.rawKey);
    expect(authenticated).toBeNull();
  });

  it("rejects an expired key", async () => {
    const created = await createApiKey(organizationId, userId, "Expired Key", ["contacts.read"]);
    await adminPool.query("UPDATE api_keys SET expires_at = now() - interval '1 day' WHERE key_prefix = $1", [
      created.prefix,
    ]);

    const authenticated = await authenticateApiKey(created.rawKey);
    expect(authenticated).toBeNull();
  });

  it("resolves to the correct organization, not a different one, even though the lookup itself is pre-tenant", async () => {
    const keyA = await createApiKey(organizationId, userId, "Org A Key", ["contacts.read"]);
    await adminPool.query(
      "INSERT INTO users (email, password_hash, full_name) VALUES ('api-key-other@example.com', 'x', 'Other') RETURNING id"
    );
    const otherUser = await adminPool.query<{ id: string }>(
      "SELECT id FROM users WHERE email = 'api-key-other@example.com'"
    );
    await adminPool.query(
      "INSERT INTO organization_members (organization_id, user_id, role, joined_at) VALUES ($1, $2, 'OWNER', now())",
      [otherOrgId, otherUser.rows[0]!.id]
    );
    const keyB = await createApiKey(otherOrgId, otherUser.rows[0]!.id, "Org B Key", ["contacts.read"]);

    const authA = await authenticateApiKey(keyA.rawKey);
    const authB = await authenticateApiKey(keyB.rawKey);
    expect(authA!.organizationId).toBe(organizationId);
    expect(authB!.organizationId).toBe(otherOrgId);
    expect(authA!.organizationId).not.toBe(authB!.organizationId);

    await adminPool.query("DELETE FROM users WHERE id = $1", [otherUser.rows[0]!.id]);
  });
});
