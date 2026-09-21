import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, hasScope, type AuthenticatedApiKey } from "@/server/api-keys";

export type ApiAuthResult =
  | { ok: true; auth: AuthenticatedApiKey }
  | { ok: false; response: NextResponse };

/** Shared Bearer-token auth + scope check for every /api/v1/* route. */
export async function requireApiScope(request: NextRequest, scope: string): Promise<ApiAuthResult> {
  const authHeader = request.headers.get("authorization");
  const rawKey = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!rawKey) {
    return { ok: false, response: NextResponse.json({ error: "Missing Authorization: Bearer <api key> header" }, { status: 401 }) };
  }

  const auth = await authenticateApiKey(rawKey);
  if (!auth) {
    return { ok: false, response: NextResponse.json({ error: "Invalid or revoked API key" }, { status: 401 }) };
  }

  if (!hasScope(auth, scope)) {
    return { ok: false, response: NextResponse.json({ error: `API key lacks ${scope} scope` }, { status: 403 }) };
  }

  return { ok: true, auth };
}
