import { clientEnvSchema, parseEnv } from "./schema";

// NEXT_PUBLIC_* values are inlined at build time, so they must be referenced
// explicitly rather than read from a spread of process.env.
export const clientEnv = parseEnv(clientEnvSchema, {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
