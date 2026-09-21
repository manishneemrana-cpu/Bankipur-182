import "server-only";
import type { PoolClient } from "pg";
import { withOrgTransaction, withPlatformAdminTransaction } from "@/server/db";

/**
 * Records one audit log entry. Always called from inside an action that
 * already has an organization_id and userId from requireOrgContext() — this
 * never resolves either from client input. Pass `client` to append to an
 * existing withOrgTransaction() rather than opening a second connection.
 */
export async function recordAuditLog(
  organizationId: string,
  actorUserId: string,
  action: string,
  options: { targetType?: string; targetId?: string; metadata?: Record<string, unknown>; client?: PoolClient } = {}
): Promise<void> {
  const insert = (client: PoolClient) =>
    client.query(
      `INSERT INTO audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        organizationId,
        actorUserId,
        action,
        options.targetType ?? null,
        options.targetId ?? null,
        JSON.stringify(options.metadata ?? {}),
      ]
    );

  if (options.client) {
    await insert(options.client);
  } else {
    await withOrgTransaction(organizationId, actorUserId, insert);
  }
}

export interface AuditLogEntry {
  id: string;
  organizationId: string | null;
  actorUserId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export async function listAuditLogsForOrganization(organizationId: string, limit = 100): Promise<AuditLogEntry[]> {
  return withOrgTransaction(organizationId, async (client) => {
    const result = await client.query(
      "SELECT id, organization_id, actor_user_id, action, target_type, target_id, metadata, created_at FROM audit_logs WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2",
      [organizationId, limit]
    );
    return result.rows.map(mapRow);
  });
}

/** Platform admin view across every organization. Caller must have already verified is_platform_admin. */
export async function listAuditLogsForAdmin(limit = 200): Promise<Array<AuditLogEntry & { organizationName: string | null }>> {
  return withPlatformAdminTransaction(async (client) => {
    const result = await client.query(
      `SELECT a.id, a.organization_id, a.actor_user_id, a.action, a.target_type, a.target_id, a.metadata, a.created_at,
              o.name AS organization_name
       FROM audit_logs a
       LEFT JOIN organizations o ON o.id = a.organization_id
       ORDER BY a.created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows.map((r) => ({ ...mapRow(r), organizationName: r.organization_name }));
  });
}

function mapRow(r: {
  id: string;
  organization_id: string | null;
  actor_user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}): AuditLogEntry {
  return {
    id: r.id,
    organizationId: r.organization_id,
    actorUserId: r.actor_user_id,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    metadata: r.metadata,
    createdAt: r.created_at,
  };
}
