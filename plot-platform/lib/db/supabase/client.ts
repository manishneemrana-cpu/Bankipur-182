import { createBrowserClient } from "@supabase/ssr";

import { clientEnv } from "@/lib/env/client";
import { required } from "@/lib/env/schema";

/** Browser client. Only ever holds the anon key; RLS does the enforcing. */
export function createClient() {
  return createBrowserClient(
    required(clientEnv, "NEXT_PUBLIC_SUPABASE_URL"),
    required(clientEnv, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
}
