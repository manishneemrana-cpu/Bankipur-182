import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool, type PoolClient } from "pg";

// Exercises the same RLS-dependent code path as src/server/organization.ts and
// src/server/auth.ts's requireOrgContext, without importing them directly
// (those pull in the `server-only` guard — see the comment in
// tests/tenant-isolation.test.ts). This is the test that would have caught
// the Phase 1 bug where `organization_members` had no policy letting a user
// look up their own memberships before an organization_id is known.

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adminPool = new Pool({ connectionString: process.env.MIGRATE_DATABASE_URL });

async function asUser<T>(userId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
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

let userA: string;
let userB: string;
let orgA: string;
let orgB: string;

beforeAll(async () => {
  const client = await adminPool.connect();
  try {
    const u1 = await client.query<{ id: string }>(
      "INSERT INTO users (email, password_hash, full_name) VALUES ('orgtest-a@example.com', 'x', 'A') RETURNING id"
    );
    userA = u1.rows[0]!.id;
    const u2 = await client.query<{ id: string }>(
      "INSERT INTO users (email, password_hash, full_name) VALUES ('orgtest-b@example.com', 'x', 'B') RETURNING id"
    );
    userB = u2.rows[0]!.id;

    const o1 = await client.query<{ id: string }>(
      "INSERT INTO organizations (name) VALUES ('Org Test A') RETURNING id"
    );
    orgA = o1.rows[0]!.id;
    const o2 = await client.query<{ id: string }>(
      "INSERT INTO organizations (name) VALUES ('Org Test B') RETURNING id"
    );
    orgB = o2.rows[0]!.id;

    await client.query(
      "INSERT INTO organization_members (organization_id, user_id, role, joined_at) VALUES ($1, $2, 'OWNER', now())",
      [orgA, userA]
    );
    await client.query(
      "INSERT INTO organization_members (organization_id, user_id, role, joined_at) VALUES ($1, $2, 'AGENT', now())",
      [orgB, userB]
    );
  } finally {
    client.release();
  }
});

afterAll(async () => {
  const client = await adminPool.connect();
  try {
    await client.query("DELETE FROM organizations WHERE id IN ($1, $2)", [orgA, orgB]);
    await client.query("DELETE FROM users WHERE id IN ($1, $2)", [userA, userB]);
  } finally {
    client.release();
  }
  await pool.end();
  await adminPool.end();
});

describe("a signed-in user can look up their own organization memberships", () => {
  it("sees its own membership row scoped only by user_id (no org_id set yet)", async () => {
    const rows = await asUser(userA, (client) =>
      client
        .query<{ organization_id: string; role: string }>(
          "SELECT organization_id, role FROM organization_members WHERE user_id = $1",
          [userA]
        )
        .then((r) => r.rows)
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ organization_id: orgA, role: "OWNER" });
  });

  it("does not see another user's membership row this way", async () => {
    const rows = await asUser(userA, (client) =>
      client
        .query("SELECT organization_id FROM organization_members WHERE user_id = $1", [userB])
        .then((r) => r.rows)
    );
    expect(rows).toHaveLength(0);
  });

  it("can join organization_members to organizations to see its own org's name (the actual getUserOrganizations query)", async () => {
    // Regression test: this join returned zero rows under RLS even though the
    // organization_members half was readable, because `organizations` itself
    // only allowed id = app_org_id() (unset here) or platform admin. A
    // freshly-registered user's dashboard would redirect them straight back
    // to /register, as if they belonged to no organization at all.
    const rows = await asUser(userA, (client) =>
      client
        .query<{ organization_id: string; organization_name: string; role: string }>(
          `SELECT o.id AS organization_id, o.name AS organization_name, m.role
           FROM organization_members m
           JOIN organizations o ON o.id = m.organization_id
           WHERE m.user_id = $1`,
          [userA]
        )
        .then((r) => r.rows)
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ organization_id: orgA, organization_name: "Org Test A", role: "OWNER" });
  });

  it("cannot see another organization's name this way, only its own", async () => {
    const rows = await asUser(userA, (client) =>
      client.query<{ id: string }>("SELECT id FROM organizations WHERE id = $1", [orgB]).then((r) => r.rows)
    );
    expect(rows).toHaveLength(0);
  });

  it("cannot rename an organization it merely belongs to (read access isn't write access)", async () => {
    await asUser(userA, async (client) => {
      const result = await client.query("UPDATE organizations SET name = 'Hacked' WHERE id = $1", [orgA]);
      expect(result.rowCount).toBe(0);
    });
  });

  it("still cannot insert a membership for itself in an organization it doesn't belong to", async () => {
    await expect(
      asUser(userA, (client) =>
        client.query(
          "INSERT INTO organization_members (organization_id, user_id, role, joined_at) VALUES ($1, $2, 'OWNER', now())",
          [orgB, userA]
        )
      )
    ).rejects.toThrow();
  });
});
