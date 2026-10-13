import { config } from "../../config.js";
import { PaidApiNotImplemented, paidGate } from "../../lib/paid.js";
import { MockImageToVideoProvider } from "./mock.js";
import type { I2VDeps, I2VOptions, ImageToVideoProvider } from "./types.js";

/** Runway — Gen-4 (Turbo) image-to-video API */
export class RunwayProvider implements ImageToVideoProvider {
  readonly id = "runway";
  private mock: MockImageToVideoProvider;
  constructor(deps: I2VDeps) { this.mock = new MockImageToVideoProvider(deps); }

  async generate(imageUrl: string, opts: I2VOptions): Promise<string> {
    if (paidGate("runway", config.RUNWAY_API_KEY) === "mock") return this.mock.generate(imageUrl, opts);

    // TODO(paid-api): Runway Gen-4 — implement once the owner confirms the key is ready to test. Billed in credits per second.
    //   POST https://api.dev.runwayml.com/v1/image_to_video
    //   headers: { Authorization: `Bearer ${RUNWAY_API_KEY}`, "X-Runway-Version": "2024-11-06", "Content-Type": "application/json" }
    //   body:    { model: "gen4_turbo", promptImage: imageUrl, promptText: opts.prompt, ratio: "960:960", duration: opts.durationSec <= 5 ? 5 : 10 }
    //   poll:    GET /v1/tasks/{id} until status === "SUCCEEDED" (fail on "FAILED"); video URL = output[0]
    //   note:    Runway durations are 5 or 10s; the composition retimes the clip to fit anyway.
    throw new PaidApiNotImplemented("Runway — Gen-4 (Turbo) image-to-video API");
  }
}
