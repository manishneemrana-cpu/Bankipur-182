import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantContext } from "@/lib/auth/tenant";
import { errorResponse } from "@/app/api/projects/route";
import { getLLMProvider } from "@/lib/llm";
import { QualityControllerAgent } from "@/lib/agents/QualityControllerAgent";

const schema = z.object({
  videoBase64: z.string(),
  scene: z.record(z.string(), z.unknown()),
  continuityBible: z.record(z.string(), z.unknown()),
});

/** POST /api/qc — manually re-run quality control on a scene (e.g. after a user hand-edits a clip). */
export async function POST(req: NextRequest) {
  try {
    requireTenantContext(req);
    const { videoBase64, scene, continuityBible } = schema.parse(await req.json());

    const qcAgent = new QualityControllerAgent(getLLMProvider());
    const result = await qcAgent.evaluate(Buffer.from(videoBase64, "base64"), scene as never, continuityBible as never);

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
