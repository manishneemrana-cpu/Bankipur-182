import { serverEnv } from "@/lib/env/server";

type Check = "ok" | "unreachable" | "not_configured";

async function checkSupabase(url?: string, key?: string): Promise<Check> {
  if (!url || !key) return "not_configured";
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: key },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? "ok" : "unreachable";
  } catch {
    return "unreachable";
  }
}

// Reports which integrations are configured and reachable, never their values.
export async function GET() {
  const env = serverEnv();
  return Response.json({
    status: "ok",
    configured: {
      supabase: Boolean(
        env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      ),
      ai: Boolean(env.AI_PROVIDER && env.AI_API_KEY),
      maps: Boolean(env.MAP_TILE_PROVIDER && env.MAP_API_KEY),
    },
    checks: {
      supabase: await checkSupabase(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      ),
    },
  });
}
