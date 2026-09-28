import { afterAll, describe, expect, it } from "vitest";

import { asUser, newPool, withRollback } from "./client";
import { createOrg, createPlot, createProject, createUser } from "./fixtures";

// Test 15: two salespeople try to hold the same plot at the same time ->
// exactly one succeeds. place_hold() takes a row lock (SELECT ... FOR UPDATE)
// so concurrent callers serialize instead of racing.
describe("holds: anti-double-booking", () => {
  const pool = newPool();
  afterAll(() => pool.end());

  it("lets exactly one of two concurrent holds succeed", async () => {
    // Each concurrent caller needs its own connection + transaction (a single
    // client can't run two transactions at once), so this test manages its
    // own clients rather than using withRollback.
    const setup = pool.connect();
    const client = await setup;
    let plotId = "";
    let sales1 = "";
    let sales2 = "";
    try {
      await client.query("begin");
      const org = await createOrg(client, { name: "Org H", slug: "org-h" });
      sales1 = await createUser(client, "sales1@example.com");
      sales2 = await createUser(client, "sales2@example.com");
      const { addMember } = await import("./fixtures");
      await addMember(client, org, sales1, "sales");
      await addMember(client, org, sales2, "sales");
      const project = await createProject(client, org, {
        name: "P",
        slug: "hold-project",
      });
      const { addProjectMember } = await import("./fixtures");
      await addProjectMember(client, project, sales1);
      await addProjectMember(client, project, sales2);
      plotId = await createPlot(client, project, {
        plotNumber: "H-1",
        status: "AVAILABLE",
      });
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw e;
    } finally {
      client.release();
    }

    const clientA = await pool.connect();
    const clientB = await pool.connect();
    try {
      await clientA.query("begin");
      await clientB.query("begin");
      await asUser(clientA, sales1);
      await asUser(clientB, sales2);

      // clientA takes the row lock first and holds it until commit; clientB's
      // place_hold() blocks on the same lock and only proceeds after A commits.
      const first = clientA.query(
        "select * from public.place_hold($1, null, 24)",
        [plotId],
      );
      await new Promise((r) => setTimeout(r, 50));
      const second = clientB.query(
        "select * from public.place_hold($1, null, 24)",
        [plotId],
      );

      await first;
      await clientA.query("commit");

      let secondError: unknown;
      try {
        await second;
        await clientB.query("commit");
      } catch (e) {
        secondError = e;
        await clientB.query("rollback");
      }

      expect(secondError).toBeInstanceOf(Error);
      expect(String(secondError)).toMatch(/PLOT_NOT_AVAILABLE/);
    } finally {
      clientA.release();
      clientB.release();
    }

    // Verify final state with a fresh, superuser (RLS-bypassing) check.
    const check = await pool.connect();
    try {
      const { rows: holdRows } = await check.query(
        "select held_by_user from public.holds where plot_id = $1 and status = 'active'",
        [plotId],
      );
      expect(holdRows).toHaveLength(1);
      expect(holdRows[0]!.held_by_user).toBe(sales1);

      const { rows: plotRows } = await check.query(
        "select status from public.plots where id = $1",
        [plotId],
      );
      expect(plotRows[0]!.status).toBe("HOLD");
    } finally {
      check.release();
    }
  });

  it("rejects a hold on a plot that is not AVAILABLE", async () => {
    await withRollback(pool, async (client) => {
      const org = await createOrg(client, { name: "Org H2", slug: "org-h2" });
      const sales = await createUser(client, "sales3@example.com");
      const { addMember } = await import("./fixtures");
      await addMember(client, org, sales, "sales");
      const project = await createProject(client, org, {
        name: "P",
        slug: "hold-project-2",
      });
      const { addProjectMember } = await import("./fixtures");
      await addProjectMember(client, project, sales);
      const plot = await createPlot(client, project, {
        plotNumber: "H-2",
        status: "SOLD",
      });

      await asUser(client, sales);
      await expect(
        client.query("select * from public.place_hold($1)", [plot]),
      ).rejects.toThrow(/PLOT_NOT_AVAILABLE/);
    });
  });

  it("release_expired_holds() frees an expired hold back to AVAILABLE", async () => {
    await withRollback(pool, async (client) => {
      const org = await createOrg(client, { name: "Org H3", slug: "org-h3" });
      const sales = await createUser(client, "sales4@example.com");
      const { addMember } = await import("./fixtures");
      await addMember(client, org, sales, "sales");
      const project = await createProject(client, org, {
        name: "P",
        slug: "hold-project-3",
      });
      const { addProjectMember } = await import("./fixtures");
      await addProjectMember(client, project, sales);
      const plot = await createPlot(client, project, {
        plotNumber: "H-3",
        status: "AVAILABLE",
      });

      await asUser(client, sales);
      await client.query("select * from public.place_hold($1, null, 24)", [
        plot,
      ]);
      await client.query("select 1 from public.plots where id = $1", [plot]);

      // Force the hold into the past, then run the sweep as service_role.
      await client.query("reset role");
      await client.query(
        "update public.holds set expires_at = now() - interval '1 hour' where plot_id = $1",
        [plot],
      );
      await client.query("set local role service_role");
      await client.query("select public.release_expired_holds()");

      const { rows } = await client.query(
        "select status from public.plots where id = $1",
        [plot],
      );
      expect(rows[0]!.status).toBe("AVAILABLE");
      const { rows: holdRows } = await client.query(
        "select status from public.holds where plot_id = $1",
        [plot],
      );
      expect(holdRows[0]!.status).toBe("released");
    });
  });
});
