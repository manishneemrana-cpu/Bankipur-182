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

    // Pollinations intermittently 500s on longer, punctuation-heavy scene
    // prompts (confirmed by direct testing: the same long prompt fails
    // repeatedly while short ones like "a cat" always succeed with identical
    // width/height/seed params) — a transient/model-side issue, not a bad
    // request. Retry the same prompt a couple of times first (in case it's
    // transient), then fall back to a shortened, punctuation-stripped version
    // of the prompt rather than failing the whole scene outright.
    const candidates = [params.prompt, params.prompt, simplifyPrompt(params.prompt)];

    let lastError = "unknown error";
    for (const candidate of candidates) {
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(candidate)}?width=${width}&height=${height}&seed=${seed}&nologo=true`;
      try {
        // GET, not HEAD — Pollinations generates the image on request and HEAD
        // isn't guaranteed supported; the response status is available as soon
        // as headers arrive, before the body is read, so this doesn't cost an
        // extra download.
        // A hard timeout is required here: Pollinations can hang indefinitely
        // generating an image for some prompts (confirmed live — a serverless
        // invocation was killed by the platform's own execution cap after this
        // fetch never resolved), which without a bound stalls the entire job.
        const check = await fetch(url, { signal: AbortSignal.timeout(25_000) });
        if (check.ok) {
          // Generation is synchronous (the URL itself is the image), so this is
          // already "done" — no polling loop needed.
          return { providerJobId: url, status: "succeeded", videoUrl: url, costUsd: 0 };
        }
        lastError = `Pollinations error (${check.status})`;
        // 429 means we're being rate-limited — a fixed 500ms backoff isn't
        // nearly enough (confirmed live: repeated 429s across an entire run)
        // and retrying immediately just extends the outage. Back off hard.
        if (check.status === 429) {
          await sleep(8_000);
          continue;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
      await sleep(500);
    }

    return { providerJobId: "", status: "failed", errorMessage: lastError, costUsd: 0 };
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Strips punctuation and truncates to a short word count — a plain,
// short subject line is what reliably succeeds against Pollinations.
function simplifyPrompt(prompt: string): string {
  const words = prompt
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return words.slice(0, 12).join(" ") || "product photo";
}
