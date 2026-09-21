import "server-only";
import { withUserTransaction } from "./db";
import type { OrgRole } from "./permissions";

export interface UserOrganizationSummary {
  organizationId: string;
  organizationName: string;
  brandName: string | null;
  role: OrgRole;
}

/**
 * Lists every organization a user belongs to. Scoped by app.user_id (set from
 * the authenticated session, never a client-supplied id) — see the
 * `organization_members` SELECT policy in migrations/0002_membership_self_lookup.sql
 * for why a plain unscoped query would return zero rows under real RLS.
 */
export async function getUserOrganizations(userId: string): Promise<UserOrganizationSummary[]> {
  return withUserTransaction(userId, async (client) => {
    const result = await client.query<{
      organization_id: string;
      organization_name: string;
      brand_name: string | null;
      role: OrgRole;
    }>(
      `SELECT o.id AS organization_id, o.name AS organization_name, o.brand_name, m.role
       FROM organization_members m
       JOIN organizations o ON o.id = m.organization_id
       WHERE m.user_id = $1
       ORDER BY m.joined_at NULLS LAST, m.invited_at`,
      [userId]
    );
    return result.rows.map((row) => ({
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      brandName: row.brand_name,
      role: row.role,
    }));
  });
}

/** The first organization a user joined. Used to pick a default when no org is selected yet. */
export async function getPrimaryOrganization(userId: string): Promise<UserOrganizationSummary | null> {
  const orgs = await getUserOrganizations(userId);
  return orgs[0] ?? null;
}
