import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { withOrgTransaction, withPlatformAdminTransaction } from "@/server/db";

const KEY_PREFIX_LENGTH = 8;

export interface CreatedApiKey {
  id: string;
  /** Shown to the user exactly once — never retrievable again. */
  rawKey: string;
  prefix: string;
}

function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey, "utf8").digest("hex");
}

export async function createApiKey(
  organizationId: string,
  userId: string,
  name: string,
  scopes: string[]
): Promise<CreatedApiKey> {
  const rawKey = `wap_${randomBytes(24).toString("hex")}`;
  const prefix = rawKey.slice(0, KEY_PREFIX_LENGTH);
  const keyHash = hashKey(rawKey);

  const result = await withOrgTransaction(organizationId, userId, (client) =>
    client.query<{ id: string }>(
      `INSERT INTO api_keys (organization_id, name, key_hash, key_prefix, scopes)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [organizationId, name, keyHash, prefix, scopes]
    )
  );

  return { id: result.rows[0]!.id, rawKey, prefix };
}

export interface AuthenticatedApiKey {
  organizationId: string;
  scopes: string[];
  apiKeyId: string;
}

/**
 * Authenticates a raw API key from an Authorization header. Resolves the
 * organization from the key itself (like webhook processing, this runs
 * before any organization_id is otherwise known), never from a
 * client-supplied organization id — there isn't one in this request at all.
 */
export async function authenticateApiKey(rawKey: string): Promise<AuthenticatedApiKey | null> {
  const keyHash = hashKey(rawKey);

  return withPlatformAdminTransaction(async (client) => {
    const result = await client.query<{ id: string; organization_id: string; scopes: string[] }>(
      `SELECT id, organization_id, scopes FROM api_keys
       WHERE key_hash = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`,
      [keyHash]
    );
    const row = result.rows[0];
    if (!row) return null;

    await client.query("UPDATE api_keys SET last_used_at = now() WHERE id = $1", [row.id]);
    return { organizationId: row.organization_id, scopes: row.scopes, apiKeyId: row.id };
  });
}

export function hasScope(authenticated: AuthenticatedApiKey, scope: string): boolean {
  return authenticated.scopes.includes(scope);
}
