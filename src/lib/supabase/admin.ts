import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client for server-only, unauthenticated contexts (webhook
 * handlers) where there is no end-user session to derive RLS from. Never
 * import this outside a route handler / server action, and never expose
 * its result to the client.
 *
 * Returns null when SUPABASE_SERVICE_ROLE_KEY isn't configured - callers
 * must fail closed, not silently skip the privileged write.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) return null;

  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
