import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantContext, UnauthorizedError } from "@/lib/auth/tenant";
import { ProductRepository, ProjectRepository } from "@/lib/db/repositories";
import { getVideoProductionQueue } from "@/lib/queue/videoProductionQueue";
import type { ProductInput } from "@/types/project";

const productInputSchema = z.object({
  brandKitId: z.string().uuid(),
  brandName: z.string().min(1),
  productName: z.string().min(1),
  description: z.string().min(1),
  industry: z.string().default("general"),
  category: z.string().optional(),
  keyBenefits: z.array(z.string()).default([]),
  targetAudience: z.string().min(1),
  priceOffer: z.string().optional(),
  ctaText: z.string().default("Shop Now"),
  language: z.string().default("English"),
  voiceLanguage: z.string().optional(),
  subtitleLanguage: z.string().optional(),
  durationSeconds: z.number().int().min(6).max(90).default(30),
  aspectRatio: z.enum(["9:16", "16:9", "1:1"]).default("9:16"),
  platformPreset: z.string().optional(),
  referenceAssets: z.array(z.object({ type: z.string(), url: z.string() })).optional(),
  websiteUrl: z.string().optional(),
  mode: z.enum(["simple", "pro_studio", "autopilot"]).default("simple"),
  creatorProfileId: z.string().uuid().optional(),
  advancedCreative: z.record(z.string(), z.unknown()).optional(),
});

/** POST /api/projects — spec section 39/44: create a project and dispatch async production. */
export async function POST(req: NextRequest) {
  try {
    const tenant = requireTenantContext(req);
    const body = productInputSchema.parse(await req.json());

    const input: ProductInput = { ...body, organizationId: tenant.organizationId } as ProductInput;

    const productId = await ProductRepository.create(tenant.organizationId, body.brandKitId, input);
    const project = await ProjectRepository.create(
      tenant.organizationId,
      productId,
      input,
      `${body.brandName} — ${body.productName}`
    );

    const queue = getVideoProductionQueue();
    const job = await queue.add("generate-video", {
      organizationId: tenant.organizationId,
      projectId: project.id,
      productInput: input,
    });

    return NextResponse.json({
      success: true,
      projectId: project.id,
      jobId: job.id,
      message: "Creative Production Engine initialized successfully.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
  }
  return NextResponse.json({ error: error instanceof Error ? error.message : "Internal error" }, { status: 500 });
}
