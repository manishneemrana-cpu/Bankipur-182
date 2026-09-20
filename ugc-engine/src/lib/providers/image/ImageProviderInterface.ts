export interface ImageGenerationParams {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  seed?: number;
}

export interface ImageGenerationResult {
  imageBuffer: Buffer;
  contentType: string;
  costUsd: number;
}

/**
 * Used for thumbnail generation (spec section 28) and reference/concept
 * images — never for the primary UGC video frames themselves (those come
 * from the video providers in ../video).
 */
export interface IImageProviderAdapter {
  providerName: string;
  generateImage(params: ImageGenerationParams): Promise<ImageGenerationResult>;
}
