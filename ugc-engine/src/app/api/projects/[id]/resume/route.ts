import { NextRequest, NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/auth/tenant";
import { ProjectRepository, ProductRepository } from "@/lib/db/repositories";
import { getVideoProductionQueue } from "@/lib/queue/videoProductionQueue";
import { assertRedisConfigured } from "@/lib/queue/connection";
import { errorResponse } from "../../route";
import type { ProductInput } from "@/types/project";

/**
 * POST /api/projects/:id/resume — re-enqueues an existing project instead of
 * creating a new one. A single production run's total external-API time
 * (LLM strategy + N scene generations + voice + render) can exceed what a
 * single serverless invocation is allowed to run for, so a job can be
 * killed mid-pipeline with no automatic retry. processVideoProductionJob
 * skips any step it finds already-persisted (saved strategy, locked
 * scenes), so re-running the same project picks up close to where it left
 * off rather than starting over.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenant = requireTenantContext(req);
    const { id } = await params;

    const project = await ProjectRepository.get(tenant.organizationId, id);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const product = await ProductRepository.getWithBrand(tenant.organizationId, project.product_id);
    if (!product) return NextResponse.json({ error: "Project's product record is missing" }, { status: 404 });

    assertRedisConfigured();

    const input: ProductInput = {
      organizationId: tenant.organizationId,
      brandKitId: product.brand_kit_id,
      brandName: product.brand_name,
      productName: product.name,
      description: product.description,
      industry: product.industry,
      category: product.category ?? undefined,
      keyBenefits: product.key_benefits ?? [],
      targetAudience: product.target_audience,
      priceOffer: product.price_offer ?? undefined,
      ctaText: product.cta_text,
      language: project.language,
      voiceLanguage: (project as unknown as { voice_language?: string }).voice_language,
      subtitleLanguage: (project as unknown as { subtitle_language?: string }).subtitle_language,
      durationSeconds: project.target_duration_seconds,
      aspectRatio: project.aspect_ratio as ProductInput["aspectRatio"],
      referenceAssets: (product.reference_assets ?? []) as ProductInput["referenceAssets"],
      mode: project.mode as ProductInput["mode"],
    };

    const queue = getVideoProductionQueue();
    const job = await queue.add("generate-video", {
      organizationId: tenant.organizationId,
      projectId: project.id,
      productInput: input,
    });

    return NextResponse.json({ success: true, projectId: project.id, jobId: job.id, message: "Project re-queued for resumption." });
  } catch (error) {
    return errorResponse(error);
  }
}
