import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

const adminPool = new Pool({ connectionString: process.env.MIGRATE_DATABASE_URL });

let organizationId: string;

beforeAll(async () => {
  const result = await adminPool.query<{ id: string }>("INSERT INTO organizations (name) VALUES ('Leads Test Org') RETURNING id");
  organizationId = result.rows[0]!.id;
});

afterAll(async () => {
  await adminPool.query("DELETE FROM organizations WHERE id = $1", [organizationId]);
  await adminPool.end();
});

describe("leads", () => {
  it("only accepts a lead_status value from the CHECK constraint's list", async () => {
    const created = await adminPool.query<{ id: string }>(
      "INSERT INTO leads (organization_id, name) VALUES ($1, 'Test Lead') RETURNING id",
      [organizationId]
    );
    await expect(
      adminPool.query("UPDATE leads SET lead_status = 'NOT_A_REAL_STATUS' WHERE id = $1", [created.rows[0]!.id])
    ).rejects.toThrow();
  });

  it("defaults a new lead to NEW status", async () => {
    const created = await adminPool.query<{ lead_status: string }>(
      "INSERT INTO leads (organization_id, name) VALUES ($1, 'Default Status Lead') RETURNING lead_status",
      [organizationId]
    );
    expect(created.rows[0]!.lead_status).toBe("NEW");
  });
});
