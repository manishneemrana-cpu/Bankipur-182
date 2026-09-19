export interface VideoGenerationParams {
  prompt: string;
  negativePrompt?: string;
  aspectRatio: "9:16" | "16:9" | "1:1";
  durationSeconds: number;
  referenceImageUrls?: string[];
  seed?: number;
}

export interface VideoJobResponse {
  providerJobId: string;
  status: "queued" | "processing" | "succeeded" | "failed";
  videoUrl?: string;
  errorMessage?: string;
  costUsd: number;
}

/**
 * Adapter Pattern: every video model provider (Veo, Runway, Luma, Kling, or a
 * future one) implements this same shape so the orchestration worker never
 * depends on a provider-specific SDK or payload format.
 */
export interface IVideoProviderAdapter {
  providerName: string;
  costPerSecondUsd: number;
  generateScene(params: VideoGenerationParams): Promise<VideoJobResponse>;
  checkStatus(providerJobId: string): Promise<VideoJobResponse>;
  cancelJob(providerJobId: string): Promise<boolean>;
}
