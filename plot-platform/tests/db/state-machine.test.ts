import { afterAll, describe, expect, it } from "vitest";

import { asUser, expectRejects, newPool, withRollback } from "./client";
import {
  addMember,
  createOrg,
  createPlot,
  createProject,
  createUser,
} from "./fixtures";

describe("plot status state machine", () => {
  const pool = newPool();
  afterAll(() => pool.end());

  it("allows a valid forward transition and records history", async () => {
    await withRollback(pool, async (client) => {
      const org = await createOrg(client, { name: "Org S", slug: "org-s" });
      const manager = await createUser(client, "manager@example.com");
      await addMember(client, org, manager, "manager");
      const project = await createProject(client, org, {
        name: "P",
        slug: "sm-project",
      });
      const plot = await createPlot(client, project, {
        plotNumber: "S-1",
        status: "NOT_RELEASED",
      });

      await asUser(client, manager);
      await client.query(
        "select * from public.change_plot_status($1, 'AVAILABLE')",
        [plot],
      );

      const { rows } = await client.query(
        "select status from public.plots where id = $1",
        [plot],
      );
      expect(rows[0]!.status).toBe("AVAILABLE");

      const history = await client.query(
        "select from_status, to_status from public.plot_status_history where plot_id = $1 order by created_at",
        [plot],
      );
      expect(history.rows.map((r) => r.to_status)).toEqual([
        "NOT_RELEASED",
        "AVAILABLE",
      ]);
    });
  });

  it("rejects an illegal jump (NOT_RELEASED -> BOOKED)", async () => {
    await withRollback(pool, async (client) => {
      const org = await createOrg(client, { name: "Org S2", slug: "org-s2" });
      const manager = await createUser(client, "manager2@example.com");
      await addMember(client, org, manager, "manager");
      const project = await createProject(client, org, {
        name: "P",
        slug: "sm-project-2",
      });
      const plot = await createPlot(client, project, {
        plotNumber: "S-2",
        status: "NOT_RELEASED",
      });

      await asUser(client, manager);
      await expect(
        client.query("select * from public.change_plot_status($1, 'BOOKED')", [
          plot,
        ]),
      ).rejects.toThrow(/TRANSITION_NOT_ALLOWED/);
    });
  });

  it("rejects a sales user reverting SOLD -> AVAILABLE (needs org_admin)", async () => {
    await withRollback(pool, async (client) => {
      const org = await createOrg(client, { name: "Org S3", slug: "org-s3" });
      const sales = await createUser(client, "sales-sm@example.com");
      await addMember(client, org, sales, "sales");
      const project = await createProject(client, org, {
        name: "P",
        slug: "sm-project-3",
      });
      const { addProjectMember } = await import("./fixtures");
      await addProjectMember(client, project, sales);
      const plot = await createPlot(client, project, {
        plotNumber: "S-3",
        status: "SOLD",
      });

      await asUser(client, sales);
      await expect(
        client.query(
          "select * from public.change_plot_status($1, 'AVAILABLE', 'oops')",
          [plot],
        ),
      ).rejects.toThrow(/ROLE_NOT_ALLOWED/);
    });
  });

  it("requires a reason for a backward move even for an allowed role", async () => {
    await withRollback(pool, async (client) => {
      const org = await createOrg(client, { name: "Org S4", slug: "org-s4" });
      const admin = await createUser(client, "admin-sm@example.com");
      await addMember(client, org, admin, "org_admin");
      const project = await createProject(client, org, {
        name: "P",
        slug: "sm-project-4",
      });
      const plot = await createPlot(client, project, {
        plotNumber: "S-4",
        status: "SOLD",
      });

      await asUser(client, admin);
      await expectRejects(
        client,
        () =>
          client.query(
            "select * from public.change_plot_status($1, 'AVAILABLE')",
            [plot],
          ),
        /REASON_REQUIRED/,
      );

      await client.query(
        "select * from public.change_plot_status($1, 'AVAILABLE', 'buyer withdrew')",
        [plot],
      );
      const { rows } = await client.query(
        "select status from public.plots where id = $1",
        [plot],
      );
      expect(rows[0]!.status).toBe("AVAILABLE");
    });
  });

  it("bulk status change applies to every plot in the list", async () => {
    await withRollback(pool, async (client) => {
      const org = await createOrg(client, { name: "Org S5", slug: "org-s5" });
      const manager = await createUser(client, "manager-sm@example.com");
      await addMember(client, org, manager, "manager");
      const project = await createProject(client, org, {
        name: "P",
        slug: "sm-project-5",
      });
      const p1 = await createPlot(client, project, {
        plotNumber: "S-5a",
        status: "NOT_RELEASED",
      });
      const p2 = await createPlot(client, project, {
        plotNumber: "S-5b",
        status: "NOT_RELEASED",
      });

      await asUser(client, manager);
      const { rows } = await client.query(
        "select public.change_plots_status(array[$1, $2]::uuid[], 'AVAILABLE') as n",
        [p1, p2],
      );
      expect(rows[0]!.n).toBe(2);
    });
  });
});
