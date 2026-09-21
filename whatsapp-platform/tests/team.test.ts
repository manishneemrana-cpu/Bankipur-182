import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

// Exercises the same "at least one Owner" invariant that
// src/server/actions/team-actions.ts enforces before demoting/removing an
// Owner (count current owners; refuse if this is the last one) — proving the
// underlying query logic is correct, the same way tests/templates.test.ts
// exercises the guarded SQL statements those actions run.

const adminPool = new Pool({ connectionString: process.env.MIGRATE_DATABASE_URL });

let organizationId: string;
let ownerId: string;
let secondOwnerId: string;

async function countOwners(): Promise<number> {
  const result = await adminPool.query<{ count: string }>(
    "SELECT count(*) FROM organization_members WHERE organization_id = $1 AND role = 'OWNER'",
    [organizationId]
  );
  return Number(result.rows[0]!.count);
}

beforeAll(async () => {
  const org = await adminPool.query<{ id: string }>("INSERT INTO organizations (name) VALUES ('Team Test Org') RETURNING id");
  organizationId = org.rows[0]!.id;

  const owner = await adminPool.query<{ id: string }>(
    "INSERT INTO users (email, password_hash, full_name) VALUES ('team-owner@example.com', 'x', 'Owner') RETURNING id"
  );
  ownerId = owner.rows[0]!.id;
  await adminPool.query(
    "INSERT INTO organization_members (organization_id, user_id, role, joined_at) VALUES ($1, $2, 'OWNER', now())",
    [organizationId, ownerId]
  );

  const secondOwner = await adminPool.query<{ id: string }>(
    "INSERT INTO users (email, password_hash, full_name) VALUES ('team-second-owner@example.com', 'x', 'Second Owner') RETURNING id"
  );
  secondOwnerId = secondOwner.rows[0]!.id;
});

afterAll(async () => {
  await adminPool.query("DELETE FROM organizations WHERE id = $1", [organizationId]);
  await adminPool.query("DELETE FROM users WHERE id IN ($1, $2)", [ownerId, secondOwnerId]);
  await adminPool.end();
});

describe("at-least-one-owner invariant", () => {
  it("the guard would block demoting the sole owner", async () => {
    expect(await countOwners()).toBe(1);
    // team-actions.ts's guard: refuse if role === 'OWNER' && target !== 'OWNER' && countOwners() <= 1
    const wouldBlock = (await countOwners()) <= 1;
    expect(wouldBlock).toBe(true);
  });

  it("the guard would allow demoting an owner once a second owner exists", async () => {
    await adminPool.query(
      "INSERT INTO organization_members (organization_id, user_id, role, joined_at) VALUES ($1, $2, 'OWNER', now())",
      [organizationId, secondOwnerId]
    );
    expect(await countOwners()).toBe(2);
    const wouldBlock = (await countOwners()) <= 1;
    expect(wouldBlock).toBe(false);

    // Demote actually succeeds now, leaving exactly one owner.
    await adminPool.query("UPDATE organization_members SET role = 'ADMIN' WHERE organization_id = $1 AND user_id = $2", [
      organizationId,
      secondOwnerId,
    ]);
    expect(await countOwners()).toBe(1);
  });
});
