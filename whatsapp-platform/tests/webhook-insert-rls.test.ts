import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { withPlatformAdminTransaction } from "@/server/db";

// Regression test for a real bug: `INSERT ... RETURNING` makes Postgres
// re-check the just-inserted row against the table's SELECT policy, not just
// its INSERT policy. webhook_events_read requires app_is_platform_admin() or
// a matching app_org_id() — a plain unprivileged connection with neither set
// hit "new row violates row-level security policy" on the INSERT itself,
// even though webhook_events_insert's WITH CHECK (true) allows it. Found via
// an actual end-to-end webhook POST, not by tests/webhook-processing.test.ts,
// which calls processWhatsAppWebhook() directly and never exercises this
// INSERT statement or the app's own unprivileged pool.

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const testHashes: string[] = [];

afterAll(async () => {
  if (testHashes.length > 0) {
    await withPlatformAdminTransaction((client) =>
      client.query("DELETE FROM webhook_events WHERE event_hash = ANY($1)", [testHashes])
    );
  }
  await pool.end();
});

describe("webhook_events insert as the unprivileged app role", () => {
  it("fails with a plain (non-admin) connection when using RETURNING — documents why the route can't use withSystemClient here", async () => {
    const client = await pool.connect();
    try {
      await expect(
        client.query(
          "INSERT INTO webhook_events (event_hash, event_type, payload) VALUES ($1, 'test', '{}') RETURNING id",
          ["rls-test-plain-" + Date.now()]
        )
      ).rejects.toThrow(/row-level security/);
    } finally {
      client.release();
    }
  });

  it("succeeds with RETURNING when run as a platform-admin transaction, matching the real webhook route", async () => {
    const hash = "rls-test-admin-" + Date.now();
    testHashes.push(hash);
    const result = await withPlatformAdminTransaction((client) =>
      client.query<{ id: string }>(
        "INSERT INTO webhook_events (event_hash, event_type, payload) VALUES ($1, 'test', '{}') RETURNING id",
        [hash]
      )
    );
    expect(result.rows).toHaveLength(1);
  });
});
