import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantContext } from "@/lib/auth/tenant";
import { errorResponse } from "@/app/api/projects/route";
import { getLLMProvider } from "@/lib/llm";
import { BrandStrategistAgent } from "@/lib/agents/BrandStrategistAgent";
import { AudienceStrategistAgent } from "@/lib/agents/AudienceStrategistAgent";
import type { ProductInput } from "@/types/project";

const schema = z.object({ productInput: z.record(z.string(), z.unknown()) });

/**
 * POST /api/creative/analyze — spec section 45 "Creative Preview": Agents
 * 1-2 only, cheap text-only calls, so the user can sanity-check brand and
 * audience understanding before any paid video generation is queued.
 */
export async function POST(req: NextRequest) {
  try {
    requireTenantContext(req);
    const { productInput } = schema.parse(await req.json());
    const llm = getLLMProvider();

    const [brandIdentity, audiencePsychology] = await Promise.all([
      new BrandStrategistAgent(llm).analyze(productInput as unknown as ProductInput),
      new AudienceStrategistAgent(llm).analyze(productInput as unknown as ProductInput),
    ]);

    return NextResponse.json({ brandIdentity, audiencePsychology });
  } catch (error) {
    return errorResponse(error);
  }
}
