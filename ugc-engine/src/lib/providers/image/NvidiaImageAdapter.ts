import type { IImageProviderAdapter, ImageGenerationParams, ImageGenerationResult } from "./ImageProviderInterface";

/**
 * NVIDIA NIM image generation (build.nvidia.com) — same NVIDIA_API_KEY used
 * for the LLM registry can drive an image model too. Default model is
 * Stability's SDXL as hosted on NVIDIA's catalog; override with
 * NVIDIA_IMAGE_MODEL if you pick a different one from build.nvidia.com.
 */
export class NvidiaImageAdapter implements IImageProviderAdapter {
  public providerName = "nvidia-nim-image";
  private model: string;

  constructor(private apiKey: string, model?: string) {
    this.model = model || "stabilityai/stable-diffusion-xl";
  }

  public async generateImage(params: ImageGenerationParams): Promise<ImageGenerationResult> {
    const response = await fetch(`https://ai.api.nvidia.com/v1/genai/${this.model}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text_prompts: [{ text: params.prompt, weight: 1 }, ...(params.negativePrompt ? [{ text: params.negativePrompt, weight: -1 }] : [])],
        seed: params.seed ?? 0,
        width: params.width ?? 1024,
        height: params.height ?? 1024,
      }),
    });

    if (!response.ok) throw new Error(`NVIDIA NIM image error (${response.status}): ${await response.text()}`);

    const data = await response.json();
    const base64 = data.artifacts?.[0]?.base64;
    if (!base64) throw new Error("NVIDIA NIM image response contained no image data");

    return { imageBuffer: Buffer.from(base64, "base64"), contentType: "image/png", costUsd: 0 };
  }
}
