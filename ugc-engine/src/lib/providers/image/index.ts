import type { IImageProviderAdapter } from "./ImageProviderInterface";
import { PollinationsImageAdapter } from "./PollinationsImageAdapter";
import { NvidiaImageAdapter } from "./NvidiaImageAdapter";
import { HuggingFaceImageAdapter } from "./HuggingFaceImageAdapter";

export type ImageProviderKey = "pollinations" | "nvidia" | "huggingface";

let cached: IImageProviderAdapter | null = null;

/**
 * Selection order: explicit DEFAULT_IMAGE_PROVIDER; otherwise the first
 * configured paid provider; otherwise Pollinations (needs no key at all,
 * so this registry never returns null).
 */
export function getImageProvider(): IImageProviderAdapter {
  if (cached) return cached;

  const requested = process.env.DEFAULT_IMAGE_PROVIDER as ImageProviderKey | undefined;

  if ((requested === "nvidia" || !requested) && process.env.NVIDIA_API_KEY) {
    cached = new NvidiaImageAdapter(process.env.NVIDIA_API_KEY, process.env.NVIDIA_IMAGE_MODEL);
    return cached;
  }

  if ((requested === "huggingface" || !requested) && process.env.HUGGINGFACE_API_KEY) {
    cached = new HuggingFaceImageAdapter(process.env.HUGGINGFACE_API_KEY, process.env.HUGGINGFACE_IMAGE_MODEL);
    return cached;
  }

  cached = new PollinationsImageAdapter();
  return cached;
}

export type { IImageProviderAdapter, ImageGenerationParams, ImageGenerationResult } from "./ImageProviderInterface";
