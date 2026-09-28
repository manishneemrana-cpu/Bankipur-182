import { afterAll, describe, expect, it } from "vitest";

import {
  asAnon,
  asOwner,
  asUser,
  expectRejects,
  newPool,
  withRollback,
} from "./client";
import { createOrg, createPlot, createProject, createUser } from "./fixtures";

describe("layout ingestion: storage RLS + publish_layout_version", () => {
  const pool = newPool();
  afterAll(() => pool.end());

  it("only project members can read/write layout files in storage", async () => {
    await withRollback(pool, async (client) => {
      const admin = await createUser(client, "admin@example.com");
      const outsider = await createUser(client, "outsider@example.com");
      const org = await createOrg(client, {
        name: "Org L",
        slug: "org-l",
        adminUserId: admin,
      });
      const project = await createProject(client, org, {
        name: "P",
        slug: "layout-project",
      });
      await asUser(client, admin);
      await client.query(
        "insert into storage.objects (bucket_id, name) values ('project-files', $1)",
        [`${project}/layout.pdf`],
      );

      await asUser(client, outsider);
      await expectRejects(client, () =>
        client.query(
          "insert into storage.objects (bucket_id, name) values ('project-files', $1)",
          [`${project}/other.pdf`],
        ),
      );
      const { rows: outsiderRows } = await client.query(
        "select 1 from storage.objects where bucket_id = 'project-files' and name = $1",
        [`${project}/layout.pdf`],
      );
      expect(outsiderRows).toHaveLength(0);

      await asAnon(client);
      const { rows: anonRows } = await client.query(
        "select 1 from storage.objects where bucket_id = 'project-files'",
      );
      expect(anonRows).toHaveLength(0);
    });
  });

  it("publish_layout_version requires at least one traced plot", async () => {
    await withRollback(pool, async (client) => {
      const admin = await createUser(client, "admin2@example.com");
      const org = await createOrg(client, {
        name: "Org M",
        slug: "org-m",
        adminUserId: admin,
      });
      const project = await createProject(client, org, {
        name: "P",
        slug: "empty-layout-project",
      });
      const { rows } = await client.query<{ id: string }>(
        "insert into public.layout_versions (project_id, version_no) values ($1, 1) returning id",
        [project],
      );
      const layoutVersionId = rows[0]!.id;

      await asUser(client, admin);
      await expectRejects(
        client,
        () =>
          client.query("select * from public.publish_layout_version($1)", [
            layoutVersionId,
          ]),
        /NOTHING_TRACED/,
      );
    });
  });

  it("publish_layout_version blocks on an open conflict for a traced plot", async () => {
    await withRollback(pool, async (client) => {
      const admin = await createUser(client, "admin3@example.com");
      const org = await createOrg(client, {
        name: "Org N",
        slug: "org-n",
        adminUserId: admin,
      });
      const project = await createProject(client, org, {
        name: "P",
        slug: "conflict-layout-project",
      });
      const { rows: lvRows } = await client.query<{ id: string }>(
        "insert into public.layout_versions (project_id, version_no) values ($1, 1) returning id",
        [project],
      );
      const layoutVersionId = lvRows[0]!.id;
      const plotId = await createPlot(client, project, { plotNumber: "L-1" });
      await client.query(
        "update public.plots set layout_version_id = $1 where id = $2",
        [layoutVersionId, plotId],
      );

      await asUser(client, admin);
      await client.query(
        "select public.record_conflict($1, 'area_official_value', $2::jsonb)",
        [plotId, JSON.stringify([1000, 1100])],
      );
      await expectRejects(
        client,
        () =>
          client.query("select * from public.publish_layout_version($1)", [
            layoutVersionId,
          ]),
        /OPEN_CONFLICTS/,
      );
    });
  });

  it("publish_layout_version supersedes the previously published version", async () => {
    await withRollback(pool, async (client) => {
      const admin = await createUser(client, "admin4@example.com");
      const org = await createOrg(client, {
        name: "Org O",
        slug: "org-o",
        adminUserId: admin,
      });
      const project = await createProject(client, org, {
        name: "P",
        slug: "supersede-layout-project",
      });

      const { rows: lv1Rows } = await client.query<{ id: string }>(
        "insert into public.layout_versions (project_id, version_no, status) values ($1, 1, 'published') returning id",
        [project],
      );
      const lv1 = lv1Rows[0]!.id;
      await createPlot(client, project, { plotNumber: "S-1" }).then((id) =>
        client.query(
          "update public.plots set layout_version_id = $1 where id = $2",
          [lv1, id],
        ),
      );

      const { rows: lv2Rows } = await client.query<{ id: string }>(
        "insert into public.layout_versions (project_id, version_no) values ($1, 2) returning id",
        [project],
      );
      const lv2 = lv2Rows[0]!.id;
      const plot2 = await createPlot(client, project, { plotNumber: "S-2" });
      await client.query(
        "update public.plots set layout_version_id = $1 where id = $2",
        [lv2, plot2],
      );

      await asUser(client, admin);
      const { rows: published } = await client.query(
        "select * from public.publish_layout_version($1)",
        [lv2],
      );
      expect(published[0].status).toBe("published");

      await asOwner(client);
      const { rows: statuses } = await client.query(
        "select id, status from public.layout_versions where project_id = $1 order by version_no",
        [project],
      );
      expect(statuses).toEqual([
        { id: lv1, status: "superseded" },
        { id: lv2, status: "published" },
      ]);
    });
  });
});
