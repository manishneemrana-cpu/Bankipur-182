import { z } from "zod";

/**
 * Zod's built-in `.uuid()` (v4+) only accepts RFC 4122 version/variant bits
 * (or the special all-zero/all-f sentinels), which rejects perfectly valid
 * Postgres `uuid` values seeded by hand for testing (e.g.
 * `00000000-0000-0000-0000-000000000001`). Postgres itself has no such
 * restriction, so validate shape only.
 */
export const looseUuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid UUID");
