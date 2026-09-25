import type { IVideoProviderAdapter, VideoGenerationParams, VideoJobResponse } from "./VideoProviderInterface";

const MODEL = "veo-2.0-generate-001";

/**
 * Google Veo, accessed via the Gemini API's `predictLongRunning` long-running
 * operation, NOT Google Cloud's Video Intelligence API (a completely
 * different, video-analysis-only product the previous version of this file
 * guessed at). Confirmed live: this endpoint/payload shape gets past auth and
 * validation — the only failure seen in testing was HTTP 402 "prepayment
 * credits are depleted", i.e. an account/billing gate, not a code bug. The
 * API key must be a Gemini API (AI Studio) key — the same one used for text
 * generation, not a separate Cloud "Video Intelligence" key.
 */
export class GoogleVeoAdapter implements IVideoProviderAdapter {
  public providerName = "google-veo-2";
  public costPerSecondUsd = 0.1;
  private apiKey: string;
  private baseUrl = "https://generativelanguage.googleapis.com/v1beta";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  public async generateScene(params: VideoGenerationParams): Promise<VideoJobResponse> {
    try {
      const payload = {
        instances: [
          {
            prompt: params.negativePrompt ? `${params.prompt}\n\nAvoid: ${params.negativePrompt}` : params.prompt,
          },
        ],
        parameters: {
          aspectRatio: params.aspectRatio,
          personGeneration: "allow_adult",
        },
      };

      const response = await fetch(`${this.baseUrl}/models/${MODEL}:predictLongRunning?key=${this.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(`Veo API error (${response.status}): ${data?.error?.message ?? JSON.stringify(data)}`);

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
    const response = await fetch(`${this.baseUrl}/${providerJobId}?key=${this.apiKey}`);
    const data = await response.json();

    if (!response.ok) {
      return { providerJobId, status: "failed", errorMessage: data?.error?.message ?? JSON.stringify(data), costUsd: 0 };
    }

    if (data.done) {
      if (data.error) {
        return { providerJobId, status: "failed", errorMessage: data.error.message, costUsd: 0 };
      }
      const sample = data.response?.generateVideoResponse?.generatedSamples?.[0];
      const uri: string | undefined = sample?.video?.uri;
      if (!uri) {
        return { providerJobId, status: "failed", errorMessage: "Veo operation completed with no video sample returned", costUsd: 0 };
      }
      // The file API URI requires the same key to download.
      const videoUrl = uri.includes("?") ? `${uri}&key=${this.apiKey}` : `${uri}?key=${this.apiKey}`;
      return { providerJobId, status: "succeeded", videoUrl, costUsd: 0 };
    }

    return { providerJobId, status: "processing", costUsd: 0 };
  }

  public async cancelJob(_providerJobId: string): Promise<boolean> {
    return true;
  }
}
