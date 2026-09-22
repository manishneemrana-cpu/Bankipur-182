import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantContext } from "@/lib/auth/tenant";
import { errorResponse } from "@/app/api/projects/route";
import { getVideoProductionQueue } from "@/lib/queue/videoProductionQueue";
import { assertRedisConfigured } from "@/lib/queue/connection";
import { ProjectRepository } from "@/lib/db/repositories";
import { looseUuid } from "@/lib/validation/uuid";

const schema = z.object({ projectId: looseUuid, productInput: z.record(z.string(), z.unknown()) });

/** POST /api/scenes/generate — dispatches full scene generation for an already-created project. */
export async function POST(req: NextRequest) {
  try {
    const tenant = requireTenantContext(req);
    const { projectId, productInput } = schema.parse(await req.json());
    assertRedisConfigured();

    const project = await ProjectRepository.get(tenant.organizationId, projectId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const queue = getVideoProductionQueue();
    const job = await queue.add("generate-video", {
      organizationId: tenant.organizationId,
      projectId,
      productInput: { ...productInput, organizationId: tenant.organizationId },
    } as never);

    return NextResponse.json({ success: true, jobId: job.id });
  } catch (error) {
    return errorResponse(error);
  }
}
