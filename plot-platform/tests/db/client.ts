import pg from "pg";

export function getTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL not set. Run `npm run test:db` (wraps scripts/db-local.sh) or set it to a CI Postgres service.",
    );
  }
  return url;
}

export function newPool(): pg.Pool {
  return new pg.Pool({ connectionString: getTestDatabaseUrl() });
}

/**
 * Runs `fn` inside a transaction that is always rolled back, so tests never
 * leave data behind or interfere with each other. `fn` receives a client
 * already connected as the Postgres superuser (RLS bypassed) — call
 * `asUser`/`asAnon` to switch before exercising policies.
 */
export async function withRollback<T>(
  pool: pg.Pool,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    try {
      return await fn(client);
    } finally {
      await client.query("rollback");
    }
  } finally {
    client.release();
  }
}

/** Switches the current transaction to act as `userId` under RLS. */
export async function asUser(
  client: pg.PoolClient,
  userId: string,
): Promise<void> {
  await client.query("select set_config('request.jwt.claim.sub', $1, true)", [
    userId,
  ]);
  await client.query("set local role authenticated");
}

/** Switches the current transaction to the anonymous (public buyer) role. */
export async function asAnon(client: pg.PoolClient): Promise<void> {
  await client.query("set local role anon");
}

/** Back to the superuser owner (bypasses RLS) for fixture setup/assertions. */
export async function asOwner(client: pg.PoolClient): Promise<void> {
  await client.query("reset role");
}

/**
 * Runs a query expected to fail inside a savepoint, so the surrounding
 * transaction isn't left aborted for the assertions that follow.
 */
export async function expectRejects(
  client: pg.PoolClient,
  run: () => Promise<unknown>,
  matcher?: RegExp,
): Promise<void> {
  await client.query("savepoint expect_reject");
  try {
    await run();
    throw new Error("expected the query to reject, but it succeeded");
  } catch (err) {
    if (matcher && !matcher.test(String(err))) throw err;
  } finally {
    await client.query("rollback to savepoint expect_reject");
  }
}
