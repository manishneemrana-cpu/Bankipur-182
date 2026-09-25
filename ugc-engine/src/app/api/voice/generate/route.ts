import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantContext } from "@/lib/auth/tenant";
import { errorResponse } from "@/app/api/projects/route";
import { getVoiceProvider } from "@/lib/providers/voice";
import { getCredentialOverrides } from "@/lib/settings/resolveEnv";

const schema = z.object({
  text: z.string().min(1),
  language: z.string().default("English"),
  gender: z.string().default("female"),
  accent: z.string().optional(),
  emotion: z.string().optional(),
  speed: z.number().min(0.7).max(1.3).optional(),
});

/** POST /api/voice/generate — standalone voice preview/regeneration, independent of the full render pipeline. */
export async function POST(req: NextRequest) {
  try {
    const tenant = requireTenantContext(req);
    const params = schema.parse(await req.json());
    const overrides = await getCredentialOverrides(tenant.organizationId);
    const result = await getVoiceProvider(overrides).synthesize(params);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
