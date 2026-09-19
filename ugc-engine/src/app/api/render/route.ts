import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantContext } from "@/lib/auth/tenant";
import { errorResponse } from "@/app/api/projects/route";
import { FFmpegRenderEngine } from "@/lib/render/FFmpegRenderEngine";

const schema = z.object({
  sceneVideoPaths: z.array(z.string()).min(1),
  voiceoverAudioPath: z.string(),
  backgroundMusicPath: z.string().optional(),
  subtitlesPath: z.string().optional(),
  outputPath: z.string(),
  targetAspectRatio: z.enum(["9:16", "16:9", "1:1"]),
});

/**
 * POST /api/render — manual/ad-hoc render trigger. This runs the FFmpeg
 * pass inline for local testing only; production renders always run inside
 * the background worker (spec section 41: never run heavy FFmpeg work in a
 * short-lived serverless function).
 */
export async function POST(req: NextRequest) {
  try {
    requireTenantContext(req);
    const config = schema.parse(await req.json());
    const outputPath = await FFmpegRenderEngine.executeRender(config);
    return NextResponse.json({ success: true, outputPath });
  } catch (error) {
    return errorResponse(error);
  }
}
