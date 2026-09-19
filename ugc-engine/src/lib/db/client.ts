import { Pool, type PoolClient } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

/**
 * Runs `fn` inside a transaction with `app.current_organization_id` set for
 * the duration of the session, so every RLS policy in db/schema.sql scopes
 * queries to the caller's tenant automatically. Never query outside this
 * helper for tenant-scoped tables.
 */
export async function withTenant<T>(organizationId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_organization_id', $1, true)", [organizationId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** For system/admin operations that intentionally bypass RLS (migrations, cross-tenant billing jobs). */
export async function withSystemClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
