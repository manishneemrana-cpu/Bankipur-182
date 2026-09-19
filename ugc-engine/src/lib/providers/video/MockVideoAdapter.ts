import type { IVideoProviderAdapter, VideoGenerationParams, VideoJobResponse } from "./VideoProviderInterface";

/**
 * Deterministic local-dev stand-in for a real video model. Used by
 * Runway/Luma/Kling adapters until real API credentials are wired in, and
 * directly when no provider key is configured at all. Never selected in
 * production (see VideoProviderRegistry).
 */
export class MockVideoAdapter implements IVideoProviderAdapter {
  constructor(
    public providerName: string,
    public costPerSecondUsd: number
  ) {}

  public async generateScene(params: VideoGenerationParams): Promise<VideoJobResponse> {
    const providerJobId = `mock-${this.providerName}-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    return { providerJobId, status: "processing", costUsd: params.durationSeconds * this.costPerSecondUsd };
  }

  public async checkStatus(providerJobId: string): Promise<VideoJobResponse> {
    return {
      providerJobId,
      status: "succeeded",
      videoUrl: `https://mock-storage.local/scenes/${providerJobId}.mp4`,
      costUsd: 0,
    };
  }

  public async cancelJob(_providerJobId: string): Promise<boolean> {
    return true;
  }
}
