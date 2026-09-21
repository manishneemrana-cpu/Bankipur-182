"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/server/auth";
import { hasPermission, type OrgRole } from "@/server/permissions";
import { withOrgTransaction, withSystemClient } from "@/server/db";
import { recordAuditLog } from "@/server/audit";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const ROLES = ["OWNER", "ADMIN", "MANAGER", "AGENT", "VIEWER"] as const;

const addSchema = z.object({
  organizationId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(ROLES),
});

/**
 * No email-sending infrastructure exists yet, so "inviting" someone only
 * works if they already have an account (they register first, then an
 * OWNER/ADMIN adds them here) — an honest scope limit rather than a fake
 * "invite sent" that goes nowhere.
 */
export async function addTeamMember(input: unknown): Promise<ActionResult> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { organizationId, email, role } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "manage_users")) {
    return { ok: false, error: "You don't have permission to manage the team" };
  }

  const userLookup = await withSystemClient((client) =>
    client.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email])
  );
  const targetUserId = userLookup.rows[0]?.id;
  if (!targetUserId) {
    return {
      ok: false,
      error: "No account found for that email yet. Ask them to register, then add them here.",
    };
  }

  try {
    await withOrgTransaction(organizationId, context.userId, (client) =>
      client.query(
        "INSERT INTO organization_members (organization_id, user_id, role, joined_at) VALUES ($1, $2, $3, now())",
        [organizationId, targetUserId, role]
      )
    );
  } catch (err) {
    if (err instanceof Error && /duplicate key/i.test(err.message)) {
      return { ok: false, error: "That person is already a member of this organization" };
    }
    throw err;
  }

  await recordAuditLog(organizationId, context.userId, "team.member_added", {
    targetType: "user",
    targetId: targetUserId,
    metadata: { email, role },
  });

  revalidatePath("/dashboard/team");
  return { ok: true };
}

const memberActionSchema = z.object({ organizationId: z.string().uuid(), memberUserId: z.string().uuid() });

async function countOwners(organizationId: string, userId: string): Promise<number> {
  const result = await withOrgTransaction(organizationId, userId, (client) =>
    client.query<{ count: string }>("SELECT count(*) FROM organization_members WHERE organization_id = $1 AND role = 'OWNER'", [
      organizationId,
    ])
  );
  return Number(result.rows[0]!.count);
}

export async function updateMemberRole(input: unknown): Promise<ActionResult> {
  const parsed = memberActionSchema.extend({ role: z.enum(ROLES) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { organizationId, memberUserId, role } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "manage_users")) {
    return { ok: false, error: "You don't have permission to manage the team" };
  }

  const currentRoleResult = await withOrgTransaction(organizationId, context.userId, (client) =>
    client.query<{ role: OrgRole }>("SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2", [
      organizationId,
      memberUserId,
    ])
  );
  const currentRole = currentRoleResult.rows[0]?.role;
  if (currentRole === "OWNER" && role !== "OWNER" && (await countOwners(organizationId, context.userId)) <= 1) {
    return { ok: false, error: "An organization must have at least one Owner" };
  }

  await withOrgTransaction(organizationId, context.userId, (client) =>
    client.query("UPDATE organization_members SET role = $1 WHERE organization_id = $2 AND user_id = $3", [
      role,
      organizationId,
      memberUserId,
    ])
  );

  await recordAuditLog(organizationId, context.userId, "team.role_changed", {
    targetType: "user",
    targetId: memberUserId,
    metadata: { previousRole: currentRole ?? null, newRole: role },
  });

  revalidatePath("/dashboard/team");
  return { ok: true };
}

export async function removeMember(input: unknown): Promise<ActionResult> {
  const parsed = memberActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { organizationId, memberUserId } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "manage_users")) {
    return { ok: false, error: "You don't have permission to manage the team" };
  }

  const targetRoleResult = await withOrgTransaction(organizationId, context.userId, (client) =>
    client.query<{ role: OrgRole }>("SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2", [
      organizationId,
      memberUserId,
    ])
  );
  if (targetRoleResult.rows[0]?.role === "OWNER" && (await countOwners(organizationId, context.userId)) <= 1) {
    return { ok: false, error: "An organization must have at least one Owner" };
  }

  await withOrgTransaction(organizationId, context.userId, (client) =>
    client.query("DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2", [
      organizationId,
      memberUserId,
    ])
  );

  await recordAuditLog(organizationId, context.userId, "team.member_removed", {
    targetType: "user",
    targetId: memberUserId,
  });

  revalidatePath("/dashboard/team");
  return { ok: true };
}
