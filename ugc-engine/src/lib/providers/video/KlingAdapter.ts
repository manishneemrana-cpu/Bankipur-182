import type { IVideoProviderAdapter, VideoGenerationParams, VideoJobResponse } from "./VideoProviderInterface";
import { MockVideoAdapter } from "./MockVideoAdapter";

/** Kling AI adapter, same contract as every other IVideoProviderAdapter. */
export class KlingAdapter implements IVideoProviderAdapter {
  public providerName = "kling-1.5";
  public costPerSecondUsd = 0.07;
  private apiKey?: string;
  private fallback = new MockVideoAdapter("kling-1.5", this.costPerSecondUsd);

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  public async generateScene(params: VideoGenerationParams): Promise<VideoJobResponse> {
    if (!this.apiKey) return this.fallback.generateScene(params);
    try {
      const response = await fetch("https://api.klingai.com/v1/videos/text2video", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: params.prompt,
          negative_prompt: params.negativePrompt,
          aspect_ratio: params.aspectRatio,
          duration: String(params.durationSeconds),
          image: params.referenceImageUrls?.[0],
        }),
      });
      if (!response.ok) throw new Error(`Kling API error: ${response.statusText}`);
      const data = await response.json();
      return { providerJobId: data.data?.task_id, status: "processing", costUsd: params.durationSeconds * this.costPerSecondUsd };
    } catch (error: unknown) {
      return { providerJobId: "", status: "failed", errorMessage: error instanceof Error ? error.message : String(error), costUsd: 0 };
    }
  }

  public async checkStatus(providerJobId: string): Promise<VideoJobResponse> {
    if (!this.apiKey) return this.fallback.checkStatus(providerJobId);
    const response = await fetch(`https://api.klingai.com/v1/videos/text2video/${providerJobId}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    const data = await response.json();
    const status = data.data?.task_status;
    if (status === "succeed") return { providerJobId, status: "succeeded", videoUrl: data.data?.task_result?.videos?.[0]?.url, costUsd: 0 };
    if (status === "failed") return { providerJobId, status: "failed", errorMessage: data.data?.task_status_msg, costUsd: 0 };
    return { providerJobId, status: "processing", costUsd: 0 };
  }

  public async cancelJob(_providerJobId: string): Promise<boolean> {
    return true;
  }
}
