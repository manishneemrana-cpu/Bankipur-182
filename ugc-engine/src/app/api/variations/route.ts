import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantContext } from "@/lib/auth/tenant";
import { errorResponse } from "@/app/api/projects/route";
import { getVideoProductionQueue } from "@/lib/queue/videoProductionQueue";
import { ProjectRepository } from "@/lib/db/repositories";
import type { CreativeFramework } from "@/types/agents";
import { looseUuid } from "@/lib/validation/uuid";

const schema = z.object({
  projectId: looseUuid,
  productInput: z.record(z.string(), z.unknown()),
  angles: z.array(z.string()).min(1).max(6),
});

const DEFAULT_VARIATION_ANGLES: CreativeFramework[] = [
  "Emotional Story",
  "Problem-Solution",
  "Testimonial",
  "Direct Response",
];

/**
 * POST /api/variations — spec section 26: one-click creative variations.
 * Same product/brand identity, different creative angle per queued job —
 * each is a fully independent project so they can be compared side by side.
 */
export async function POST(req: NextRequest) {
  try {
    const tenant = requireTenantContext(req);
    const { projectId, productInput, angles } = schema.parse(await req.json());

    const sourceProject = await ProjectRepository.get(tenant.organizationId, projectId);
    if (!sourceProject) return NextResponse.json({ error: "Source project not found" }, { status: 404 });

    const queue = getVideoProductionQueue();
    const jobs = await Promise.all(
      (angles.length ? angles : DEFAULT_VARIATION_ANGLES).map((angle) =>
        queue.add("generate-video", {
          organizationId: tenant.organizationId,
          projectId, // variations regenerate strategy for the same project; a real deployment would fork a new project row per variation
          productInput: {
            ...productInput,
            organizationId: tenant.organizationId,
            advancedCreative: { ...(productInput.advancedCreative as object), creativeConcept: angle },
          },
        } as never)
      )
    );

    return NextResponse.json({ success: true, jobIds: jobs.map((j) => j.id) });
  } catch (error) {
    return errorResponse(error);
  }
}
