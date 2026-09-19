import { NextRequest } from "next/server";

export interface TenantContext {
  organizationId: string;
  userId: string;
  role: "owner" | "admin" | "editor" | "viewer";
}

export class UnauthorizedError extends Error {}

/**
 * Extracts the authenticated tenant context from a request. Real deployments
 * should replace the header read below with session/JWT verification (e.g.
 * Supabase Auth, as the sibling sitesnsign-ai-executive app already does);
 * this keeps the API route layer decoupled from whichever auth provider is
 * plugged in. Every DB query made after this call must run with
 * `app.current_organization_id` set to `organizationId` so Postgres RLS
 * enforces tenant isolation (see db/schema.sql).
 */
export function requireTenantContext(req: NextRequest): TenantContext {
  const organizationId = req.headers.get("x-organization-id");
  const userId = req.headers.get("x-user-id");
  const role = req.headers.get("x-user-role") as TenantContext["role"] | null;

  if (!organizationId || !userId) {
    throw new UnauthorizedError("Missing authenticated tenant context");
  }

  return { organizationId, userId, role: role ?? "viewer" };
}

export function assertRole(ctx: TenantContext, allowed: TenantContext["role"][]): void {
  if (!allowed.includes(ctx.role)) {
    throw new UnauthorizedError(`Role '${ctx.role}' is not permitted to perform this action`);
  }
}
