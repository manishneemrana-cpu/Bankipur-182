import { randomUUID } from "node:crypto";

import type pg from "pg";

/** Creates an auth user + profile (mirrors the Supabase signup trigger). */
export async function createUser(
  client: pg.PoolClient,
  email: string,
): Promise<string> {
  const id = randomUUID();
  await client.query("insert into auth.users (id, email) values ($1, $2)", [
    id,
    email,
  ]);
  return id;
}

export async function createOrg(
  client: pg.PoolClient,
  opts: { name: string; slug: string; adminUserId?: string },
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    "insert into public.organizations (name, slug) values ($1, $2) returning id",
    [opts.name, opts.slug],
  );
  const orgId = rows[0]!.id;
  if (opts.adminUserId) {
    await client.query(
      "insert into public.org_members (org_id, user_id, role) values ($1, $2, 'org_admin')",
      [orgId, opts.adminUserId],
    );
  }
  return orgId;
}

export async function addMember(
  client: pg.PoolClient,
  orgId: string,
  userId: string,
  role: string,
): Promise<void> {
  await client.query(
    "insert into public.org_members (org_id, user_id, role) values ($1, $2, $3)",
    [orgId, userId, role],
  );
}

export async function createProject(
  client: pg.PoolClient,
  orgId: string,
  opts: { name: string; slug: string; priceVisibility?: string },
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `insert into public.projects (org_id, name, slug, status, price_visibility)
     values ($1, $2, $3, 'published', coalesce($4, 'public')) returning id`,
    [orgId, opts.name, opts.slug, opts.priceVisibility ?? null],
  );
  return rows[0]!.id;
}

export async function createPlot(
  client: pg.PoolClient,
  projectId: string,
  opts: Partial<{
    plotNumber: string;
    status: string;
    priceTotal: number;
    priceVisibility: string;
    publicVisibility: boolean;
  }> = {},
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `insert into public.plots (project_id, plot_number, status, price_total, price_visibility, public_visibility)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [
      projectId,
      opts.plotNumber ?? `P-${randomUUID().slice(0, 4)}`,
      opts.status ?? "AVAILABLE",
      opts.priceTotal ?? 1_000_000,
      opts.priceVisibility ?? "public",
      opts.publicVisibility ?? true,
    ],
  );
  return rows[0]!.id;
}

export async function addProjectMember(
  client: pg.PoolClient,
  projectId: string,
  userId: string,
): Promise<void> {
  await client.query(
    "insert into public.project_members (project_id, user_id) values ($1, $2)",
    [projectId, userId],
  );
}
