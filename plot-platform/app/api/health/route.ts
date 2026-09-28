import { serverEnv } from "@/lib/env/server";

// Reports which integrations are configured, never their values.
export function GET() {
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
  });
}
