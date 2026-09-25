import type { IVideoProviderAdapter, VideoGenerationParams, VideoJobResponse } from "./VideoProviderInterface";
import { MockVideoAdapter } from "./MockVideoAdapter";

/** Luma Dream Machine adapter, same contract as every other IVideoProviderAdapter. */
export class LumaAdapter implements IVideoProviderAdapter {
  public providerName = "luma-dream-machine";
  public costPerSecondUsd = 0.08;
  private apiKey?: string;
  // Luma's model lineup moves (ray-1 -> ray-2 -> ray-flash-2, etc.); override via
  // LUMA_MODEL if this default is retired the way NVIDIA's models were.
  private model: string;
  private fallback = new MockVideoAdapter("luma-dream-machine", this.costPerSecondUsd);

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model || "ray-2";
  }

  public async generateScene(params: VideoGenerationParams): Promise<VideoJobResponse> {
    if (!this.apiKey) return this.fallback.generateScene(params);
    try {
      const response = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: params.prompt,
          model: this.model,
          aspect_ratio: params.aspectRatio,
          keyframes: params.referenceImageUrls?.length
            ? { frame0: { type: "image", url: params.referenceImageUrls[0] } }
            : undefined,
        }),
      });
      if (!response.ok) throw new Error(`Luma API error (${response.status}): ${await response.text()}`);
      const data = await response.json();
      return { providerJobId: data.id, status: "processing", costUsd: params.durationSeconds * this.costPerSecondUsd };
    } catch (error: unknown) {
      return { providerJobId: "", status: "failed", errorMessage: error instanceof Error ? error.message : String(error), costUsd: 0 };
    }
  }

  public async checkStatus(providerJobId: string): Promise<VideoJobResponse> {
    if (!this.apiKey) return this.fallback.checkStatus(providerJobId);
    const response = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${providerJobId}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    const data = await response.json();
    if (data.state === "completed") return { providerJobId, status: "succeeded", videoUrl: data.assets?.video, costUsd: 0 };
    if (data.state === "failed") return { providerJobId, status: "failed", errorMessage: data.failure_reason, costUsd: 0 };
    return { providerJobId, status: "processing", costUsd: 0 };
  }

  public async cancelJob(providerJobId: string): Promise<boolean> {
    if (!this.apiKey) return this.fallback.cancelJob(providerJobId);
    const response = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${providerJobId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    return response.ok;
  }
}
