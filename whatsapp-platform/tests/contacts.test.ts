import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adminPool = new Pool({ connectionString: process.env.MIGRATE_DATABASE_URL });

let orgA: string;
let orgB: string;

beforeAll(async () => {
  const client = await adminPool.connect();
  try {
    const a = await client.query<{ id: string }>("INSERT INTO organizations (name) VALUES ('Contacts Test A') RETURNING id");
    orgA = a.rows[0]!.id;
    const b = await client.query<{ id: string }>("INSERT INTO organizations (name) VALUES ('Contacts Test B') RETURNING id");
    orgB = b.rows[0]!.id;
  } finally {
    client.release();
  }
});

afterAll(async () => {
  await adminPool.query("DELETE FROM organizations WHERE id IN ($1, $2)", [orgA, orgB]);
  await pool.end();
  await adminPool.end();
});

async function asOrg<T>(orgId: string, fn: (client: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.org_id', $1, true)", [orgId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

describe("contact suppression and isolation", () => {
  it("enforces the unique (organization_id, phone_e164) constraint", async () => {
    await asOrg(orgA, (client) =>
      client.query("INSERT INTO contacts (organization_id, phone_e164) VALUES ($1, '+911111111111')", [orgA])
    );
    await expect(
      asOrg(orgA, (client) =>
        client.query("INSERT INTO contacts (organization_id, phone_e164) VALUES ($1, '+911111111111')", [orgA])
      )
    ).rejects.toThrow();
  });

  it("allows the same phone number to exist independently in two different organizations", async () => {
    await asOrg(orgA, (client) =>
      client.query("INSERT INTO contacts (organization_id, phone_e164) VALUES ($1, '+912222222222')", [orgA])
    );
    await expect(
      asOrg(orgB, (client) =>
        client.query("INSERT INTO contacts (organization_id, phone_e164) VALUES ($1, '+912222222222')", [orgB])
      )
    ).resolves.toBeTruthy();
  });

  it("toggling suppressed sets/clears opted_out_at consistently", async () => {
    const created = await asOrg(orgA, (client) =>
      client.query<{ id: string }>(
        "INSERT INTO contacts (organization_id, phone_e164, suppressed) VALUES ($1, '+913333333333', false) RETURNING id",
        [orgA]
      )
    );
    const contactId = created.rows[0]!.id;

    await asOrg(orgA, (client) =>
      client.query(
        "UPDATE contacts SET suppressed = NOT suppressed, opted_out_at = CASE WHEN suppressed THEN NULL ELSE now() END WHERE id = $1",
        [contactId]
      )
    );
    const afterSuppress = await asOrg(orgA, (client) =>
      client.query<{ suppressed: boolean; opted_out_at: Date | null }>(
        "SELECT suppressed, opted_out_at FROM contacts WHERE id = $1",
        [contactId]
      )
    );
    expect(afterSuppress.rows[0]).toMatchObject({ suppressed: true });
    expect(afterSuppress.rows[0]!.opted_out_at).not.toBeNull();
  });
});
