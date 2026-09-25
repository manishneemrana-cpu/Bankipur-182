import type { IImageProviderAdapter } from "./ImageProviderInterface";
import { PollinationsImageAdapter } from "./PollinationsImageAdapter";
import { NvidiaImageAdapter } from "./NvidiaImageAdapter";
import { HuggingFaceImageAdapter } from "./HuggingFaceImageAdapter";
import { resolveEnv, type EnvOverrides } from "@/lib/settings/resolveEnv";

export type ImageProviderKey = "pollinations" | "nvidia" | "huggingface";

/**
 * Selection order: explicit DEFAULT_IMAGE_PROVIDER; otherwise the first
 * configured paid provider; otherwise Pollinations (needs no key at all,
 * so this registry never returns null).
 */
export function getImageProvider(overrides: EnvOverrides = {}): IImageProviderAdapter {
  const env = (key: string) => resolveEnv(overrides, key);
  const requested = env("DEFAULT_IMAGE_PROVIDER") as ImageProviderKey | undefined;

  if ((requested === "nvidia" || !requested) && env("NVIDIA_API_KEY")) {
    return new NvidiaImageAdapter(env("NVIDIA_API_KEY") as string, env("NVIDIA_IMAGE_MODEL"));
  }

  if ((requested === "huggingface" || !requested) && env("HUGGINGFACE_API_KEY")) {
    return new HuggingFaceImageAdapter(env("HUGGINGFACE_API_KEY") as string, env("HUGGINGFACE_IMAGE_MODEL"));
  }

  return new PollinationsImageAdapter();
}

export type { IImageProviderAdapter, ImageGenerationParams, ImageGenerationResult } from "./ImageProviderInterface";
