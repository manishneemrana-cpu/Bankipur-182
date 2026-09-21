import "server-only";
import { Pool, type PoolClient } from "pg";
import { getEnv } from "./env";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: getEnv().DATABASE_URL, max: 10 });
  }
  return pool;
}

/**
 * Runs `fn` inside a transaction with Postgres RLS scoped to `organizationId`.
 * organizationId must already be resolved server-side from the authenticated
 * session — never accept it as a raw parameter from request input.
 */
export async function withOrgTransaction<T>(
  organizationId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // set_config with is_local=true scopes this to the current transaction only,
    // so it can never leak across pooled connections between requests.
    await client.query("SELECT set_config('app.org_id', $1, true)", [organizationId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Platform-admin transaction: bypasses per-organization scoping for the
 * `organizations` and `webhook_events` policies that explicitly allow it.
 * Only call this after verifying `users.is_platform_admin` server-side.
 */
export async function withPlatformAdminTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.is_platform_admin', 'true', true)");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** For pre-tenant operations only: auth lookups, health checks, webhook ingestion. */
export async function withSystemClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
