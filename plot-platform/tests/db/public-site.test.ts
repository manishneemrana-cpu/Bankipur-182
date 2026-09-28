import { afterAll, describe, expect, it } from "vitest";

import {
  asAnon,
  asOwner,
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

describe("public site (Phase 3): anonymous reads through get_public_site_data", () => {
  const pool = newPool();
  afterAll(() => pool.end());

  it("returns a published public project's data to anon, prices included when public", async () => {
    await withRollback(pool, async (client) => {
      const org = await createOrg(client, { name: "Org PS", slug: "org-ps" });
      const project = await createProject(client, org, {
        name: "P",
        slug: "pub-project-1",
      });
      await client.query(
        "update public.projects set status = 'published' where id = $1",
        [project],
      );
      await createPlot(client, project, {
        plotNumber: "PS-1",
        priceTotal: 2_000_000,
      });

      await asAnon(client);
      const { rows } = await client.query(
        "select public.get_public_site_data($1) as data",
        ["pub-project-1"],
      );
      const data = rows[0]!.data;
      expect(data.project.name).toBe("P");
      expect(data.plots).toHaveLength(1);
      expect(Number(data.plots[0].price_total)).toBe(2_000_000);
    });
  });

  it("nulls prices when the project is on_request even for a public plot", async () => {
    await withRollback(pool, async (client) => {
      const org = await createOrg(client, { name: "Org PS2", slug: "org-ps2" });
      const project = await createProject(client, org, {
        name: "P",
        slug: "pub-project-2",
        priceVisibility: "on_request",
      });
      await client.query(
        "update public.projects set status = 'published' where id = $1",
        [project],
      );
      await createPlot(client, project, {
        plotNumber: "PS-2",
        priceTotal: 2_000_000,
      });

      await asAnon(client);
      const { rows } = await client.query(
        "select public.get_public_site_data($1) as data",
        ["pub-project-2"],
      );
      expect(rows[0]!.data.plots[0].price_total).toBeNull();
      expect(rows[0]!.data.plots[0].price_visibility).toBe("on_request");
    });
  });

  it("hides a draft (unpublished) project — rule 5, not even to anon", async () => {
    await withRollback(pool, async (client) => {
      const org = await createOrg(client, { name: "Org PS3", slug: "org-ps3" });
      const project = await createProject(client, org, {
        name: "P",
        slug: "pub-project-3",
      });
      await client.query(
        "update public.projects set status = 'draft' where id = $1",
        [project],
      );

      await asAnon(client);
      await expectRejects(
        client,
        () =>
          client.query("select public.get_public_site_data($1)", [
            "pub-project-3",
          ]),
        /NOT_FOUND/,
      );
    });
  });

  it("hides an internal-only plot (public_visibility = false)", async () => {
    await withRollback(pool, async (client) => {
      const org = await createOrg(client, { name: "Org PS4", slug: "org-ps4" });
      const project = await createProject(client, org, {
        name: "P",
        slug: "pub-project-4",
      });
      await client.query(
        "update public.projects set status = 'published' where id = $1",
        [project],
      );
      await createPlot(client, project, { plotNumber: "PS-4a" });
      const hidden = await createPlot(client, project, { plotNumber: "PS-4b" });
      await client.query(
        "update public.plots set public_visibility = false where id = $1",
        [hidden],
      );

      await asAnon(client);
      const { rows } = await client.query(
        "select public.get_public_site_data($1) as data",
        ["pub-project-4"],
      );
      expect(rows[0]!.data.plots).toHaveLength(1);
      expect(rows[0]!.data.plots[0].plot_number).toBe("PS-4a");
    });
  });

  it("blocks a disabled link even when published and public", async () => {
    await withRollback(pool, async (client) => {
      const org = await createOrg(client, { name: "Org PS5", slug: "org-ps5" });
      const project = await createProject(client, org, {
        name: "P",
        slug: "pub-project-5",
      });
      await client.query(
        "update public.projects set status = 'published', link_disabled = true where id = $1",
        [project],
      );

      await asAnon(client);
      await expectRejects(
        client,
        () =>
          client.query("select public.get_public_site_data($1)", [
            "pub-project-5",
          ]),
        /LINK_DISABLED/,
      );
    });
  });

  it("blocks an expired link", async () => {
    await withRollback(pool, async (client) => {
      const org = await createOrg(client, { name: "Org PS6", slug: "org-ps6" });
      const project = await createProject(client, org, {
        name: "P",
        slug: "pub-project-6",
      });
      await client.query(
        "update public.projects set status = 'published', link_expires_at = now() - interval '1 day' where id = $1",
        [project],
      );

      await asAnon(client);
      await expectRejects(
        client,
        () =>
          client.query("select public.get_public_site_data($1)", [
            "pub-project-6",
          ]),
        /LINK_EXPIRED/,
      );
    });
  });
});

describe("password-protected projects (test 18)", () => {
  const pool = newPool();
  afterAll(() => pool.end());

  it("blocks without a password, allows with the correct one", async () => {
    await withRollback(pool, async (client) => {
      const admin = await createUser(client, "pw-admin@example.com");
      const org = await createOrg(client, {
        name: "Org PW",
        slug: "org-pw",
        adminUserId: admin,
      });
      const project = await createProject(client, org, {
        name: "P",
        slug: "pw-project",
      });
      await client.query(
        "update public.projects set status = 'published', visibility = 'password' where id = $1",
        [project],
      );

      await asAnon(client);
      await expectRejects(
        client,
        () =>
          client.query("select public.get_public_site_data($1)", [
            "pw-project",
          ]),
        /PASSWORD_REQUIRED/,
      );
      // A misconfigured project (visibility=password, no hash set yet) also
      // reads as PASSWORD_REQUIRED — never falls open.
      await expectRejects(
        client,
        () =>
          client.query("select public.get_public_site_data($1, $2)", [
            "pw-project",
            "whatever",
          ]),
        /PASSWORD_REQUIRED/,
      );

      await asUserFix(client, admin);
      await client.query(
        "select public.set_project_password($1, 'letmein123')",
        [project],
      );

      await asAnon(client);
      const wrong = await client.query(
        "select public.verify_project_password($1, $2) as ok",
        ["pw-project", "nope"],
      );
      expect(wrong.rows[0]!.ok).toBe(false);

      const right = await client.query(
        "select public.verify_project_password($1, $2) as ok",
        ["pw-project", "letmein123"],
      );
      expect(right.rows[0]!.ok).toBe(true);

      const { rows } = await client.query(
        "select public.get_public_site_data($1, $2) as data",
        ["pw-project", "letmein123"],
      );
      expect(rows[0]!.data.project.slug).toBe("pw-project");
    });
  });

  it("only org_admin/manager can set a project's password", async () => {
    await withRollback(pool, async (client) => {
      const sales = await createUser(client, "pw-sales@example.com");
      const org = await createOrg(client, { name: "Org PW2", slug: "org-pw2" });
      await addMember(client, org, sales, "sales");
      const project = await createProject(client, org, {
        name: "P",
        slug: "pw-project-2",
      });
      const { addProjectMember } = await import("./fixtures");
      await addProjectMember(client, project, sales);

      await asUserFix(client, sales);
      await expectRejects(
        client,
        () =>
          client.query("select public.set_project_password($1, 'letmein123')", [
            project,
          ]),
        /NOT_ALLOWED/,
      );
    });
  });
});

describe("public lead capture (submit_public_lead)", () => {
  const pool = newPool();
  afterAll(() => pool.end());

  it("creates a lead and attributes it to a share link, incrementing clicks", async () => {
    await withRollback(pool, async (client) => {
      const org = await createOrg(client, { name: "Org LC", slug: "org-lc" });
      const project = await createProject(client, org, {
        name: "P",
        slug: "lc-project",
      });
      await client.query(
        "update public.projects set status = 'published' where id = $1",
        [project],
      );
      await createPlot(client, project, { plotNumber: "LC-1" });
      await client.query(
        "insert into public.share_links (project_id, code, kind) values ($1, 'ref1', 'campaign')",
        [project],
      );

      await asAnon(client);
      const { rows } = await client.query(
        `select public.submit_public_lead($1, null, 'Buyer', '+919876543210', 'b@example.com',
           'Interested', array['LC-1'], 'form', 'ref1', true) as id`,
        ["lc-project"],
      );
      expect(rows[0]!.id).toBeTruthy();

      await asOwner(client);
      const { rows: clicks } = await client.query(
        "select clicks from public.share_links where code = 'ref1'",
      );
      expect(clicks[0]!.clicks).toBe(1);
    });
  });

  it("rejects a lead without consent", async () => {
    await withRollback(pool, async (client) => {
      const org = await createOrg(client, { name: "Org LC2", slug: "org-lc2" });
      const project = await createProject(client, org, {
        name: "P",
        slug: "lc-project-2",
      });
      await client.query(
        "update public.projects set status = 'published' where id = $1",
        [project],
      );

      await asAnon(client);
      await expectRejects(
        client,
        () =>
          client.query(
            `select public.submit_public_lead($1, null, 'Buyer', '+919876543210', null, null, '{}', 'form', null, false)`,
            ["lc-project-2"],
          ),
        /CONSENT_REQUIRED/,
      );
    });
  });
});

// Local re-export to avoid a name clash with the imported `asAnon`.
async function asUserFix(client: Parameters<typeof asAnon>[0], userId: string) {
  const { asUser } = await import("./client");
  return asUser(client, userId);
}
