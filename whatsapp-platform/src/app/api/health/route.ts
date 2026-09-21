import { NextResponse } from "next/server";
import { withSystemClient } from "@/server/db";
import { getEnv } from "@/server/env";

export async function GET() {
  const env = getEnv();

  let database: "ok" | "error" = "error";
  try {
    await withSystemClient((client) => client.query("SELECT 1"));
    database = "ok";
  } catch {
    database = "error";
  }

  const body = {
    status: database === "ok" ? "ok" : "degraded",
    database,
    mockMeta: env.MOCK_META,
    // Presence only — never the values themselves.
    metaConfigured: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET),
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body, { status: database === "ok" ? 200 : 503 });
}
