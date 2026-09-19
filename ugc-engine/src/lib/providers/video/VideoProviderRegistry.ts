import type { IVideoProviderAdapter } from "./VideoProviderInterface";
import { GoogleVeoAdapter } from "./GoogleVeoAdapter";
import { RunwayAdapter } from "./RunwayAdapter";
import { LumaAdapter } from "./LumaAdapter";
import { KlingAdapter } from "./KlingAdapter";
import { MockVideoAdapter } from "./MockVideoAdapter";

export type VideoProviderKey = "google-veo-2" | "runway-gen4" | "luma-dream-machine" | "kling-1.5";

/**
 * Central lookup so the worker/queue layer never imports a concrete
 * adapter directly. Adding a fifth provider means adding one line here.
 */
export class VideoProviderRegistry {
  private static cache = new Map<string, IVideoProviderAdapter>();

  static get(key: string): IVideoProviderAdapter {
    const existing = this.cache.get(key);
    if (existing) return existing;

    let adapter: IVideoProviderAdapter;
    switch (key as VideoProviderKey) {
      case "google-veo-2": {
        const apiKey = process.env.GOOGLE_VEO_API_KEY;
        adapter = apiKey ? new GoogleVeoAdapter(apiKey) : new MockVideoAdapter("google-veo-2", 0.1);
        break;
      }
      case "runway-gen4":
        adapter = new RunwayAdapter(process.env.RUNWAY_API_KEY);
        break;
      case "luma-dream-machine":
        adapter = new LumaAdapter(process.env.LUMA_API_KEY);
        break;
      case "kling-1.5":
        adapter = new KlingAdapter(process.env.KLING_API_KEY);
        break;
      default:
        throw new Error(`Unknown video provider: ${key}`);
    }

    this.cache.set(key, adapter);
    return adapter;
  }

  static getDefault(): IVideoProviderAdapter {
    return this.get(process.env.DEFAULT_VIDEO_PROVIDER || "google-veo-2");
  }
}
