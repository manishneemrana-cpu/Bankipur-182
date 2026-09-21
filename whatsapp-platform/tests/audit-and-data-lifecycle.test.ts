import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { recordAuditLog, listAuditLogsForOrganization, listAuditLogsForAdmin } from "@/server/audit";
import { exportOrganizationData, deleteContactData, requestOrganizationDeletion } from "@/server/data-lifecycle";
import { withPlatformAdminTransaction } from "@/server/db";

const adminPool = new Pool({ connectionString: process.env.MIGRATE_DATABASE_URL });

let orgAId: string;
let orgBId: string;
let userId: string;

beforeAll(async () => {
  const orgA = await adminPool.query<{ id: string }>("INSERT INTO organizations (name) VALUES ('Audit Test Org A') RETURNING id");
  orgAId = orgA.rows[0]!.id;
  const orgB = await adminPool.query<{ id: string }>("INSERT INTO organizations (name) VALUES ('Audit Test Org B') RETURNING id");
  orgBId = orgB.rows[0]!.id;
  const user = await adminPool.query<{ id: string }>(
    "INSERT INTO users (email, password_hash, full_name) VALUES ('audit-test@example.com', 'x', 'Tester') RETURNING id"
  );
  userId = user.rows[0]!.id;
  await adminPool.query(
    "INSERT INTO organization_members (organization_id, user_id, role, joined_at) VALUES ($1, $2, 'OWNER', now()), ($3, $2, 'OWNER', now())",
    [orgAId, userId, orgBId]
  );
});

afterAll(async () => {
  await withPlatformAdminTransaction((client) =>
    client.query("DELETE FROM organizations WHERE id IN ($1, $2)", [orgAId, orgBId])
  );
  await adminPool.query("DELETE FROM users WHERE id = $1", [userId]);
  await adminPool.end();
});

describe("audit logging", () => {
  it("records an entry and reads it back scoped to the organization", async () => {
    await recordAuditLog(orgAId, userId, "test.action", { targetType: "thing", targetId: "t1", metadata: { foo: "bar" } });

    const logs = await listAuditLogsForOrganization(orgAId);
    expect(logs.some((l) => l.action === "test.action" && l.targetId === "t1")).toBe(true);
  });

  it("does not leak org A's audit logs into org B's own-organization read", async () => {
    await recordAuditLog(orgAId, userId, "test.only_in_a");
    const orgBLogs = await listAuditLogsForOrganization(orgBId);
    expect(orgBLogs.some((l) => l.action === "test.only_in_a")).toBe(false);
  });

  it("platform admin read sees entries across both organizations", async () => {
    await recordAuditLog(orgBId, userId, "test.only_in_b");
    const adminLogs = await listAuditLogsForAdmin();
    expect(adminLogs.some((l) => l.action === "test.action")).toBe(true);
    expect(adminLogs.some((l) => l.action === "test.only_in_b")).toBe(true);
  });
});

describe("data export", () => {
  it("exports contacts and leads for the organization and records a READY request", async () => {
    await adminPool.query(
      "INSERT INTO contacts (organization_id, phone_e164, name) VALUES ($1, '+919812340001', 'Export Contact')",
      [orgAId]
    );

    const exported = await exportOrganizationData(orgAId, userId) as { contacts: unknown[]; organizationId: string };
    expect(exported.organizationId).toBe(orgAId);
    expect(exported.contacts).toHaveLength(1);

    const requests = await adminPool.query("SELECT status FROM data_export_requests WHERE organization_id = $1", [orgAId]);
    expect(requests.rows.some((r) => r.status === "READY")).toBe(true);
  });
});

describe("contact deletion", () => {
  it("deletes a contact and detaches (rather than blocking on) a lead that references it", async () => {
    const contact = await adminPool.query<{ id: string }>(
      "INSERT INTO contacts (organization_id, phone_e164) VALUES ($1, '+919812340002') RETURNING id",
      [orgAId]
    );
    const contactId = contact.rows[0]!.id;
    const lead = await adminPool.query<{ id: string }>(
      "INSERT INTO leads (organization_id, contact_id, name) VALUES ($1, $2, 'Linked Lead') RETURNING id",
      [orgAId, contactId]
    );

    await deleteContactData(orgAId, userId, contactId);

    const contactRows = await adminPool.query("SELECT id FROM contacts WHERE id = $1", [contactId]);
    expect(contactRows.rows).toHaveLength(0);

    const leadRows = await adminPool.query<{ contact_id: string | null }>("SELECT contact_id FROM leads WHERE id = $1", [
      lead.rows[0]!.id,
    ]);
    expect(leadRows.rows[0]!.contact_id).toBeNull();

    const deletionRequests = await adminPool.query(
      "SELECT status FROM deletion_requests WHERE organization_id = $1 AND scope = 'CONTACT' AND target_id = $2",
      [orgAId, contactId]
    );
    expect(deletionRequests.rows[0]?.status).toBe("DONE");
  });

  it("throws for a contact that does not exist rather than silently succeeding", async () => {
    await expect(deleteContactData(orgAId, userId, "00000000-0000-0000-0000-000000000000")).rejects.toThrow(/not found/i);
  });
});

describe("organization deletion request", () => {
  it("creates a PENDING request rather than deleting anything", async () => {
    await requestOrganizationDeletion(orgBId, userId);
    const requests = await adminPool.query(
      "SELECT status FROM deletion_requests WHERE organization_id = $1 AND scope = 'ORGANIZATION'",
      [orgBId]
    );
    expect(requests.rows[0]?.status).toBe("PENDING");

    const orgStillExists = await adminPool.query("SELECT id FROM organizations WHERE id = $1", [orgBId]);
    expect(orgStillExists.rows).toHaveLength(1);
  });
});
