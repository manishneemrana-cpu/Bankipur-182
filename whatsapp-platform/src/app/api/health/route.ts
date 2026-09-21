import { NextResponse } from "next/server";
import { withSystemClient } from "@/server/db";
import { getEnv } from "@/server/env";
import { getMetaConnectionStatus } from "@/server/meta/status";

export async function GET() {
  const env = getEnv();

  let database: "ok" | "error" = "error";
  try {
    await withSystemClient((client) => client.query("SELECT 1"));
    database = "ok";
  } catch {
    database = "error";
  }

  const meta = getMetaConnectionStatus();

  const body = {
    status: database === "ok" ? "ok" : "degraded",
    database,
    mockMeta: env.MOCK_META,
    // Presence only — never the values themselves, and never which ones are missing
    // beyond their names (no secret values ever appear here).
    meta: { mockMode: meta.mockMode, configured: meta.configured, missingVars: meta.missingVars },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body, { status: database === "ok" ? 200 : 503 });
}
