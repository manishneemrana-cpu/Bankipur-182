import { NextRequest, NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/auth/tenant";
import { errorResponse } from "@/app/api/projects/route";
import { JobRepository } from "@/lib/db/repositories";

/** GET /api/jobs/:id — poll job progress (spec section 34: UI polls this instead of blocking on the request). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenant = requireTenantContext(req);
    const { id } = await params;
    const job = await JobRepository.get(tenant.organizationId, id);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    return NextResponse.json({ job });
  } catch (error) {
    return errorResponse(error);
  }
}
