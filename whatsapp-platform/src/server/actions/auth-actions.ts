"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { withSystemClient, withPlatformAdminTransaction } from "@/server/db";
import { createSessionCookie, clearSessionCookie, hashPassword, verifyPassword } from "@/server/auth";

const registerSchema = z.object({
  organizationName: z.string().min(2).max(200),
  email: z.string().email(),
  password: z.string().min(10, "Password must be at least 10 characters"),
  fullName: z.string().min(1).max(200),
});

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/** Creates the first organization + OWNER user together (founder / first tenant signup). */
export async function registerOrganization(input: unknown): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { organizationName, email, password, fullName } = parsed.data;

  const existing = await withSystemClient((client) =>
    client.query("SELECT id FROM users WHERE email = $1", [email])
  );
  if (existing.rows.length > 0) {
    return { ok: false, error: "An account with this email already exists" };
  }

  const passwordHash = await hashPassword(password);

  // Creating a brand-new organization has no tenant context yet (the org
  // doesn't exist until this transaction commits), so it runs as a
  // platform-admin transaction rather than one scoped to an organization_id —
  // see the `organizations` and `organization_members` RLS policies in
  // migrations/0001_init.sql, which otherwise reject an insert with no
  // matching app.org_id set.
  const { userId } = await withPlatformAdminTransaction(async (client) => {
    const userRes = await client.query<{ id: string }>(
      "INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id",
      [email, passwordHash, fullName]
    );
    const userId = userRes.rows[0]!.id;

    // Starter is the default plan for a brand-new organization. `plans` has
    // no RLS (it's a global platform table, not tenant-scoped — see
    // docs/decisions.md), so this read works inside the same transaction.
    const planRes = await client.query<{ id: string }>("SELECT id FROM plans WHERE name = 'Starter'");
    const starterPlanId = planRes.rows[0]?.id ?? null;

    const orgRes = await client.query<{ id: string }>(
      "INSERT INTO organizations (name, brand_name, plan_id) VALUES ($1, $2, $3) RETURNING id",
      [organizationName, organizationName, starterPlanId]
    );
    const organizationId = orgRes.rows[0]!.id;

    await client.query(
      "INSERT INTO organization_members (organization_id, user_id, role, joined_at) VALUES ($1, $2, 'OWNER', now())",
      [organizationId, userId]
    );

    if (starterPlanId) {
      await client.query(
        "INSERT INTO subscriptions (organization_id, plan_id, status, current_period_start, current_period_end) VALUES ($1, $2, 'ACTIVE', now(), now() + interval '30 days')",
        [organizationId, starterPlanId]
      );
    }

    return { userId };
  });

  await createSessionCookie(userId);
  return { ok: true };
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function login(input: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid email or password" };
  }
  const { email, password } = parsed.data;

  return withSystemClient(async (client) => {
    const result = await client.query<{ id: string; password_hash: string }>(
      "SELECT id, password_hash FROM users WHERE email = $1",
      [email]
    );
    const user = result.rows[0];
    // Constant-shape response whether or not the user exists, to avoid leaking which emails are registered.
    const validPassword = user ? await verifyPassword(password, user.password_hash) : false;
    if (!user || !validPassword) {
      return { ok: false, error: "Invalid email or password" };
    }
    await createSessionCookie(user.id);
    return { ok: true };
  });
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
}

export async function logoutAndRedirect(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
