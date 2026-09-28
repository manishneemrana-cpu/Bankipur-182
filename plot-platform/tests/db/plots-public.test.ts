import { afterAll, describe, expect, it } from "vitest";

import { asUser, newPool, withRollback } from "./client";
import {
  addMember,
  createOrg,
  createPlot,
  createProject,
  createUser,
} from "./fixtures";

// §5.1 price_visibility + rule 8: internal price fields never leak through
// the buyer-safe view unless both project and plot opt into public pricing.
describe("plots_public view", () => {
  const pool = newPool();
  afterAll(() => pool.end());

  it("hides price when the project is on_request, even if the plot is public", async () => {
    await withRollback(pool, async (client) => {
      const org = await createOrg(client, { name: "Org P", slug: "org-p" });
      const viewer = await createUser(client, "v@example.com");
      await addMember(client, org, viewer, "viewer");
      const project = await createProject(client, org, {
        name: "P",
        slug: "price-project",
        priceVisibility: "on_request",
      });
      const plot = await createPlot(client, project, {
        plotNumber: "PP-1",
        priceTotal: 5_000_000,
        priceVisibility: "public",
      });

      await asUser(client, viewer);
      const { rows } = await client.query(
        "select price_total, price_visibility from public.plots_public where id = $1",
        [plot],
      );
      expect(rows[0]!.price_total).toBeNull();
      expect(rows[0]!.price_visibility).toBe("on_request");
    });
  });

  it("shows price only when both project and plot are public", async () => {
    await withRollback(pool, async (client) => {
      const org = await createOrg(client, { name: "Org P2", slug: "org-p2" });
      const viewer = await createUser(client, "v2@example.com");
      await addMember(client, org, viewer, "viewer");
      const project = await createProject(client, org, {
        name: "P",
        slug: "price-project-2",
      });
      const plot = await createPlot(client, project, {
        plotNumber: "PP-2",
        priceTotal: 3_000_000,
      });

      await asUser(client, viewer);
      const { rows } = await client.query(
        "select price_total from public.plots_public where id = $1",
        [plot],
      );
      expect(Number(rows[0]!.price_total)).toBe(3_000_000);
    });
  });

  it("never exposes internal_notes or internal_price", async () => {
    await withRollback(pool, async (client) => {
      const org = await createOrg(client, { name: "Org P3", slug: "org-p3" });
      const cols = await client.query(
        `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = 'plots_public'`,
      );
      const names = cols.rows.map((r) => r.column_name);
      expect(names).not.toContain("internal_notes");
      expect(names).not.toContain("internal_price");
      void org;
    });
  });
});
