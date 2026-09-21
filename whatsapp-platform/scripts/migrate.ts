import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

/**
 * Runs schema migrations as the privileged (superuser-ish) role, then ensures
 * a low-privilege runtime role exists with NOSUPERUSER + NOBYPASSRLS.
 *
 * This second step matters: Postgres superusers (and, without
 * FORCE ROW LEVEL SECURITY, table owners) always bypass Row-Level Security.
 * If the Next.js app connected with the same role that owns the tables and
 * ran the migrations, every RLS policy in 0001_init.sql would silently do
 * nothing and tenant isolation would not exist in practice. So:
 *   - MIGRATE_DATABASE_URL: superuser connection, used only by this script.
 *   - DATABASE_URL: the runtime role the app and tests actually connect as.
 */
async function main() {
  const migrateUrl = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;
  const runtimeUrl = process.env.DATABASE_URL;
  if (!migrateUrl) throw new Error("MIGRATE_DATABASE_URL (or DATABASE_URL) is not set");
  if (!runtimeUrl) throw new Error("DATABASE_URL is not set");

  const runtime = new URL(runtimeUrl);
  const runtimeUser = decodeURIComponent(runtime.username);
  const runtimePassword = decodeURIComponent(runtime.password);
  if (!runtimeUser || !runtimePassword) {
    throw new Error("DATABASE_URL must include a username and password for the runtime role");
  }

  const pool = new Pool({ connectionString: migrateUrl });
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const applied = new Set(
      (await client.query("SELECT filename FROM schema_migrations")).rows.map(
        (r: { filename: string }) => r.filename
      )
    );

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip  ${file} (already applied)`);
        continue;
      }
      const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      console.log(`apply ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
      }
    }

    console.log(`ensuring runtime role "${runtimeUser}" (NOSUPERUSER, NOBYPASSRLS)...`);
    const roleExists = await client.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [runtimeUser]);
    // quote_ident/quote_literal escape via Postgres itself: ALTER/CREATE ROLE are
    // utility statements and cannot take bind parameters for the password clause.
    const escaped = await client.query<{ ident: string; lit: string }>(
      "SELECT quote_ident($1) AS ident, quote_literal($2) AS lit",
      [runtimeUser, runtimePassword]
    );
    const { ident, lit } = escaped.rows[0]!;

    if (roleExists.rows.length === 0) {
      await client.query(`CREATE ROLE ${ident} WITH LOGIN PASSWORD ${lit} NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`);
    } else {
      await client.query(`ALTER ROLE ${ident} WITH LOGIN PASSWORD ${lit} NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`);
    }

    await client.query(`GRANT USAGE ON SCHEMA public TO ${ident}`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${ident}`);
    await client.query(`GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO ${ident}`);
    await client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${ident}`
    );

    console.log("Migrations up to date. Runtime role ready.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
