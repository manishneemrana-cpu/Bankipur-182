import type { IImageProviderAdapter, ImageGenerationParams, ImageGenerationResult } from "./ImageProviderInterface";

/**
 * Hugging Face Inference API — free tier (rate-limited, cold-start delay on
 * first call while the model loads). Default model is a small, fast
 * Stable Diffusion variant; override with HUGGINGFACE_IMAGE_MODEL.
 */
export class HuggingFaceImageAdapter implements IImageProviderAdapter {
  public providerName = "huggingface-inference";
  private model: string;

  constructor(private apiKey: string, model?: string) {
    this.model = model || "stabilityai/stable-diffusion-xl-base-1.0";
  }

  public async generateImage(params: ImageGenerationParams): Promise<ImageGenerationResult> {
    const response = await fetch(`https://api-inference.huggingface.co/models/${this.model}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: params.prompt,
        parameters: { negative_prompt: params.negativePrompt, width: params.width ?? 1024, height: params.height ?? 1024, seed: params.seed },
      }),
    });

    if (!response.ok) throw new Error(`Hugging Face image error (${response.status}): ${await response.text()}`);

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    return { imageBuffer, contentType: response.headers.get("content-type") || "image/jpeg", costUsd: 0 };
  }
}
