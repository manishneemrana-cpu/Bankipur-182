import type pg from "pg";
import { afterAll, describe, expect, it } from "vitest";

import {
  asAnon,
  asOwner,
  asUser,
  expectRejects,
  newPool,
  withRollback,
} from "./client";
import { createOrg, createProject, createUser } from "./fixtures";

async function setFreePlan(client: pg.PoolClient, orgId: string) {
  await client.query(
    "update public.organizations set plan_id = (select id from public.plans where code = 'free') where id = $1",
    [orgId],
  );
}

describe("analytics & billing (Phase 9)", () => {
  const pool = newPool();
  afterAll(() => pool.end());

  it("new orgs start on the Free plan with a subscription row", async () => {
    await withRollback(pool, async (client) => {
      const admin = await createUser(client, "planowner@example.com");
      await asUser(client, admin);
      const { rows } = await client.query<{ create_organization: string }>(
        "select public.create_organization('Plan Co', 'plan-co')",
      );
      const orgId = rows[0]!.create_organization;

      await asOwner(client);
      const { rows: orgRows } = await client.query(
        "select o.id, p.code from public.organizations o join public.plans p on p.id = o.plan_id where o.id = $1",
        [orgId],
      );
      expect(orgRows[0].code).toBe("free");

      const { rows: subRows } = await client.query(
        "select status from public.subscriptions where org_id = $1",
        [orgId],
      );
      expect(subRows).toHaveLength(1);
      expect(subRows[0].status).toBe("active");
    });
  });

  it("blocks creating a project beyond the plan's project limit", async () => {
    await withRollback(pool, async (client) => {
      const admin = await createUser(client, "limitowner@example.com");
      const org = await createOrg(client, {
        name: "Limit Org",
        slug: "limit-org",
        adminUserId: admin,
      });
      await setFreePlan(client, org);
      await createProject(client, org, { name: "P1", slug: "limit-p1" });

      await asUser(client, admin);
      await expectRejects(
        client,
        () =>
          client.query(
            "insert into public.projects (org_id, name, slug) values ($1, 'P2', 'limit-p2')",
            [org],
          ),
        /PLAN_LIMIT_PROJECTS/,
      );
    });
  });

  it("blocks creating a plot beyond the plan's plot limit", async () => {
    await withRollback(pool, async (client) => {
      const admin = await createUser(client, "plotlimitowner@example.com");
      const org = await createOrg(client, {
        name: "Plot Limit Org",
        slug: "plot-limit-org",
        adminUserId: admin,
      });
      await setFreePlan(client, org);
      const project = await createProject(client, org, {
        name: "P",
        slug: "plot-limit-project",
      });
      await client.query(
        `update public.plans set limits = jsonb_set(limits, '{plots}', '1'::jsonb)
         where id = (select plan_id from public.organizations where id = $1)`,
        [org],
      );
      await client.query(
        "insert into public.plots (project_id, plot_number) values ($1, 'PL-1')",
        [project],
      );

      await asUser(client, admin);
      await expectRejects(
        client,
        () =>
          client.query(
            "insert into public.plots (project_id, plot_number) values ($1, 'PL-2')",
            [project],
          ),
        /PLAN_LIMIT_PLOTS/,
      );
    });
  });

  it("reserve_usage gates at the plan limit and blocks the next call", async () => {
    await withRollback(pool, async (client) => {
      const admin = await createUser(client, "usageowner@example.com");
      const org = await createOrg(client, {
        name: "Usage Org",
        slug: "usage-org",
        adminUserId: admin,
      });
      await setFreePlan(client, org);

      // Free plan allows 200 AI messages/month; exhaust it down to the edge
      // by inserting the counter directly rather than looping 200 calls.
      await client.query(
        `insert into public.usage_counters (org_id, period, metric, value)
         values ($1, app.current_period(), 'ai_messages', 199)`,
        [org],
      );

      const { rows: first } = await client.query<{ reserve_usage: boolean }>(
        "select app.reserve_usage($1, 'ai_messages', 'ai_messages_per_month')",
        [org],
      );
      expect(first[0]!.reserve_usage).toBe(true);

      const { rows: second } = await client.query<{ reserve_usage: boolean }>(
        "select app.reserve_usage($1, 'ai_messages', 'ai_messages_per_month')",
        [org],
      );
      expect(second[0]!.reserve_usage).toBe(false);
    });
  });

  it("track_event and log_ai_turn work anonymously and reconcile with what was recorded", async () => {
    await withRollback(pool, async (client) => {
      const admin = await createUser(client, "trackowner@example.com");
      const org = await createOrg(client, {
        name: "Track Org",
        slug: "track-org",
        adminUserId: admin,
      });
      const project = await createProject(client, org, {
        name: "Track Project",
        slug: "track-project",
      });

      await asAnon(client);
      await client.query(
        "select public.track_event('track-project', null, 'sess-1', 'project_view', null, null, '{}'::jsonb)",
      );
      await client.query(
        "select public.track_event('track-project', null, 'sess-1', 'cta_whatsapp', null, null, '{}'::jsonb)",
      );
      await client.query(
        "select public.log_ai_turn('track-project', null, 'sess-1', 'en', 'Hi', 'Hello!', '[]'::jsonb, false)",
      );

      await asOwner(client);
      const { rows: events } = await client.query(
        "select event from public.analytics_events where project_id = $1 order by created_at",
        [project],
      );
      expect(events.map((e: { event: string }) => e.event)).toEqual([
        "project_view",
        "cta_whatsapp",
      ]);

      const { rows: messages } = await client.query(
        "select role, content from public.ai_messages where project_id = $1 order by created_at",
        [project],
      );
      expect(messages).toEqual([
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello!" },
      ]);
    });
  });

  it("track_event rejects for a project that isn't publicly accessible", async () => {
    await withRollback(pool, async (client) => {
      const admin = await createUser(client, "draftowner@example.com");
      const org = await createOrg(client, {
        name: "Draft Org",
        slug: "draft-org",
        adminUserId: admin,
      });
      const project = await createProject(client, org, {
        name: "Draft Project",
        slug: "draft-project",
      });
      await client.query(
        "update public.projects set status = 'draft' where id = $1",
        [project],
      );

      await asAnon(client);
      await expectRejects(
        client,
        () =>
          client.query(
            "select public.track_event('draft-project', null, 'sess-2', 'project_view', null, null, '{}'::jsonb)",
          ),
        /NOT_FOUND/,
      );
    });
  });
});
