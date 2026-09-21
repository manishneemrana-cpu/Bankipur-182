import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantContext } from "@/lib/auth/tenant";
import { errorResponse } from "@/app/api/projects/route";
import { getVideoProductionQueue } from "@/lib/queue/videoProductionQueue";
import { ProjectRepository } from "@/lib/db/repositories";
import { looseUuid } from "@/lib/validation/uuid";

const schema = z.object({
  projectId: looseUuid,
  sceneNumbers: z.array(z.number().int().positive()).min(1),
  productInput: z.record(z.string(), z.unknown()),
});

/**
 * POST /api/scenes/regenerate — spec section 32/33: targeted scene-level
 * regeneration. Locked scenes are skipped by SceneRepository's
 * `WHERE is_locked = FALSE` clause even if included by mistake, so a user
 * edit never re-costs the whole project (up to 80% savings per spec #12).
 */
export async function POST(req: NextRequest) {
  try {
    const tenant = requireTenantContext(req);
    const { projectId, sceneNumbers, productInput } = schema.parse(await req.json());

    const project = await ProjectRepository.get(tenant.organizationId, projectId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const queue = getVideoProductionQueue();
    const job = await queue.add("regenerate-scenes", {
      organizationId: tenant.organizationId,
      projectId,
      productInput: { ...productInput, organizationId: tenant.organizationId },
      targetSceneNumbers: sceneNumbers,
    } as never);

    return NextResponse.json({ success: true, jobId: job.id });
  } catch (error) {
    return errorResponse(error);
  }
}
