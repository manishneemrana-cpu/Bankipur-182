import { afterAll, describe, expect, it } from "vitest";

import {
  asAnon,
  asOwner,
  asUser,
  expectRejects,
  newPool,
  withRollback,
} from "./client";
import {
  addMember,
  createOrg,
  createPlot,
  createProject,
  createUser,
} from "./fixtures";

// Product Contract rule 7 / test 16: a user of Org A cannot read any Org B row.
describe("cross-org RLS isolation", () => {
  const pool = newPool();
  afterAll(() => pool.end());

  it("blocks reads and writes across organizations", async () => {
    await withRollback(pool, async (client) => {
      const userA = await createUser(client, "a@example.com");
      const userB = await createUser(client, "b@example.com");
      const orgA = await createOrg(client, {
        name: "Org A",
        slug: "org-a",
        adminUserId: userA,
      });
      await createOrg(client, {
        name: "Org B",
        slug: "org-b",
        adminUserId: userB,
      });
      const projectA = await createProject(client, orgA, {
        name: "A Project",
        slug: "a-project",
      });
      const plotA = await createPlot(client, projectA, { plotNumber: "A-1" });

      await asUser(client, userB);

      const orgs = await client.query(
        "select id from public.organizations where id = $1",
        [orgA],
      );
      expect(orgs.rowCount).toBe(0);

      const projects = await client.query(
        "select id from public.projects where id = $1",
        [projectA],
      );
      expect(projects.rowCount).toBe(0);

      const plots = await client.query(
        "select id from public.plots where id = $1",
        [plotA],
      );
      expect(plots.rowCount).toBe(0);

      await expect(
        client.query("update public.plots set status = 'SOLD' where id = $1", [
          plotA,
        ]),
      ).resolves.toMatchObject({ rowCount: 0 }); // RLS silently filters, never errors into a leak

      await expect(
        client.query(
          "insert into public.org_members (org_id, user_id, role) values ($1, $2, 'org_admin')",
          [orgA, userB],
        ),
      ).rejects.toThrow(); // can't self-promote into another org
    });
  });

  it("lets a member of the org read its own data", async () => {
    await withRollback(pool, async (client) => {
      const userA = await createUser(client, "owner@example.com");
      const orgA = await createOrg(client, {
        name: "Org A",
        slug: "org-a2",
        adminUserId: userA,
      });
      const projectA = await createProject(client, orgA, {
        name: "A Project",
        slug: "a-project-2",
      });

      await asUser(client, userA);
      const { rowCount } = await client.query(
        "select id from public.projects where id = $1",
        [projectA],
      );
      expect(rowCount).toBe(1);
    });
  });

  it("anon has no direct table access; sensitive views also require a role", async () => {
    await withRollback(pool, async (client) => {
      const userA = await createUser(client, "owner2@example.com");
      const orgA = await createOrg(client, {
        name: "Org A",
        slug: "org-a3",
        adminUserId: userA,
      });
      const projectA = await createProject(client, orgA, {
        name: "P",
        slug: "a-project-3",
      });
      await createPlot(client, projectA, { plotNumber: "A-2" });

      await asAnon(client);
      await expect(
        client.query("select id from public.plots"),
      ).resolves.toMatchObject({ rowCount: 0 });
      await expectRejects(client, () =>
        client.query("select id from public.plots_public"),
      ); // no grant at all
      await expect(
        client.query("select id from public.leads"),
      ).resolves.toMatchObject({ rowCount: 0 });
    });
  });

  it("a viewer cannot write, only read", async () => {
    await withRollback(pool, async (client) => {
      const admin = await createUser(client, "admin@example.com");
      const viewer = await createUser(client, "viewer@example.com");
      const org = await createOrg(client, {
        name: "Org V",
        slug: "org-v",
        adminUserId: admin,
      });
      await addMember(client, org, viewer, "viewer");
      const project = await createProject(client, org, {
        name: "P",
        slug: "viewer-project",
      });
      const plot = await createPlot(client, project, { plotNumber: "V-1" });

      await asUser(client, viewer);
      const { rowCount } = await client.query(
        "select id from public.plots where id = $1",
        [plot],
      );
      expect(rowCount).toBe(1);

      await expect(
        client.query(
          "update public.plots set internal_notes = 'x' where id = $1",
          [plot],
        ),
      ).resolves.toMatchObject({ rowCount: 0 });

      await asOwner(client);
    });
  });
});
