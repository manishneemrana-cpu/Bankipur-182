import type { IVideoProviderAdapter, VideoGenerationParams, VideoJobResponse } from "./VideoProviderInterface";
import type { IImageProviderAdapter } from "@/lib/providers/image/ImageProviderInterface";
import { MockVideoAdapter } from "./MockVideoAdapter";

/**
 * Runway Gen-3/4 adapter. Implements the same IVideoProviderAdapter contract
 * as GoogleVeoAdapter so the worker can fall back to this provider (or the
 * reverse) without any orchestration changes. Falls back to a mock response
 * when RUNWAY_API_KEY is absent, for local development only.
 *
 * Runway's public API is image-to-video only (dev.runwayml.com/v1/image_to_video
 * requires `promptImage`) — there is no pure text-to-video endpoint. Since this
 * pipeline's storyboard produces text prompts, `imageProvider` (when given) is
 * used to synthesize a starting frame on the fly for scenes with no reference
 * image, so Runway can still be used as a text-driven provider end to end.
 */
export class RunwayAdapter implements IVideoProviderAdapter {
  public providerName = "runway-gen4";
  public costPerSecondUsd = 0.12;
  private apiKey?: string;
  private imageProvider?: IImageProviderAdapter;
  private fallback = new MockVideoAdapter("runway-gen4", this.costPerSecondUsd);
  // Confirmed against Runway's developer docs: the API lives on the
  // api.dev.runwayml.com subdomain, not api.runwayml.com, and every request
  // requires the X-Runway-Version header or it's rejected outright.
  private baseUrl = "https://api.dev.runwayml.com/v1";
  private apiVersion = "2024-11-06";

  constructor(apiKey?: string, imageProvider?: IImageProviderAdapter) {
    this.apiKey = apiKey;
    this.imageProvider = imageProvider;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "X-Runway-Version": this.apiVersion,
    };
  }

  public async generateScene(params: VideoGenerationParams): Promise<VideoJobResponse> {
    if (!this.apiKey) return this.fallback.generateScene(params);

    try {
      let promptImage = params.referenceImageUrls?.[0];
      if (!promptImage) {
        if (!this.imageProvider) {
          throw new Error(
            "Runway's API requires a starting image (promptImage) and no image provider was configured to " +
              "synthesize one — set an image provider (NVIDIA/Hugging Face/Pollinations) or supply referenceImageUrls."
          );
        }
        const image = await this.imageProvider.generateImage({ prompt: params.prompt, negativePrompt: params.negativePrompt });
        promptImage = `data:${image.contentType};base64,${image.imageBuffer.toString("base64")}`;
      }

      const response = await fetch(`${this.baseUrl}/image_to_video`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          model: "gen4_turbo",
          promptText: params.prompt,
          duration: params.durationSeconds,
          ratio: runwayRatio(params.aspectRatio),
          seed: params.seed,
          promptImage,
        }),
      });
      if (!response.ok) throw new Error(`Runway API error (${response.status}): ${await response.text()}`);
      const data = await response.json();
      return { providerJobId: data.id, status: "processing", costUsd: params.durationSeconds * this.costPerSecondUsd };
    } catch (error: unknown) {
      return { providerJobId: "", status: "failed", errorMessage: error instanceof Error ? error.message : String(error), costUsd: 0 };
    }
  }

  public async checkStatus(providerJobId: string): Promise<VideoJobResponse> {
    if (!this.apiKey) return this.fallback.checkStatus(providerJobId);
    const response = await fetch(`${this.baseUrl}/tasks/${providerJobId}`, { headers: this.headers() });
    const data = await response.json();
    if (data.status === "SUCCEEDED") return { providerJobId, status: "succeeded", videoUrl: data.output?.[0], costUsd: 0 };
    if (data.status === "FAILED") return { providerJobId, status: "failed", errorMessage: data.failure, costUsd: 0 };
    return { providerJobId, status: "processing", costUsd: 0 };
  }

  public async cancelJob(providerJobId: string): Promise<boolean> {
    if (!this.apiKey) return this.fallback.cancelJob(providerJobId);
    const response = await fetch(`${this.baseUrl}/tasks/${providerJobId}/cancel`, { method: "POST", headers: this.headers() });
    return response.ok;
  }
}

/** Runway's `ratio` field takes an explicit "WIDTHxHEIGHT" string, not a bare aspect ratio. */
function runwayRatio(aspectRatio: VideoGenerationParams["aspectRatio"]): string {
  switch (aspectRatio) {
    case "9:16":
      return "720:1280";
    case "16:9":
      return "1280:720";
    case "1:1":
      return "960:960";
  }
}
