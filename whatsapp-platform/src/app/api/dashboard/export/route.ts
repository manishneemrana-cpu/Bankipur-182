import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgContext } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { exportOrganizationData } from "@/server/data-lifecycle";

const querySchema = z.object({ organizationId: z.string().uuid() });

/** Session-authenticated (not API-key) — this is a dashboard download, not a public API endpoint. */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({ organizationId: request.nextUrl.searchParams.get("organizationId") });
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing or invalid organizationId" }, { status: 400 });
  }

  let context;
  try {
    context = await requireOrgContext(parsed.data.organizationId);
  } catch (err) {
    const status = err instanceof Error && err.message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  if (!hasPermission(context.role, context.permissionOverrides, "manage_billing")) {
    return NextResponse.json({ error: "You don't have permission to export organization data" }, { status: 403 });
  }

  const data = await exportOrganizationData(context.organizationId, context.userId);

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="export-${context.organizationId}.json"`,
    },
  });
}
