// Applies the Supabase shim, all migrations and the seed to a plain Postgres.
// Always run against a freshly created database (see scripts/db-local.sh),
// so this does not need to be idempotent.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import pg from "pg";

const url = process.argv[2] ?? process.env.TEST_DATABASE_URL;
if (!url) throw new Error("usage: node scripts/db-apply.mjs <database-url>");

const root = path.resolve(import.meta.dirname, "..");
const migrations = path.join(root, "supabase/migrations");
const files = [
  path.join(root, "tests/db/supabase-shim.sql"),
  ...readdirSync(migrations)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => path.join(migrations, f)),
  path.join(root, "supabase/seed.sql"),
];

const client = new pg.Client({ connectionString: url });
await client.connect();
for (const file of files) {
  try {
    await client.query(readFileSync(file, "utf8"));
  } catch (err) {
    console.error(
      `Failed applying ${path.relative(root, file)}: ${err.message}`,
    );
    if (err.position) {
      const sql = readFileSync(file, "utf8");
      const upTo = sql.slice(0, Number(err.position));
      console.error(`  at line ${upTo.split("\n").length}`);
    }
    await client.end();
    process.exit(1);
  }
}
await client.end();
console.error("Applied shim + migrations + seed.");
