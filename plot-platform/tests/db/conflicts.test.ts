import { afterAll, describe, expect, it } from "vitest";

import { asUser, newPool, withRollback } from "./client";
import {
  addMember,
  createOrg,
  createPlot,
  createProject,
  createUser,
} from "./fixtures";

// Product Contract rule 4: conflicts are surfaced, never silently resolved,
// and block "verified" status for that field until resolved.
describe("data conflicts", () => {
  const pool = newPool();
  afterAll(() => pool.end());

  it("recording a conflict un-verifies the field and blocks re-verifying it", async () => {
    await withRollback(pool, async (client) => {
      const org = await createOrg(client, { name: "Org C", slug: "org-c" });
      const manager = await createUser(client, "manager-c@example.com");
      await addMember(client, org, manager, "manager");
      const project = await createProject(client, org, {
        name: "P",
        slug: "c-project",
      });
      const plot = await createPlot(client, project, { plotNumber: "C-1" });

      await asUser(client, manager);
      await client.query(
        "update public.plots set verified_fields = array['area_official_value'] where id = $1",
        [plot],
      );

      const { rows: recorded } = await client.query(
        `select * from public.record_conflict($1, 'area_official_value',
           '[{"source":"admin","value":1200},{"source":"layout","value":1250}]'::jsonb, 'mismatch')`,
        [plot],
      );
      expect(recorded[0]!.status).toBe("open");

      const { rows: plotRows } = await client.query(
        "select verified_fields, area_conflict from public.plots where id = $1",
        [plot],
      );
      expect(plotRows[0]!.verified_fields).not.toContain("area_official_value");
      expect(plotRows[0]!.area_conflict).toBe(true);

      await expect(
        client.query(
          "update public.plots set verified_fields = array_append(verified_fields, 'area_official_value') where id = $1",
          [plot],
        ),
      ).rejects.toThrow(/FIELD_HAS_OPEN_CONFLICT/);
    });
  });

  it("resolving a conflict writes the value back and re-verifies the field", async () => {
    await withRollback(pool, async (client) => {
      const org = await createOrg(client, { name: "Org C2", slug: "org-c2" });
      const manager = await createUser(client, "manager-c2@example.com");
      await addMember(client, org, manager, "manager");
      const project = await createProject(client, org, {
        name: "P",
        slug: "c-project-2",
      });
      const plot = await createPlot(client, project, { plotNumber: "C-2" });

      await asUser(client, manager);
      const { rows: conflictRows } = await client.query(
        `select * from public.record_conflict($1, 'facing',
           '[{"source":"admin","value":"N"},{"source":"layout","value":"NE"}]'::jsonb)`,
        [plot],
      );
      const conflictId = conflictRows[0]!.id;

      await client.query(
        "select * from public.resolve_conflict($1, '\"NE\"'::jsonb, 'geometry wins')",
        [conflictId],
      );

      const { rows: plotRows } = await client.query(
        "select facing, verified_fields from public.plots where id = $1",
        [plot],
      );
      expect(plotRows[0]!.facing).toBe("NE");
      expect(plotRows[0]!.verified_fields).toContain("facing");

      const { rows: c } = await client.query(
        "select status, resolved_value from public.data_conflicts where id = $1",
        [conflictId],
      );
      expect(c[0]!.status).toBe("resolved");
    });
  });

  it("a sales user cannot record or resolve conflicts", async () => {
    await withRollback(pool, async (client) => {
      const org = await createOrg(client, { name: "Org C3", slug: "org-c3" });
      const sales = await createUser(client, "sales-c@example.com");
      await addMember(client, org, sales, "sales");
      const project = await createProject(client, org, {
        name: "P",
        slug: "c-project-3",
      });
      const { addProjectMember } = await import("./fixtures");
      await addProjectMember(client, project, sales);
      const plot = await createPlot(client, project, { plotNumber: "C-3" });

      await asUser(client, sales);
      await expect(
        client.query(
          'select * from public.record_conflict($1, \'facing\', \'[{"source":"x","value":"N"}]\'::jsonb)',
          [plot],
        ),
      ).rejects.toThrow(/NOT_ALLOWED/);
    });
  });
});
