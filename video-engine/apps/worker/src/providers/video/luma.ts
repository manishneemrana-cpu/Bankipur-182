import { config } from "../../config.js";
import { PaidApiNotImplemented, paidGate } from "../../lib/paid.js";
import { MockImageToVideoProvider } from "./mock.js";
import type { I2VDeps, I2VOptions, ImageToVideoProvider } from "./types.js";

/** Luma AI — Ray2 (Dream Machine API) */
export class LumaProvider implements ImageToVideoProvider {
  readonly id = "luma";
  private mock: MockImageToVideoProvider;
  constructor(deps: I2VDeps) { this.mock = new MockImageToVideoProvider(deps); }

  async generate(imageUrl: string, opts: I2VOptions): Promise<string> {
    if (paidGate("luma", config.LUMA_API_KEY) === "mock") return this.mock.generate(imageUrl, opts);

    // TODO(paid-api): Luma Ray2 — implement once the owner confirms the key is ready to test. Billed per generation.
    //   POST https://api.lumalabs.ai/dream-machine/v1/generations
    //   headers: { Authorization: `Bearer ${LUMA_API_KEY}`, "Content-Type": "application/json" }
    //   body:    { model: "ray-2", prompt: opts.prompt, duration: `${opts.durationSec}s`, aspect_ratio: opts.aspect, resolution: "720p",
    //              keyframes: { frame0: { type: "image", url: imageUrl } } }   // imageUrl must be publicly fetchable
    //   poll:    GET /generations/{id} every ~5s until state === "completed" (fail on "failed"); video URL = assets.video
    //   then:    download the MP4 (provider URLs expire) and return it; the stage re-uploads to our storage.
    throw new PaidApiNotImplemented("Luma AI — Ray2 (Dream Machine API)");
  }
}
