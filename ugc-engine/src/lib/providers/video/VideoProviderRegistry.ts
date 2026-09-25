import type { IVideoProviderAdapter } from "./VideoProviderInterface";
import { GoogleVeoAdapter } from "./GoogleVeoAdapter";
import { RunwayAdapter } from "./RunwayAdapter";
import { LumaAdapter } from "./LumaAdapter";
import { KlingAdapter } from "./KlingAdapter";
import { MockVideoAdapter } from "./MockVideoAdapter";
import { resolveEnv, type EnvOverrides } from "@/lib/settings/resolveEnv";

export type VideoProviderKey = "google-veo-2" | "runway-gen4" | "luma-dream-machine" | "kling-1.5";

/**
 * Central lookup so the worker/queue layer never imports a concrete
 * adapter directly. Adding a fifth provider means adding one line here.
 */
export class VideoProviderRegistry {
  static get(key: string, overrides: EnvOverrides = {}): IVideoProviderAdapter {
    const env = (k: string) => resolveEnv(overrides, k);

    switch (key as VideoProviderKey) {
      case "google-veo-2": {
        const apiKey = env("GOOGLE_VEO_API_KEY");
        return apiKey ? new GoogleVeoAdapter(apiKey) : new MockVideoAdapter("google-veo-2", 0.1);
      }
      case "runway-gen4":
        return new RunwayAdapter(env("RUNWAY_API_KEY"));
      case "luma-dream-machine":
        return new LumaAdapter(env("LUMA_API_KEY"));
      case "kling-1.5":
        return new KlingAdapter(env("KLING_API_KEY"));
      default:
        throw new Error(`Unknown video provider: ${key}`);
    }
  }

  static getDefault(overrides: EnvOverrides = {}): IVideoProviderAdapter {
    return this.get(resolveEnv(overrides, "DEFAULT_VIDEO_PROVIDER") || "google-veo-2", overrides);
  }
}
