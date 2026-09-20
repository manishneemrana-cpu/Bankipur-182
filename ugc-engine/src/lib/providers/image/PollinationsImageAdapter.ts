import type { IImageProviderAdapter, ImageGenerationParams, ImageGenerationResult } from "./ImageProviderInterface";

/**
 * Pollinations.ai — no API key required, fully free, unlimited (rate-limited
 * politely). Good default fallback for thumbnails when no paid image
 * provider is configured. Quality is lower than Stability/NVIDIA models but
 * it never blocks the pipeline on a missing credential.
 */
export class PollinationsImageAdapter implements IImageProviderAdapter {
  public providerName = "pollinations";

  public async generateImage(params: ImageGenerationParams): Promise<ImageGenerationResult> {
    const width = params.width ?? 1024;
    const height = params.height ?? 1024;
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(params.prompt)}?width=${width}&height=${height}&nologo=true${
      params.seed ? `&seed=${params.seed}` : ""
    }`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Pollinations image error (${response.status})`);

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    return { imageBuffer, contentType: "image/jpeg", costUsd: 0 };
  }
}
