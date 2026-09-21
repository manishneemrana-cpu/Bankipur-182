import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool, type PoolClient } from "pg";

// This test exercises the actual Postgres RLS policies from migrations/0001_init.sql
// against a real database (see .env / docker-compose's `db` service). It talks to
// `pg` directly rather than importing src/server/db.ts, because that module pulls
// in the `server-only` guard which only resolves correctly inside Next's build.
// The `SET LOCAL app.org_id` pattern used here is exactly what src/server/db.ts
// runs in `withOrgTransaction`, so this proves the same isolation the app relies on.

// The app's own (unprivileged, RLS-bound) connection — this is what's under test.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// A superuser connection used only to seed/clean up fixtures, bypassing RLS on purpose.
const adminPool = new Pool({ connectionString: process.env.MIGRATE_DATABASE_URL });

async function asOrg<T>(orgId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
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

async function asSuperuserSetup<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await adminPool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

let orgA: string;
let orgB: string;
let contactA: string;
let leadA: string;

beforeAll(async () => {
  await asSuperuserSetup(async (client) => {
    const orgAResult = await client.query<{ id: string }>(
      "INSERT INTO organizations (name) VALUES ('Tenant A') RETURNING id"
    );
    orgA = orgAResult.rows[0]!.id;
    const orgBResult = await client.query<{ id: string }>(
      "INSERT INTO organizations (name) VALUES ('Tenant B') RETURNING id"
    );
    orgB = orgBResult.rows[0]!.id;
  });

  await asOrg(orgA, async (client) => {
    const contact = await client.query<{ id: string }>(
      "INSERT INTO contacts (organization_id, phone_e164, name) VALUES ($1, '+911234567890', 'Alice') RETURNING id",
      [orgA]
    );
    contactA = contact.rows[0]!.id;

    const lead = await client.query<{ id: string }>(
      "INSERT INTO leads (organization_id, contact_id, name, phone) VALUES ($1, $2, 'Alice', '+911234567890') RETURNING id",
      [orgA, contactA]
    );
    leadA = lead.rows[0]!.id;
  });
});

afterAll(async () => {
  await asSuperuserSetup(async (client) => {
    await client.query("DELETE FROM organizations WHERE id IN ($1, $2)", [orgA, orgB]);
  });
  await pool.end();
  await adminPool.end();
});

describe("tenant isolation via Row-Level Security", () => {
  it("lets an organization read its own contacts", async () => {
    const rows = await asOrg(orgA, (client) =>
      client.query("SELECT id FROM contacts WHERE id = $1", [contactA]).then((r) => r.rows)
    );
    expect(rows).toHaveLength(1);
  });

  it("hides tenant A's contacts from tenant B", async () => {
    const rows = await asOrg(orgB, (client) =>
      client.query("SELECT id FROM contacts WHERE id = $1", [contactA]).then((r) => r.rows)
    );
    expect(rows).toHaveLength(0);
  });

  it("hides tenant A's contacts from a session with no org set at all", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const rows = await client.query("SELECT id FROM contacts WHERE id = $1", [contactA]);
      expect(rows.rows).toHaveLength(0);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("hides tenant A's leads from tenant B", async () => {
    const rows = await asOrg(orgB, (client) =>
      client.query("SELECT id FROM leads WHERE id = $1", [leadA]).then((r) => r.rows)
    );
    expect(rows).toHaveLength(0);
  });

  it("blocks tenant B from inserting a row tagged as tenant A (WITH CHECK)", async () => {
    await expect(
      asOrg(orgB, (client) =>
        client.query(
          "INSERT INTO contacts (organization_id, phone_e164, name) VALUES ($1, '+910000000000', 'Injected')",
          [orgA]
        )
      )
    ).rejects.toThrow();
  });

  it("blocks tenant B from updating tenant A's contact even by primary key", async () => {
    await asOrg(orgB, async (client) => {
      const result = await client.query("UPDATE contacts SET name = 'Hacked' WHERE id = $1", [contactA]);
      expect(result.rowCount).toBe(0);
    });

    const stillOriginal = await asOrg(orgA, (client) =>
      client.query<{ name: string }>("SELECT name FROM contacts WHERE id = $1", [contactA])
    );
    expect(stillOriginal.rows[0]?.name).toBe("Alice");
  });

  it("blocks tenant B from deleting tenant A's contact", async () => {
    await asOrg(orgB, async (client) => {
      const result = await client.query("DELETE FROM contacts WHERE id = $1", [contactA]);
      expect(result.rowCount).toBe(0);
    });

    const stillThere = await asOrg(orgA, (client) =>
      client.query("SELECT id FROM contacts WHERE id = $1", [contactA])
    );
    expect(stillThere.rows).toHaveLength(1);
  });

  it("only shows an organization's own row in the organizations table", async () => {
    const rows = await asOrg(orgA, (client) =>
      client.query("SELECT id FROM organizations").then((r) => r.rows)
    );
    expect(rows.map((r: { id: string }) => r.id)).toEqual([orgA]);
  });

  it("lets a platform admin see across organizations", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.is_platform_admin', 'true', true)");
      const rows = await client.query("SELECT id FROM organizations WHERE id IN ($1, $2)", [orgA, orgB]);
      expect(rows.rows).toHaveLength(2);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});
