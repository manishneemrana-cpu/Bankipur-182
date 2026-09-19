import type { IVideoProviderAdapter, VideoGenerationParams, VideoJobResponse } from "./VideoProviderInterface";
import { MockVideoAdapter } from "./MockVideoAdapter";

/**
 * Runway Gen-3/4 adapter. Implements the same IVideoProviderAdapter contract
 * as GoogleVeoAdapter so the worker can fall back to this provider (or the
 * reverse) without any orchestration changes. Falls back to a mock response
 * when RUNWAY_API_KEY is absent, for local development only.
 */
export class RunwayAdapter implements IVideoProviderAdapter {
  public providerName = "runway-gen4";
  public costPerSecondUsd = 0.12;
  private apiKey?: string;
  private fallback = new MockVideoAdapter("runway-gen4", this.costPerSecondUsd);
  private baseUrl = "https://api.runwayml.com/v1/image_to_video";

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  public async generateScene(params: VideoGenerationParams): Promise<VideoJobResponse> {
    if (!this.apiKey) return this.fallback.generateScene(params);

    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          promptText: params.prompt,
          duration: params.durationSeconds,
          ratio: params.aspectRatio,
          seed: params.seed,
          promptImage: params.referenceImageUrls?.[0],
        }),
      });
      if (!response.ok) throw new Error(`Runway API error: ${response.statusText}`);
      const data = await response.json();
      return { providerJobId: data.id, status: "processing", costUsd: params.durationSeconds * this.costPerSecondUsd };
    } catch (error: unknown) {
      return { providerJobId: "", status: "failed", errorMessage: error instanceof Error ? error.message : String(error), costUsd: 0 };
    }
  }

  public async checkStatus(providerJobId: string): Promise<VideoJobResponse> {
    if (!this.apiKey) return this.fallback.checkStatus(providerJobId);
    const response = await fetch(`https://api.runwayml.com/v1/tasks/${providerJobId}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    const data = await response.json();
    if (data.status === "SUCCEEDED") return { providerJobId, status: "succeeded", videoUrl: data.output?.[0], costUsd: 0 };
    if (data.status === "FAILED") return { providerJobId, status: "failed", errorMessage: data.failure, costUsd: 0 };
    return { providerJobId, status: "processing", costUsd: 0 };
  }

  public async cancelJob(providerJobId: string): Promise<boolean> {
    if (!this.apiKey) return this.fallback.cancelJob(providerJobId);
    const response = await fetch(`https://api.runwayml.com/v1/tasks/${providerJobId}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    return response.ok;
  }
}
