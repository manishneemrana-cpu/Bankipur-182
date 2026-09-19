import type { IVideoProviderAdapter, VideoGenerationParams, VideoJobResponse } from "./VideoProviderInterface";

export class GoogleVeoAdapter implements IVideoProviderAdapter {
  public providerName = "google-veo-2";
  public costPerSecondUsd = 0.1;
  private apiKey: string;
  private baseUrl = "https://videointelligence.googleapis.com/v1/video:generate";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  public async generateScene(params: VideoGenerationParams): Promise<VideoJobResponse> {
    try {
      const payload = {
        model: "veo-2.0-generate-001",
        prompt: params.prompt,
        negative_prompt: params.negativePrompt,
        config: {
          aspect_ratio: params.aspectRatio,
          duration_seconds: params.durationSeconds,
          generate_audio: false, // audio handled by the dedicated voice pipeline
          seed: params.seed,
        },
        image_references: params.referenceImageUrls?.map((url) => ({ image_uri: url })),
      };

      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`Veo API error: ${response.statusText}`);

      const data = await response.json();
      return {
        providerJobId: data.name,
        status: "processing",
        costUsd: params.durationSeconds * this.costPerSecondUsd,
      };
    } catch (error: unknown) {
      return {
        providerJobId: "",
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
        costUsd: 0,
      };
    }
  }

  public async checkStatus(providerJobId: string): Promise<VideoJobResponse> {
    const response = await fetch(
      `https://videointelligence.googleapis.com/v1/${providerJobId}?key=${this.apiKey}`
    );
    const data = await response.json();

    if (data.done) {
      if (data.error) {
        return { providerJobId, status: "failed", errorMessage: data.error.message, costUsd: 0 };
      }
      return { providerJobId, status: "succeeded", videoUrl: data.response.generated_video_uri, costUsd: 0 };
    }

    return { providerJobId, status: "processing", costUsd: 0 };
  }

  public async cancelJob(_providerJobId: string): Promise<boolean> {
    return true;
  }
}
