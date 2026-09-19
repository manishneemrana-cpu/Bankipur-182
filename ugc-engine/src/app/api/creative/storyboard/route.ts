import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantContext } from "@/lib/auth/tenant";
import { errorResponse } from "@/app/api/projects/route";
import { getLLMProvider } from "@/lib/llm";
import { CreativeDirectorOrchestrator } from "@/lib/agents/CreativeDirectorOrchestrator";
import type { ProductInput } from "@/types/project";

const schema = z.object({ productInput: z.record(z.string(), z.unknown()) });

/** POST /api/creative/storyboard — full Agents 1-7 pipeline: strategy, script, continuity, storyboard + prompts. */
export async function POST(req: NextRequest) {
  try {
    requireTenantContext(req);
    const { productInput } = schema.parse(await req.json());

    const orchestrator = new CreativeDirectorOrchestrator(getLLMProvider());
    const strategy = await orchestrator.executePipeline(productInput as unknown as ProductInput);

    return NextResponse.json(strategy);
  } catch (error) {
    return errorResponse(error);
  }
}
