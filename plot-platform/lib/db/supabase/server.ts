import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { required } from "@/lib/env/schema";
import { serverEnv } from "@/lib/env/server";

/** Per-request client acting as the signed-in user (RLS applies). */
export async function createClient() {
  const env = serverEnv();
  const cookieStore = await cookies();

  return createServerClient(
    required(env, "NEXT_PUBLIC_SUPABASE_URL"),
    required(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component; the proxy refreshes the session.
          }
        },
      },
    },
  );
}
