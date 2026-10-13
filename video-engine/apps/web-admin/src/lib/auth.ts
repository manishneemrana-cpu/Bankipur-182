import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Supabase Auth is optional: without these env vars the API runs in single-account dev mode. */
export const authEnabled = Boolean(url && anon);
let client: SupabaseClient | null = null;
export const supabase = (): SupabaseClient | null => {
  if (!authEnabled) return null;
  return (client ??= createClient(url!, anon!));
};

export async function accessToken(): Promise<string | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}
