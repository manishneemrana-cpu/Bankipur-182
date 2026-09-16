// Fallback values for this specific project's public Supabase config.
// NEXT_PUBLIC_* Supabase values are safe to hardcode as a fallback - the
// anon key is designed for client-side exposure and is meaningless
// without RLS, which is enforced on every table. This only backstops
// environments where the env var wasn't set (e.g. a Vercel preview
// project provisioned without its own env config); .env.local always
// takes precedence for local dev.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ildlvekfpqdwnmjyklge.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_AAG741ek3tD0fxu3BRpIkg_wNZcAfnr";
