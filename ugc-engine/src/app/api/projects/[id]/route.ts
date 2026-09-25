import { NextRequest, NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/auth/tenant";
import { ProjectRepository, StrategyRepository, SceneRepository, RenderRepository, JobRepository } from "@/lib/db/repositories";
import { errorResponse } from "../route";

/** GET /api/projects/:id — full result bundle for the project detail dashboard: status, job progress, creative strategy, scenes, and the final render. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenant = requireTenantContext(req);
    const { id } = await params;
    const project = await ProjectRepository.get(tenant.organizationId, id);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const [job, strategy, scenes, render] = await Promise.all([
      JobRepository.getLatestForProject(tenant.organizationId, id),
      StrategyRepository.getLatest(tenant.organizationId, id),
      SceneRepository.listAll(tenant.organizationId, id),
      RenderRepository.getLatest(tenant.organizationId, id),
    ]);

    return NextResponse.json({ project, job, strategy, scenes, render });
  } catch (error) {
    return errorResponse(error);
  }
}
