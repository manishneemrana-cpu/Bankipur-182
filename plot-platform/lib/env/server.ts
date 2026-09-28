import "server-only";

import { parseEnv, serverEnvSchema, type ServerEnv } from "./schema";

let cached: ServerEnv | undefined;

/** Server-only env. Importing this from a Client Component fails the build. */
export function serverEnv(): ServerEnv {
  cached ??= parseEnv(serverEnvSchema, process.env);
  return cached;
}
