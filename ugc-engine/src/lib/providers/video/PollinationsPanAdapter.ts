import type { IVideoProviderAdapter, VideoGenerationParams, VideoJobResponse } from "./VideoProviderInterface";
import type { AspectRatio } from "@/types/project";

const DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  "9:16": { width: 768, height: 1344 },
  "16:9": { width: 1344, height: 768 },
  "1:1": { width: 1024, height: 1024 },
};

/**
 * Free, always-available "video" provider for accounts with no paid video
 * model configured: generates a still frame per scene via Pollinations.ai
 * (no key needed) and lets ShotstackRenderEngine animate it with a Ken
 * Burns pan/zoom instead of concatenating real motion clips. Not real AI
 * video generation — a deliberate, honest fallback so the pipeline still
 * produces a watchable result at zero cost. ShotstackRenderEngine checks
 * `providerName` to decide whether to render each scene as a "video" or
 * "image + pan" clip; see IMAGE_BASED_VIDEO_PROVIDERS in
 * VideoProviderRegistry.
 */
export class PollinationsPanAdapter implements IVideoProviderAdapter {
  public providerName = "pollinations-pan";
  public costPerSecondUsd = 0;

  public async generateScene(params: VideoGenerationParams): Promise<VideoJobResponse> {
    const { width, height } = DIMENSIONS[params.aspectRatio];
    // A stable per-prompt seed so retries/polling return the same frame instead
    // of a new random image each time the URL is fetched.
    const seed = params.seed ?? hashToSeed(params.prompt);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(params.prompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true`;

    try {
      // GET, not HEAD — Pollinations generates the image on request and HEAD
      // isn't guaranteed supported; the response status is available as soon
      // as headers arrive, before the body is read, so this doesn't cost an
      // extra download.
      const check = await fetch(url);
      if (!check.ok) throw new Error(`Pollinations error (${check.status})`);
    } catch (error) {
      return { providerJobId: "", status: "failed", errorMessage: error instanceof Error ? error.message : String(error), costUsd: 0 };
    }

    // Generation is synchronous (the URL itself is the image), so this is
    // already "done" — no polling loop needed.
    return { providerJobId: url, status: "succeeded", videoUrl: url, costUsd: 0 };
  }

  public async checkStatus(providerJobId: string): Promise<VideoJobResponse> {
    return { providerJobId, status: "succeeded", videoUrl: providerJobId, costUsd: 0 };
  }

  public async cancelJob(): Promise<boolean> {
    return true;
  }
}

function hashToSeed(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}
