import { NextRequest, NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/auth/tenant";
import { ProjectRepository } from "@/lib/db/repositories";
import { errorResponse } from "../route";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenant = requireTenantContext(req);
    const { id } = await params;
    const project = await ProjectRepository.get(tenant.organizationId, id);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ project });
  } catch (error) {
    return errorResponse(error);
  }
}
