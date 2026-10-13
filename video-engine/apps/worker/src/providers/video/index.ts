import type { VideoProviderId } from "@ave/shared-types";
import { KlingProvider } from "./kling.js";
import { LumaProvider } from "./luma.js";
import { MockImageToVideoProvider } from "./mock.js";
import { RunwayProvider } from "./runway.js";
import type { I2VDeps, ImageToVideoProvider } from "./types.js";

export type { ImageToVideoProvider, I2VDeps, I2VOptions } from "./types.js";
export { CINEMATIC_PROMPT } from "./types.js";

export function createImageToVideoProvider(id: VideoProviderId, deps: I2VDeps): ImageToVideoProvider {
  switch (id) {
    case "luma": return new LumaProvider(deps);
    case "runway": return new RunwayProvider(deps);
    case "kling": return new KlingProvider(deps);
    case "mock":
    default: return new MockImageToVideoProvider(deps);
  }
}
